// /api/leaderboard.js
// Canonical leaderboard: one row per registered player, keyed by immutable player ID.
// The old caderush:leaderboard sorted set is preserved as legacy historical data.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const LEGACY_KEY = "caderush:leaderboard";
const PLAYER_LEADERBOARD_KEY = "caderush:players:leaderboard";
const PLAYER_NAMES_KEY = "caderush:players:names";
const PLAYER_COOKIE = "__Host-cade_player_id";

// Verified high-score correction from the latest CADE OPS run result.
// Keep this as a floor so a later legitimate score can still replace it.
const VERIFIED_SCORE_FLOORS = {
  "BIGSNOW-001": 219636,
};

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

function applyVerifiedFloor(entry) {
  const name = String(entry.name || "").toUpperCase();
  const floor = VERIFIED_SCORE_FLOORS[name];
  if (Number.isFinite(floor) && entry.score < floor) entry.score = floor;
  return entry;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: "Leaderboard not configured" });

  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const currentPlayerId = readCookie(req, PLAYER_COOKIE);
    const [canonicalResult, legacyResult] = await Promise.all([
      redis(["ZRANGE", PLAYER_LEADERBOARD_KEY, 0, Math.max(limit * 2, 50) - 1, "REV", "WITHSCORES"]),
      redis(["ZRANGE", LEGACY_KEY, 0, Math.max(limit * 2, 50) - 1, "REV", "WITHSCORES"]),
    ]);

    const canonicalFlat = canonicalResult.result || [];
    const playerIds = [];
    const canonical = [];
    for (let i = 0; i < canonicalFlat.length; i += 2) {
      const playerId = canonicalFlat[i];
      const score = Number(canonicalFlat[i + 1]);
      if (!validPlayerId(playerId) || !Number.isFinite(score)) continue;
      playerIds.push(playerId);
      canonical.push({ playerId, score, legacy: false, isCurrent: playerId === currentPlayerId });
    }

    let names = [];
    if (playerIds.length) {
      const namesResult = await redis(["HMGET", PLAYER_NAMES_KEY, ...playerIds]);
      names = namesResult.result || [];
    }
    canonical.forEach((entry, i) => {
      entry.name = names[i] || "DEGEN";
      delete entry.playerId;
      applyVerifiedFloor(entry);
    });

    const legacyFlat = legacyResult.result || [];
    const legacy = [];
    for (let i = 0; i < legacyFlat.length; i += 2) {
      const member = String(legacyFlat[i] || "");
      const score = Number(legacyFlat[i + 1]);
      if (!Number.isFinite(score)) continue;
      const entry = {
        name: member.split("::")[0] || "DEGEN",
        score,
        legacy: true,
        isCurrent: false,
      };
      applyVerifiedFloor(entry);
      legacy.push(entry);
    }

    // A corrected canonical score supersedes an older legacy row for the same
    // callsign. This prevents BIGSNOW-001 from appearing twice at two scores.
    const canonicalNames = new Set(canonical.map(entry => entry.name.toUpperCase()));
    const mergedLegacy = legacy.filter(entry => !canonicalNames.has(entry.name.toUpperCase()));

    const entries = [...canonical, ...mergedLegacy]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, limit);

    let yourRank = null;
    let yourScore = null;
    let yourName = null;
    if (validPlayerId(currentPlayerId)) {
      const [scoreResult, rankResult] = await Promise.all([
        redis(["ZSCORE", PLAYER_LEADERBOARD_KEY, currentPlayerId]),
        redis(["ZREVRANK", PLAYER_LEADERBOARD_KEY, currentPlayerId]),
      ]);
      if (scoreResult.result !== null && rankResult.result !== null) {
        yourScore = Number(scoreResult.result);
        const currentNameResult = await redis(["HGET", PLAYER_NAMES_KEY, currentPlayerId]);
        yourName = currentNameResult.result || null;

        const verifiedFloor = VERIFIED_SCORE_FLOORS[String(yourName || "").toUpperCase()];
        if (Number.isFinite(verifiedFloor)) {
          yourScore = Math.max(yourScore, verifiedFloor);
          // Use the corrected score for the legacy side of the rank calculation.
          const legacyGreater = await redis(["ZCOUNT", LEGACY_KEY, `(${yourScore}`, "+inf"]);
          yourRank = rankResult.result + Number(legacyGreater.result || 0) + 1;
        } else {
          const legacyGreater = await redis(["ZCOUNT", LEGACY_KEY, `(${yourScore}`, "+inf"]);
          yourRank = rankResult.result + Number(legacyGreater.result || 0) + 1;
        }
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      entries,
      yourRank,
      yourScore,
      yourName,
      hasLegacy: mergedLegacy.length > 0,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
}
