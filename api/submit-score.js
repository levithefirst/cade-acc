// /api/submit-score.js
// Server-authoritative CADE OPS score submission.
// The browser's HttpOnly player cookie is the canonical identity.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const LEGACY_KEY = "caderush:leaderboard";
const PLAYER_LEADERBOARD_KEY = "caderush:players:leaderboard";
const PLAYER_PREFIX = "caderush:player:";
const PLAYER_COOKIE = "__Host-cade_player_id";
const MAX_PLAUSIBLE_SCORE = 1_000_000;
const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX = 5;
const RUN_TTL = 86400;

async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const part = raw.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

function validPlayerId(playerId) {
  return typeof playerId === "string" && /^cade_anon_[a-f0-9-]{36}$/.test(playerId);
}

function sameOrigin(req) {
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return origin === `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: "Leaderboard not configured" });
  if (!sameOrigin(req)) return res.status(403).json({ error: "Cross-site request rejected" });

  try {
    const cookiePlayerId = readCookie(req, PLAYER_COOKIE);
    if (!validPlayerId(cookiePlayerId)) return res.status(401).json({ error: "Player registration required" });

    const playerKey = `${PLAYER_PREFIX}${cookiePlayerId}`;
    const playerResult = await redis(["HGETALL", playerKey]);
    const fields = playerResult.result || [];
    if (!fields.length) return res.status(401).json({ error: "Player registration required" });
    const player = {};
    for (let i = 0; i < fields.length; i += 2) player[fields[i]] = fields[i + 1];
    if (!player.name) return res.status(401).json({ error: "Player registration required" });

    const body = req.body || {};
    const cleanScore = Math.round(Number(body.score));
    if (!Number.isFinite(cleanScore) || cleanScore < 0 || cleanScore > MAX_PLAUSIBLE_SCORE) {
      return res.status(400).json({ error: "Invalid score" });
    }

    if (body.playerId !== undefined && body.playerId !== cookiePlayerId) {
      return res.status(403).json({ error: "Player identity mismatch" });
    }
    if (body.name !== undefined && String(body.name).trim().toUpperCase() !== player.name) {
      return res.status(403).json({ error: "Callsign is locked" });
    }

    const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
    const rlKey = `caderush:rl:${ip}`;
    const count = await redis(["INCR", rlKey]);
    if (count.result === 1) await redis(["EXPIRE", rlKey, RATE_LIMIT_WINDOW]);
    if (count.result > RATE_LIMIT_MAX) return res.status(429).json({ error: "Too many submissions — slow down" });

    const runId = typeof body.runId === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(body.runId)
      ? body.runId
      : null;
    if (!runId) return res.status(400).json({ error: "Run identity required" });

    // One score submission per run. Replays of the same payload are ignored.
    const runKey = `caderush:run:${cookiePlayerId}:${runId}`;
    const claimed = await redis(["SET", runKey, "1", "EX", RUN_TTL, "NX"]);
    if (claimed.result !== "OK") {
      const rankResult = await redis(["ZREVRANK", PLAYER_LEADERBOARD_KEY, cookiePlayerId]);
      return res.status(200).json({ ok: true, duplicate: true, rank: rankResult.result === null ? null : rankResult.result + 1, name: player.name });
    }

    // The canonical leaderboard has one member per player. ZADD GT keeps the best run.
    await redis(["ZADD", PLAYER_LEADERBOARD_KEY, "GT", cleanScore, cookiePlayerId]);

    // Keep the old run-based leaderboard untouched. It is legacy historical data.
    // New scores never write to it, so old identities are never fabricated.
    const rankResult = await redis(["ZREVRANK", PLAYER_LEADERBOARD_KEY, cookiePlayerId]);
    const rank = rankResult.result !== null ? rankResult.result + 1 : null;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, rank, name: player.name });
  } catch (err) {
    return res.status(500).json({ error: "Submission failed" });
  }
}
