// /api/leaderboard.js
// Returns the top N scores. Same env vars as submit-score.js.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const LEADERBOARD_KEY = "caderush:leaderboard";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: "Leaderboard not configured — missing Redis env vars" });
  }

  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    // ZRANGE key 0 (limit-1) REV WITHSCORES — highest score first
    const result = await redis(["ZRANGE", LEADERBOARD_KEY, 0, limit - 1, "REV", "WITHSCORES"]);
    const flat = result.result || [];

    const entries = [];
    for (let i = 0; i < flat.length; i += 2) {
      const member = flat[i];
      const score = Number(flat[i + 1]);
      const name = member.split("::")[0] || "DEGEN";
      entries.push({ name, score });
    }

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    return res.status(200).json({ entries });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
}
