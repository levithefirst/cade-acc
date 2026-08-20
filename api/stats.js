// /api/stats.js
// Public aggregate CADE OPS statistics. No player identity or raw session data.

const REDIS_URL=process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN=process.env.UPSTASH_REDIS_REST_TOKEN;
const STARTED="caderush:analytics:sessions:started";
const COMPLETED="caderush:analytics:sessions:completed";
const PRESENCE="caderush:analytics:presence";
const ACTIVE=`${STARTED}:active`;
const PLAYER_ACTIVITY="caderush:analytics:players:activity";
const TOTALS="caderush:analytics:totals";
const PLAYER_NAMES="caderush:players:names";
const WINDOW=86400;

async function redis(command){const r=await fetch(REDIS_URL,{method:"POST",headers:{Authorization:`Bearer ${REDIS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify(command)});if(!r.ok)throw new Error(`Redis ${r.status}`);return r.json();}
function sameOrigin(req){if(req.headers["sec-fetch-site"]==="cross-site")return false;const origin=req.headers.origin;if(!origin)return true;const host=req.headers.host;const proto=(req.headers["x-forwarded-proto"]||"https").split(",")[0].trim();return origin===`${proto}://${host}`;}

export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  if(!REDIS_URL||!REDIS_TOKEN)return res.status(500).json({error:"Analytics not configured"});
  if(!sameOrigin(req))return res.status(403).json({error:"Cross-site request rejected"});
  try{
    const now=Math.floor(Date.now()/1000),since=now-WINDOW;
    await redis(["ZREMRANGEBYSCORE",PRESENCE,"-inf",now]);
    await redis(["ZREMRANGEBYSCORE",ACTIVE,"-inf",now]);
    const [online,activeSessions,players24,sessions24,completed24,allSessions,allCompleted,totals,registered]=await Promise.all([
      redis(["ZCOUNT",PRESENCE,now,"+inf"]),
      redis(["ZCOUNT",ACTIVE,now,"+inf"]),
      redis(["ZCOUNT",PLAYER_ACTIVITY,since,"+inf"]),
      redis(["ZCOUNT",STARTED,since,"+inf"]),
      redis(["ZCOUNT",COMPLETED,since,"+inf"]),
      redis(["ZCARD",STARTED]),
      redis(["ZCARD",COMPLETED]),
      redis(["HGETALL",TOTALS]),
      redis(["HLEN",PLAYER_NAMES]),
    ]);
    const f=totals.result||[],t={};for(let i=0;i<f.length;i+=2)t[f[i]]=f[i+1];
    const games=Number(t.gamesCompleted||0),duration=Number(t.totalDurationSec||0),score=Number(t.totalScore||0);
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({
      generatedAt:new Date().toISOString(),
      live:{playersOnline:Number(online.result||0),activeSessions:Number(activeSessions.result||0)},
      last24h:{uniquePlayers:Number(players24.result||0),sessionsStarted:Number(sessions24.result||0),gamesCompleted:Number(completed24.result||0)},
      lifetime:{registeredPlayers:Number(registered.result||0),sessionsStarted:Number(allSessions.result||0),gamesCompleted:Number(allCompleted.result||0)},
      gameplay:{
        totalNerfs:Number(t.totalNerfs||0),totalGrazes:Number(t.totalGrazes||0),totalDashes:Number(t.totalDashes||0),totalPumps:Number(t.totalPumps||0),totalHits:Number(t.totalHits||0),
        survivedFinal:Number(t.survivedFinal||0),fullRosterCompletions:Number(t.fullRosterCompletions||0),highScore:Number(t.highScore||0),highMultiplier:Number(t.highMultiplier||0),
        averageScore:games?Math.round(score/games):0,averageSessionSeconds:games?Math.round(duration/games):0,
      },
    });
  }catch(err){console.error("stats error",err);return res.status(500).json({error:"Stats unavailable"});}
}
