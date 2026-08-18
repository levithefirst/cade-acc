// /api/player.js
// Anonymous, server-authoritative CADE OPS player identity.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PLAYER_PREFIX = "caderush:player:";
const PLAYER_NAMES_KEY = "caderush:players:names";
const PLAYER_COOKIE = "__Host-cade_player_id";
const COOKIE_MAX_AGE = 315360000; // 10 years; browser/device installation lifetime
const MIN_NAME_LENGTH = 10;
const MAX_NAME_LENGTH = 16;

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
  if (typeof raw !== "string") return null;
  const normalized = raw.replace(/\s+/g, " ").trim().toUpperCase();
  if (normalized.length < MIN_NAME_LENGTH || normalized.length > MAX_NAME_LENGTH) return null;
  if (!/^[A-Z0-9 _-]+$/.test(normalized)) return null;
  return normalized;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const part = raw.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

function setIdentityCookie(res, playerId) {
  res.setHeader("Set-Cookie", `${PLAYER_COOKIE}=${encodeURIComponent(playerId)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; Secure; HttpOnly; SameSite=Lax`);
}

function sameOrigin(req) {
  const site = req.headers["sec-fetch-site"];
  if (site === "cross-site") return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  const forwardedProto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return origin === `${forwardedProto}://${host}`;
}

function playerKey(playerId) {
  return `${PLAYER_PREFIX}${playerId}`;
}

function validPlayerId(playerId) {
  return typeof playerId === "string" && /^cade_anon_[a-f0-9-]{36}$/.test(playerId);
}

function newPlayerId() {
  return `cade_anon_${crypto.randomUUID()}`;
}

async function createPendingPlayer(res) {
  const playerId = newPlayerId();
  const createdAt = new Date().toISOString();
  await redis(["HSET", playerKey(playerId), "id", playerId, "name", "", "status", "pending", "createdAt", createdAt]);
  setIdentityCookie(res, playerId);
  return { playerId, createdAt };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: "Player service not configured" });
  if (!sameOrigin(req)) return res.status(403).json({ error: "Cross-site request rejected" });

  try {
    const cookiePlayerId = readCookie(req, PLAYER_COOKIE);

    if (req.method === "GET") {
      if (!validPlayerId(cookiePlayerId)) {
        const pending = await createPendingPlayer(res);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ ...pending, registered: false });
      }

      const result = await redis(["HGETALL", playerKey(cookiePlayerId)]);
      const fields = result.result || [];
      if (!fields.length) {
        const pending = await createPendingPlayer(res);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ ...pending, registered: false });
      }
      const player = {};
      for (let i = 0; i < fields.length; i += 2) player[fields[i]] = fields[i + 1];
      if (player.status === "pending" || !player.name) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ playerId: cookiePlayerId, createdAt: player.createdAt, registered: false });
      }
      return res.status(200).json({ playerId: cookiePlayerId, name: player.name, createdAt: player.createdAt, registered: true });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });

    const name = sanitizeName(req.body?.name);
    if (!name) {
      return res.status(400).json({ error: `Callsign must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters using letters, numbers, spaces, _ or -` });
    }

    if (!validPlayerId(cookiePlayerId)) {
      const pending = await createPendingPlayer(res);
      const playerId = pending.playerId;
      const createdAt = pending.createdAt;
      await redis(["HSET", playerKey(playerId), "name", name, "status", "registered"]);
      await redis(["HSET", PLAYER_NAMES_KEY, playerId, name]);
      res.setHeader("Cache-Control", "no-store");
      return res.status(201).json({ playerId, name, createdAt });
    }

    const existing = await redis(["HGETALL", playerKey(cookiePlayerId)]);
    const fields = existing.result || [];
    const player = {};
    for (let i = 0; i < fields.length; i += 2) player[fields[i]] = fields[i + 1];

    if (player.name && player.status === "registered") {
      if (player.name !== name) return res.status(409).json({ error: "Callsign is locked", playerId: cookiePlayerId, name: player.name });
      return res.status(200).json({ playerId: cookiePlayerId, name: player.name, createdAt: player.createdAt, existing: true });
    }

    const createdAt = player.createdAt || new Date().toISOString();
    await redis(["HSET", playerKey(cookiePlayerId), "id", cookiePlayerId, "name", name, "status", "registered", "createdAt", createdAt]);
    await redis(["HSET", PLAYER_NAMES_KEY, cookiePlayerId, name]);
    res.setHeader("Cache-Control", "no-store");
    return res.status(201).json({ playerId: cookiePlayerId, name, createdAt });
  } catch (err) {
    return res.status(500).json({ error: "Player registration failed" });
  }
}
