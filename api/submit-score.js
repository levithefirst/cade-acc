// /api/submit-score.js
// Vercel serverless function — no npm dependencies, plain fetch to the
// Upstash Redis REST API. Requires two env vars set in your Vercel
// project (Settings → Environment Variables):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
// (Both are handed to you the moment you create a free Upstash Redis
// database, or a free Vercel KV store — same thing under the hood.)

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const LEADERBOARD_KEY = "caderush:leaderboard";
const MAX_ENTRIES = 500;          // trim the sorted set so it can't grow unbounded
const MAX_PLAUSIBLE_SCORE = 200000; // generous ceiling — rejects obviously spoofed values
const RATE_LIMIT_WINDOW = 60;      // seconds
const RATE_LIMIT_MAX = 5;          // submissions per IP per window

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

function sanitizeName(raw) {
  if (typeof raw !== "string") return "DEGEN";
  const cleaned = raw.replace(/[^a-zA-Z0-9 _\-]/g, "").trim().slice(0, 16);
  return cleaned.length ? cleaned.toUpperCase() : "DEGEN";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: "Leaderboard not configured — missing Redis env vars" });
  }

  try {
    const { name, score } = req.body || {};
    const cleanScore = Math.round(Number(score));

    if (!Number.isFinite(cleanScore) || cleanScore < 0 || cleanScore > MAX_PLAUSIBLE_SCORE) {
      return res.status(400).json({ error: "Invalid score" });
    }

    const cleanName = sanitizeName(name);

    // lightweight per-IP rate limit — not real anti-cheat, just abuse throttling
    const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
    const rlKey = `caderush:rl:${ip}`;
    const count = await redis(["INCR", rlKey]);
    if (count.result === 1) await redis(["EXPIRE", rlKey, RATE_LIMIT_WINDOW]);
    if (count.result > RATE_LIMIT_MAX) {
      return res.status(429).json({ error: "Too many submissions — slow down" });
    }

    // unique member string (name + timestamp + random) so repeat players
    // don't overwrite their own earlier entries — every run is its own row
    const member = `${cleanName}::${Date.now()}::${Math.random().toString(36).slice(2, 8)}`;
    await redis(["ZADD", LEADERBOARD_KEY, cleanScore, member]);

    // trim to the top MAX_ENTRIES so the set never grows without bound
    await redis(["ZREMRANGEBYRANK", LEADERBOARD_KEY, 0, -(MAX_ENTRIES + 1)]);

    // return the player's rank (1-indexed, highest score = rank 1)
    const rankResult = await redis(["ZREVRANK", LEADERBOARD_KEY, member]);
    const rank = rankResult.result !== null ? rankResult.result + 1 : null;

    return res.status(200).json({ ok: true, rank });
  } catch (err) {
    return res.status(500).json({ error: "Submission failed" });
  }
}
