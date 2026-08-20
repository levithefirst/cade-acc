// /api/submit-score.js
// Server-authoritative CADE OPS score submission.
// The browser's HttpOnly player cookie is the canonical identity.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PLAYER_LEADERBOARD_KEY = "caderush:players:leaderboard";
const PLAYER_PREFIX = "caderush:player:";
const PLAYER_COOKIE = "__Host-cade_player_id";
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

// Rate-limit increments and expiry atomically. Without this, a failed request
// between INCR and EXPIRE could leave an IP rate-limit key alive indefinitely.
const RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`;

// A run is idempotent and the leaderboard update is atomic with the run claim.
// This removes the old failure window where a run could be marked consumed before
// ZADD succeeded, permanently losing a legitimate score after a transient Redis error.
const SUBMIT_RUN_SCRIPT = `
if redis.call("EXISTS", KEYS[1]) == 1 then
  local rank = redis.call("ZREVRANK", KEYS[2], ARGV[1])
  if rank == false then return {0, -1} end
  return {0, rank}
end
redis.call("ZADD", KEYS[2], "GT", ARGV[2], ARGV[1])
redis.call("SET", KEYS[1], "1", "EX", ARGV[3])
local rank = redis.call("ZREVRANK", KEYS[2], ARGV[1])
if rank == false then return {1, -1} end
return {1, rank}
`;

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
    // There is deliberately no game-score ceiling. The only rejection here is
    // for values JavaScript cannot represent as a finite non-negative integer.
    if (!Number.isSafeInteger(cleanScore) || cleanScore < 0) {
      return res.status(400).json({ error: "Invalid score" });
    }

    if (body.playerId !== undefined && body.playerId !== cookiePlayerId) {
      return res.status(403).json({ error: "Player identity mismatch" });
    }
    if (body.name !== undefined && String(body.name).trim().toUpperCase() !== player.name) {
      return res.status(403).json({ error: "Callsign is locked" });
    }

    const ip = (req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown").split(",")[0].trim();
    const rlKey = `caderush:rl:${ip}`;
    const rateResult = await redis(["EVAL", RATE_LIMIT_SCRIPT, 1, rlKey, RATE_LIMIT_WINDOW]);
    const count = Number(rateResult.result || 0);
    if (count > RATE_LIMIT_MAX) return res.status(429).json({ error: "Too many submissions — slow down" });

    const runId = typeof body.runId === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(body.runId)
      ? body.runId
      : null;
    if (!runId) return res.status(400).json({ error: "Run identity required" });

    const runKey = `caderush:run:${cookiePlayerId}:${runId}`;
    const result = await redis([
      "EVAL",
      SUBMIT_RUN_SCRIPT,
      2,
      runKey,
      PLAYER_LEADERBOARD_KEY,
      cookiePlayerId,
      cleanScore,
      RUN_TTL,
    ]);

    const values = result.result || [];
    const accepted = Number(values[0]) === 1;
    const rankValue = Number(values[1]);
    const rank = rankValue >= 0 ? rankValue + 1 : null;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      duplicate: !accepted,
      rank,
      name: player.name,
    });
  } catch (err) {
    return res.status(500).json({ error: "Submission failed" });
  }
}
