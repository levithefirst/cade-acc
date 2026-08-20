/* CADE OPS server analytics bridge.
   Browser-local telemetry remains useful for debugging, while these calls make
   product-level usage stats server-authoritative in Upstash Redis. */

const STORAGE_KEY = "cadenerf.telemetry.v2";
const MAX_HISTORY = 50;
const HEARTBEAT_MS = 15000;

async function postServer(payload, keepalive=false){
  try{
    const res = await fetch("/api/telemetry", {
      method:"POST", credentials:"same-origin", cache:"no-store", keepalive,
      headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload),
    });
    if(!res.ok) return null;
    return await res.json().catch(()=>null);
  }catch(e){ return null; }
}

export const Telemetry = {
  current:null, history:[], sessionId:null, lastHeartbeat:0,
  startRun(){
    this.current={startedAt:Date.now(),dashAttempts:0,dashHits:0,nerfs:0,uniqueNerfed:new Set(),nerfsByCharacter:{},multiplierAtNerf:[],firstNerfAt:null,lastNerfAt:null,chainLength:0,maxChainLength:0,teamContacts:0,rugContacts:0,chaseActivations:0,teamLifetimes:[],activeTeamsSamples:[],sampleTimer:0};
    this.sessionId=`s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    postServer({action:"start",sessionId:this.sessionId},false);
  },
  heartbeat(force=false){
    const now=Date.now();
    if(!force&&now-this.lastHeartbeat<HEARTBEAT_MS)return;
    this.lastHeartbeat=now;
    postServer({action:"heartbeat",sessionId:this.sessionId},false);
  },
  dashAttempt(){if(this.current)this.current.dashAttempts++;},
  nerfEvent(characterId,multiplier,elapsedSeconds,lifetimeSeconds){
    const c=this.current;if(!c)return;
    c.dashHits++;c.nerfs++;c.uniqueNerfed.add(characterId);c.nerfsByCharacter[characterId]=(c.nerfsByCharacter[characterId]||0)+1;c.multiplierAtNerf.push(+multiplier.toFixed(2));
    if(c.firstNerfAt===null)c.firstNerfAt=+elapsedSeconds.toFixed(1);c.lastNerfAt=+elapsedSeconds.toFixed(1);c.chainLength++;c.maxChainLength=Math.max(c.maxChainLength,c.chainLength);
    if(lifetimeSeconds!==undefined)c.teamLifetimes.push(+lifetimeSeconds.toFixed(1));
  },
  breakChain(){if(this.current)this.current.chainLength=0;},
  teamContact(){if(this.current)this.current.teamContacts++;},
  rugContact(){if(this.current)this.current.rugContacts++;},
  chaseActivation(){if(this.current)this.current.chaseActivations++;},
  sampleActiveTeams(n,dt){const c=this.current;if(!c)return;c.sampleTimer-=dt;if(c.sampleTimer<=0){c.sampleTimer=1;c.activeTeamsSamples.push(n);}},
  endRun(finalScore,survived,runStats={}){
    const c=this.current;if(!c)return null;const durationSec=(Date.now()-c.startedAt)/1000;const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
    const summary={timestamp:new Date().toISOString(),score:finalScore,survived,nerfs:c.nerfs,uniqueTeamsNerfed:c.uniqueNerfed.size,fullRosterCompleted:c.uniqueNerfed.size>=6,dashAttempts:c.dashAttempts,dashHits:c.dashHits,dashHitRate:c.dashAttempts?+(c.dashHits/c.dashAttempts).toFixed(2):0,nerfsByCharacter:{...c.nerfsByCharacter},firstNerfAt:c.firstNerfAt,lastNerfAt:c.lastNerfAt,maxChainLength:c.maxChainLength,avgMultiplierAtNerf:+avg(c.multiplierAtNerf).toFixed(2),avgTeamLifetimeAtNerf:+avg(c.teamLifetimes).toFixed(1),teamContacts:c.teamContacts,rugContacts:c.rugContacts,chaseActivations:c.chaseActivations,avgActiveTeams:+avg(c.activeTeamsSamples).toFixed(1),matchDurationSec:+durationSec.toFixed(1),grazes:Number(runStats.grazes||0),pumps:Number(runStats.pumps||0),dashes:Number(runStats.dashes||c.dashAttempts||0),hits:Number(runStats.hits||c.teamContacts+c.rugContacts||0),bestMulti:Number(runStats.bestMulti||1)};
    this.history.push(summary);if(this.history.length>MAX_HISTORY)this.history.shift();this._persist();this._logSummary(summary);
    postServer({action:"end",sessionId:this.sessionId,summary},true);this.current=null;this.sessionId=null;return summary;
  },
  _persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.history));}catch(e){}},
  _load(){try{const raw=localStorage.getItem(STORAGE_KEY);this.history=raw?JSON.parse(raw):[];}catch(e){this.history=[];}},
  _logSummary(s){console.log("%c[CADE OPS] Run complete — telemetry logged","color:#FC8400;font-weight:bold");console.table(s);console.log("Nerfs by character:",s.nerfsByCharacter);},
  report(){
    if(!this.history.length){console.log("[CADE OPS] No runs logged yet — play a round first.");return null;}
    const n=this.history.length,avg=key=>+(this.history.reduce((a,r)=>a+(r[key]||0),0)/n).toFixed(2),counts=this.history.map(r=>r.nerfs).sort((a,b)=>a-b);
    console.log(`%c[CADE OPS] Aggregate across ${n} run${n===1?"":"s"}`,"color:#FC8400;font-weight:bold");
    console.table({"avg nerfs/run":avg("nerfs"),"median nerfs/run":counts[Math.floor(n/2)],"min / max nerfs":`${counts[0]} / ${counts[n-1]}`,"avg unique teams nerfed":avg("uniqueTeamsNerfed"),"full-roster completion %":+(this.history.filter(r=>r.fullRosterCompleted).length/n*100).toFixed(0),"avg dash hit rate":avg("dashHitRate"),"avg team contacts/run":avg("teamContacts"),"avg rug contacts/run":avg("rugContacts"),"avg chase activations":avg("chaseActivations"),"avg active teams":avg("avgActiveTeams"),"avg max chain length":avg("maxChainLength"),"avg match duration (s)":avg("matchDurationSec")});
    return this.history;
  },
  clear(){this.history=[];this._persist();console.log("[CADE OPS] Telemetry history cleared.");},
};

Telemetry._load();
if(typeof window!=="undefined"){
  window.CadeOpsTelemetry=Telemetry;
  window.setInterval(()=>Telemetry.heartbeat(false),HEARTBEAT_MS);
  window.addEventListener("pagehide",()=>Telemetry.heartbeat(true),{passive:true});
}
