// /api/telemetry.js
// Server-side CADE OPS usage analytics. Aggregate-only stats are exposed by /api/stats.

const REDIS_URL=process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN=process.env.UPSTASH_REDIS_REST_TOKEN;
const PLAYER_PREFIX="caderush:player:";
const PLAYER_COOKIE="__Host-cade_player_id";
const SESSION_PREFIX="caderush:analytics:session:";
const SESSIONS_STARTED="caderush:analytics:sessions:started";
const SESSIONS_COMPLETED="caderush:analytics:sessions:completed";
const PRESENCE="caderush:analytics:presence";
const PLAYER_ACTIVITY="caderush:analytics:players:activity";
const TOTALS="caderush:analytics:totals";
const PRESENCE_TTL=45;
const SESSION_TTL=8*86400;

async function redis(command){
  const r=await fetch(REDIS_URL,{method:"POST",headers:{Authorization:`Bearer ${REDIS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify(command)});
  if(!r.ok)throw new Error(`Redis ${r.status}`);return r.json();
}
function readCookie(req,name){const raw=req.headers.cookie||"";const part=raw.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`));return part?decodeURIComponent(part.slice(name.length+1)):null;}
function validPlayerId(id){return typeof id==="string"&&/^cade_anon_[a-f0-9-]{36}$/.test(id);}
function sameOrigin(req){if(req.headers["sec-fetch-site"]==="cross-site")return false;const origin=req.headers.origin;if(!origin)return true;const host=req.headers.host;const proto=(req.headers["x-forwarded-proto"]||"https").split(",")[0].trim();return origin===`${proto}://${host}`;}
function validSessionId(id){return typeof id==="string"&&/^s-[a-z0-9-]{8,80}$/.test(id);}
function num(v,min=0,max=Number.MAX_SAFE_INTEGER){const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null;}

const END_SCRIPT=`
if redis.call("EXISTS", KEYS[1]) == 0 then return -1 end
if redis.call("HGET", KEYS[1], "ended") == "1" then return 0 end
redis.call("HSET", KEYS[1], "ended", "1", "score", ARGV[1], "duration", ARGV[2], "nerfs", ARGV[3], "grazes", ARGV[4], "dashes", ARGV[5], "pumps", ARGV[6], "hits", ARGV[7], "survived", ARGV[8], "fullRoster", ARGV[9], "maxMulti", ARGV[10], "endedAt", ARGV[11])
redis.call("EXPIRE", KEYS[1], ARGV[12])
redis.call("ZADD", KEYS[2], ARGV[11], ARGV[13])
redis.call("HINCRBY", KEYS[3], "sessionsCompleted", 1)
redis.call("HINCRBY", KEYS[3], "gamesCompleted", 1)
redis.call("HINCRBY", KEYS[3], "totalNerfs", ARGV[3])
redis.call("HINCRBY", KEYS[3], "totalGrazes", ARGV[4])
redis.call("HINCRBY", KEYS[3], "totalDashes", ARGV[5])
redis.call("HINCRBY", KEYS[3], "totalPumps", ARGV[6])
redis.call("HINCRBY", KEYS[3], "totalHits", ARGV[7])
redis.call("HINCRBYFLOAT", KEYS[3], "totalScore", ARGV[1])
redis.call("HINCRBYFLOAT", KEYS[3], "totalDurationSec", ARGV[2])
if ARGV[8] == "1" then redis.call("HINCRBY", KEYS[3], "survivedFinal", 1) end
if ARGV[9] == "1" then redis.call("HINCRBY", KEYS[3], "fullRosterCompletions", 1) end
local high=tonumber(redis.call("HGET", KEYS[3], "highScore") or "0")
if tonumber(ARGV[1]) > high then redis.call("HSET", KEYS[3], "highScore", ARGV[1]) end
local multi=tonumber(redis.call("HGET", KEYS[3], "highMultiplier") or "0")
if tonumber(ARGV[10]) > multi then redis.call("HSET", KEYS[3], "highMultiplier", ARGV[10]) end
return 1
`;

export default async function handler(req,res){
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  if(!REDIS_URL||!REDIS_TOKEN)return res.status(500).json({error:"Analytics not configured"});
  if(!sameOrigin(req))return res.status(403).json({error:"Cross-site request rejected"});
  try{
    const playerId=readCookie(req,PLAYER_COOKIE);
    if(!validPlayerId(playerId))return res.status(401).json({error:"Player registration required"});
    const player=await redis(["HGETALL",`${PLAYER_PREFIX}${playerId}`]);
    const fields=player.result||[];if(!fields.length)return res.status(401).json({error:"Player registration required"});
    const playerFields={};for(let i=0;i<fields.length;i+=2)playerFields[fields[i]]=fields[i+1];
    if(playerFields.status!=="registered"||!playerFields.name)return res.status(401).json({error:"Player registration required"});
    const body=req.body||{},action=String(body.action||""),sessionId=body.sessionId;
    if(sessionId!==undefined&&!validSessionId(sessionId))return res.status(400).json({error:"Invalid session identity"});
    const now=Math.floor(Date.now()/1000),expiry=now+PRESENCE_TTL;

    await redis(["ZADD",PRESENCE,expiry,playerId]);
    await redis(["ZADD",PLAYER_ACTIVITY,now,playerId]);

    if(action==="heartbeat"){
      if(sessionId)await redis(["ZADD",`${SESSIONS_STARTED}:active`,expiry,`${playerId}:${sessionId}`]);
      return res.status(200).json({ok:true,expiresAt:expiry});
    }
    if(action==="start"){
      const key=`${SESSION_PREFIX}${playerId}:${sessionId}`;
      const created=await redis(["SET",key,JSON.stringify({playerId,sessionId,startedAt:now,ended:0}),"EX",String(SESSION_TTL),"NX"]);
      if(created.result==="OK"){
        await redis(["ZADD",SESSIONS_STARTED,now,`${playerId}:${sessionId}`]);
        await redis(["ZADD",`${SESSIONS_STARTED}:active`,expiry,`${playerId}:${sessionId}`]);
        await redis(["HINCRBY",TOTALS,"sessionsStarted",1]);
      }
      return res.status(200).json({ok:true,duplicate:created.result!=="OK"});
    }
    if(action==="end"){
      if(!sessionId)return res.status(400).json({error:"Session identity required"});
      const s=body.summary||{};
      const score=num(s.score,0)??0,duration=num(s.matchDurationSec,0,86400)??0;
      const nerfs=Math.floor(num(s.nerfs,0,1000000)??0),grazes=Math.floor(num(s.grazes,0,1000000)??0);
      const dashes=Math.floor(num(s.dashes,0,1000000)??0),pumps=Math.floor(num(s.pumps,0,1000000)??0),hits=Math.floor(num(s.hits,0,1000000)??0);
      const survived=s.survived?1:0,fullRoster=s.fullRosterCompleted?1:0,maxMulti=num(s.bestMulti,0,1000000)??1;
      const key=`${SESSION_PREFIX}${playerId}:${sessionId}`;
      const result=await redis(["EVAL",END_SCRIPT,3,key,SESSIONS_COMPLETED,TOTALS,score,duration,nerfs,grazes,dashes,pumps,hits,survived,fullRoster,maxMulti,now,SESSION_TTL,`${playerId}:${sessionId}`]);
      const code=Number(result.result);
      if(code===1)await redis(["ZREM",`${SESSIONS_STARTED}:active`,`${playerId}:${sessionId}`]);
      return res.status(code===-1?404:200).json({ok:code===1,duplicate:code===0,error:code===-1?"Session not found":undefined});
    }
    return res.status(400).json({error:"Unknown analytics action"});
  }catch(err){console.error("analytics error",err);return res.status(500).json({error:"Analytics write failed"});}
}
