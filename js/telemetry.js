/* ============================================================
   CADE OPS — telemetry.js
   Deliberately crude, per the brief: "even crude" telemetry to watch
   what actual players do with the current player-alone-vs-6-targets
   loop, before any structural changes (character select, teammates,
   stats) get built. No backend, no network calls — everything logs
   to the browser devtools console and persists to localStorage so
   data accumulates across multiple playtest sessions on the same
   device.

   HOW TO READ RESULTS DURING A PLAYTEST SESSION:
   Open devtools console. Every run automatically logs a table when
   it ends. To see aggregate stats across every run logged so far on
   this device, type in the console:
       CadeOpsTelemetry.report()
   To wipe accumulated history and start fresh:
       CadeOpsTelemetry.clear()

   Tracks (per the required list): nerfs per run, unique teams nerfed,
   full-roster completion, dash attempts/hits/hit-rate, nerfs by
   character, multiplier at each nerf, time of first/last nerf, max
   chain length, team lifetime at nerf, team contacts (life loss from
   a team), rug contacts (life loss from a rug), chase-state
   activations, and a periodic sample of active team count.
   ============================================================ */

const STORAGE_KEY = "cadenerf.telemetry.v1";
const MAX_HISTORY = 50;

export const Telemetry = {
  current: null,
  history: [],

  startRun(){
    this.current = {
      startedAt: Date.now(),
      dashAttempts: 0,
      dashHits: 0,
      nerfs: 0,
      uniqueNerfed: new Set(),
      nerfsByCharacter: {},
      multiplierAtNerf: [],
      firstNerfAt: null,
      lastNerfAt: null,
      chainLength: 0,
      maxChainLength: 0,
      teamContacts: 0,
      rugContacts: 0,
      chaseActivations: 0,
      teamLifetimes: [],
      activeTeamsSamples: [],
      sampleTimer: 0,
    };
  },

  dashAttempt(){ if(this.current) this.current.dashAttempts++; },

  nerfEvent(characterId, multiplier, elapsedSeconds, lifetimeSeconds){
    const c = this.current; if(!c) return;
    c.dashHits++;
    c.nerfs++;
    c.uniqueNerfed.add(characterId);
    c.nerfsByCharacter[characterId] = (c.nerfsByCharacter[characterId]||0)+1;
    c.multiplierAtNerf.push(+multiplier.toFixed(2));
    if(c.firstNerfAt===null) c.firstNerfAt = +elapsedSeconds.toFixed(1);
    c.lastNerfAt = +elapsedSeconds.toFixed(1);
    c.chainLength++;
    c.maxChainLength = Math.max(c.maxChainLength, c.chainLength);
    if(lifetimeSeconds!==undefined) c.teamLifetimes.push(+lifetimeSeconds.toFixed(1));
  },

  breakChain(){ if(this.current) this.current.chainLength = 0; },
  teamContact(){ if(this.current) this.current.teamContacts++; },
  rugContact(){ if(this.current) this.current.rugContacts++; },
  chaseActivation(){ if(this.current) this.current.chaseActivations++; },

  // called from the main update loop, throttled internally to ~1/sec so
  // it doesn't produce a 3600-entry array over one 60s run
  sampleActiveTeams(n, dt){
    const c = this.current; if(!c) return;
    c.sampleTimer -= dt;
    if(c.sampleTimer<=0){ c.sampleTimer = 1; c.activeTeamsSamples.push(n); }
  },

  endRun(finalScore, survived){
    const c = this.current; if(!c) return null;
    const durationSec = (Date.now()-c.startedAt)/1000;
    const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

    const summary = {
      timestamp: new Date().toISOString(),
      score: finalScore,
      survived,
      nerfs: c.nerfs,
      uniqueTeamsNerfed: c.uniqueNerfed.size,
      fullRosterCompleted: c.uniqueNerfed.size >= 6,
      dashAttempts: c.dashAttempts,
      dashHits: c.dashHits,
      dashHitRate: c.dashAttempts ? +(c.dashHits/c.dashAttempts).toFixed(2) : 0,
      nerfsByCharacter: {...c.nerfsByCharacter},
      firstNerfAt: c.firstNerfAt,
      lastNerfAt: c.lastNerfAt,
      maxChainLength: c.maxChainLength,
      avgMultiplierAtNerf: +avg(c.multiplierAtNerf).toFixed(2),
      avgTeamLifetimeAtNerf: +avg(c.teamLifetimes).toFixed(1),
      teamContacts: c.teamContacts,
      rugContacts: c.rugContacts,
      chaseActivations: c.chaseActivations,
      avgActiveTeams: +avg(c.activeTeamsSamples).toFixed(1),
      matchDurationSec: +durationSec.toFixed(1),
    };

    this.history.push(summary);
    if(this.history.length > MAX_HISTORY) this.history.shift();
    this._persist();
    this._logSummary(summary);
    this.current = null;
    return summary;
  },

  _persist(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history)); }catch(e){}
  },
  _load(){
    try{ const raw = localStorage.getItem(STORAGE_KEY); this.history = raw ? JSON.parse(raw) : []; }
    catch(e){ this.history = []; }
  },

  _logSummary(s){
    console.log("%c[CADE OPS] Run complete — telemetry logged", "color:#FC8400;font-weight:bold");
    console.table(s);
    console.log("Nerfs by character:", s.nerfsByCharacter);
  },

  // aggregate across every run logged on this device so far — the
  // "nerfs per run" distribution is the single most important number
  // per the playtest brief
  report(){
    if(!this.history.length){ console.log("[CADE OPS] No runs logged yet — play a round first."); return null; }
    const n = this.history.length;
    const avg = key => +(this.history.reduce((a,r)=>a+(r[key]||0),0)/n).toFixed(2);
    const nerfCounts = this.history.map(r=>r.nerfs).sort((a,b)=>a-b);
    const median = nerfCounts[Math.floor(n/2)];

    console.log(`%c[CADE OPS] Aggregate across ${n} run${n===1?"":"s"}`, "color:#FC8400;font-weight:bold");
    console.table({
      "avg nerfs/run":            avg("nerfs"),
      "median nerfs/run":         median,
      "min / max nerfs":          `${nerfCounts[0]} / ${nerfCounts[n-1]}`,
      "avg unique teams nerfed":  avg("uniqueTeamsNerfed"),
      "full-roster completion %":+(this.history.filter(r=>r.fullRosterCompleted).length/n*100).toFixed(0),
      "avg dash hit rate":        avg("dashHitRate"),
      "avg team contacts/run":    avg("teamContacts"),
      "avg rug contacts/run":     avg("rugContacts"),
      "avg chase activations":    avg("chaseActivations"),
      "avg active teams":         avg("avgActiveTeams"),
      "avg max chain length":     avg("maxChainLength"),
      "avg match duration (s)":   avg("matchDurationSec"),
    });
    console.log("Full run-by-run history:", this.history);
    return this.history;
  },

  clear(){ this.history = []; this._persist(); console.log("[CADE OPS] Telemetry history cleared."); },
};

Telemetry._load();

// exposed globally so it's reachable from devtools console during a
// playtest session without needing to dig through the module graph
if(typeof window !== "undefined") window.CadeOpsTelemetry = Telemetry;
