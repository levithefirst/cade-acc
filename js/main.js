/* ============================================================
   CADE OPS — main.js
   HOW TO RUN: serve this folder over HTTP (ES modules can't load from
   file://). Locally: `npx serve .` or `python3 -m http.server`, then
   open index.html. On Vercel: zero config, it just deploys — the /api
   folder is auto-detected as serverless functions, everything else is
   served as static files.

   HOW TO ADD A NEW TEAM CHARACTER: see the big comment block at the
   top of teams.js — every character is one entry in the TEAM_ROSTER
   array with a draw function, a handful of stat overrides, and a
   personality line. Nothing outside teams.js needs to change.

   *** CIRCULAR IMPORT NOTE — READ BEFORE "FIXING" ANYTHING ***
   This file exports live bindings (ctx, W, H, S, Game, Input, Theme)
   that almost every other module needs, and it imports the systems
   it needs to drive the game loop (Player, Rugs, Pumps, Teams,
   particles, audio, ui). That makes the import graph circular:
   main.js <-> player.js, main.js <-> teams.js, main.js <-> ui.js, etc.

   This is SAFE in ES modules as long as nothing touches an imported
   binding at module-evaluation time — only inside function bodies
   that run later, once every module has finished loading. Every file
   here follows that rule (all cross-module access happens inside
   methods like update()/draw()/collisions(), never at a file's top
   level). Add new logic the same way and you won't hit a "used
   before initialization" error.
   ============================================================ */

import { CFG, rnd, rint, lerp, clamp, pick, TAU } from "./config.js";
import { Player } from "./player.js";
import { Rugs } from "./rugs.js";
import { Pumps } from "./pumps.js";
import { Teams } from "./teams.js";
import { Telemetry } from "./telemetry.js";
import { FX, Parts, Rings, Floaters, Ambient } from "./particles.js";
import { SFX, Music, Haptics, AudioCore } from "./audio.js";
import {
  drawTimer, drawHUD, drawFreeze, drawOut, drawFinalRug,
  dashBtn, paintDomMarks, startRun, showResults,
  paintTitleHighScore, initSound, initTheme, paintRosterShowcase
} from "./ui.js";
import { initPlayerName } from "./leaderboard.js";

/* ============================================================
   STORAGE — localStorage w/ safe in-memory fallback.
   ============================================================ */
export const Store = (()=>{
  let mem = null, ok = true;
  const blank = {high:0, runs:0, bestMulti:0, bestGrazes:0, survivals:0, bestNerfs:0, sound:true, theme:"dark", playerName:"", nameChangesUsed:0};
  try{ const t="__t"; localStorage.setItem(t,"1"); localStorage.removeItem(t); }
  catch(e){ ok=false; }
  function read(){
    if(!ok) return mem ? {...mem} : {...blank};
    try{ return {...blank, ...JSON.parse(localStorage.getItem(CFG.STORE_KEY)||"{}")}; }
    catch(e){ return {...blank}; }
  }
  function write(o){
    if(!ok){ mem = {...o}; return; }
    try{ localStorage.setItem(CFG.STORE_KEY, JSON.stringify(o)); }catch(e){ mem={...o}; }
  }
  return {read, write};
})();

/* ============================================================
   THEME
   "light" mode is the bright-gold theme (see the CSS token block for
   the actual palette) — the old flat/muddy tan light-theme issue this
   comment used to flag is resolved; that theme no longer exists.
   ============================================================ */
export const Theme = {
  mode: "dark",
  colors(){
    return this.mode === "light"
      ? { bg:"#FFB514", grid:"rgba(20,15,5,.07)", text:"#141414", cade:"#FFA800", yellow:"#141414", dim:"#2F2F2F", cut:"#FFB514" }
      : { bg:"#141414", grid:"rgba(255,168,0,.045)", text:"#FFFFFF", cade:"#FFA800", yellow:"#F0F024", dim:"#8A8A8A", cut:"#141414" };
  },
  apply(mode){
    this.mode = mode==="light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", this.mode);
    const sunPath = '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12h2.5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>';
    const moonPath = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
    const svgHTML = this.mode==="light" ? sunPath : moonPath;
    const it = document.getElementById("themeIconTitle"), ie = document.getElementById("themeIconEnd");
    if(it) it.innerHTML = svgHTML;
    if(ie) ie.innerHTML = svgHTML;
    paintDomMarks();
  }
};

/* ============================================================
   CANVAS / VIEWPORT — live-exported so every module reads the current
   value automatically via ES module live bindings.
   ============================================================ */
export const cv = document.getElementById("cv");
export const ctx = cv.getContext("2d");
export let W=0, H=0, DPR=1, S=1;

function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width  = Math.floor(W*DPR);
  cv.height = Math.floor(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  S = clamp(Math.min(W,H)/760, 0.62, 1.25);
}
window.addEventListener("resize", resize, {passive:true});
window.addEventListener("orientationchange", ()=>setTimeout(resize,120));
resize();

const scanPattern = (()=>{
  const pc = document.createElement("canvas"); pc.width=2; pc.height=3;
  const pg = pc.getContext("2d");
  pg.fillStyle="rgba(0,0,0,0)"; pg.fillRect(0,0,2,3);
  pg.fillStyle="rgba(0,0,0,.16)"; pg.fillRect(0,0,2,1);
  return ctx.createPattern(pc, "repeat");
})();

const grainPattern = (()=>{
  const n=64;
  const pc = document.createElement("canvas"); pc.width=n; pc.height=n;
  const pg = pc.getContext("2d");
  const img = pg.createImageData(n,n);
  for(let i=0;i<img.data.length;i+=4){
    const v = 128 + (Math.random()*70-35)|0;
    img.data[i]=v; img.data[i+1]=v; img.data[i+2]=v; img.data[i+3]=18;
  }
  pg.putImageData(img,0,0);
  return ctx.createPattern(pc, "repeat");
})();

export function lifeIconPos(i){
  const lx0 = 18*S, ly = 16*S+52*S, lsz = 12*S, lgap = 18*S;
  return { x: lx0 + i*lgap + lsz/2, y: ly + lsz/2, size: lsz };
}

/* ============================================================
   INPUT
   ============================================================ */
export const Input = {
  keys:{}, pointer:{x:0,y:0,active:false}, mode:"key",
  dashQueued:false, lastTap:0, isTouch:false
};
addEventListener("keydown", e=>{
  const k = e.key.toLowerCase();
  Input.keys[k]=true;
  if(k===" "||e.code==="Space"){ e.preventDefault(); Input.dashQueued=true; }
  if(k==="w"||k==="a"||k==="s"||k==="d"||k.startsWith("arrow")){ Input.mode="key"; e.preventDefault(); }
  if(k==="enter" && (Game.scene==="title"||Game.scene==="results")) startRun();
});
addEventListener("keyup", e=>{ Input.keys[e.key.toLowerCase()]=false; });

cv.addEventListener("mousemove", e=>{
  Input.mode="pointer"; Input.isTouch=false; Input.pointer.x=e.clientX; Input.pointer.y=e.clientY; Input.pointer.active=true;
});
cv.addEventListener("mousedown", e=>{ if(e.button===0) Input.dashQueued=true; });
cv.addEventListener("mouseleave", ()=>{ Input.pointer.active=false; });

function touchXY(e){ const t=e.touches[0]||e.changedTouches[0]; return {x:t.clientX,y:t.clientY}; }
cv.addEventListener("touchstart", e=>{
  e.preventDefault();
  SFX.unlock();
  const now = performance.now();
  if(now - Input.lastTap < 260) Input.dashQueued = true;
  Input.lastTap = now;
  const p = touchXY(e); Input.mode="pointer"; Input.isTouch=true; Input.pointer.x=p.x; Input.pointer.y=p.y; Input.pointer.active=true;
},{passive:false});
cv.addEventListener("touchmove", e=>{
  e.preventDefault();
  const p = touchXY(e); Input.pointer.x=p.x; Input.pointer.y=p.y;
},{passive:false});
cv.addEventListener("touchend", e=>{ e.preventDefault(); },{passive:false});

// tab-blur handling — pause the delta-time clock rather than let a
// multi-second tab-away turn into one giant simulation step
let tabHidden = false;
document.addEventListener("visibilitychange", ()=>{ tabHidden = document.hidden; });

/* ============================================================
   GAME — the central state machine.

   WHAT CHANGED FROM CADE RUSH: the primary objective is now nerfing
   Teams, not just dodging Rugs. Rugs stay in as a secondary hazard
   exactly per the brief. Key new pieces:
     - stats.nerfs is the headline score metric
     - collisions() gained a Teams pass: dash-through nerfs (with a
       CONTINUOUS swept check so a fast dash can't tunnel through a
       team member between frames), plain contact costs a life same
       as a rug would (teams are both the objective AND a hazard —
       that tension is the point)
     - spawnLogic() now also keeps CFG.TEAM_COUNT_ACTIVE-ish team
       members alive on the field, scaling lightly with difficulty,
       and the final-15s meltdown biases toward MORE teams+rugs
       rather than teams alone
   Everything else (multiplier, energy boost, hitstop, meltdown
   pressure tide, final rug) is byte-for-byte the same rules as before.
   ============================================================ */
export const Game = {
  scene:"title",            // title | play | freeze | finalrug | out | results
  time:CFG.RUN_SECONDS,
  score:0, multi:1, multiTimer:0, bestMulti:1,
  meltdown:false, spawnTimer:0, difficulty:0,
  sceneT:0, finalRug:null, survivedFinal:false,
  bgPulse:0, hitstop:0,
  grazeStreak:0, bestStreak:0,
  pressureY:1e9, pressureHitCd:0, burstTimer:0, finalRugHold:0,
  finalRugOutcome:null, survivalTime:0, runStartedAt:0,
  lives:CFG.LIVES, diedEarly:false, deathTime:0, lastTickSec:999, lastTier:-1,
  energy:0, pumpStreak:0, boosted:false,
  teamSpawnTimer:0,
  stats:{grazes:0, pumps:0, hits:0, dashes:0, shredded:0, spawned:0, bigPumps:0, nerfs:0, firstHitAt:null},

  reset(){
    this.time=CFG.RUN_SECONDS; this.score=0; this.multi=1; this.multiTimer=0;
    this.bestMulti=1; this.meltdown=false; this.spawnTimer=0; this.difficulty=0;
    this.sceneT=0; this.finalRug=null; this.survivedFinal=false;
    this.hitstop=0; this.grazeStreak=0; this.bestStreak=0;
    this.pressureY=1e9; this.pressureHitCd=0; this.burstTimer=0; this.finalRugHold=0;
    this.finalRugOutcome=null; this.survivalTime=0; this.runStartedAt=performance.now();
    this.lives=CFG.LIVES; this.diedEarly=false; this.deathTime=0; this.lastTickSec=999; this.lastTier=-1;
    this.energy=0; this.pumpStreak=0; this.boosted=false; this.teamSpawnTimer=0;
    // per-run archetype bias — each run leans toward one hazard type more
    // than usual (never WHALE, which stays rare/conditional on purpose).
    // Not announced; the player reads it through the first ~10s of play,
    // same as any other arcade game's procedural seed would present.
    this.runBias = pick(["DUMP","WICK","LIQUIDATION","FAKEOUT"]);
    this.stats={grazes:0,pumps:0,hits:0,dashes:0,shredded:0,spawned:0,bigPumps:0,nerfs:0,firstHitAt:null};
    Rugs.clear(); Pumps.clear(); Teams.clear(); Parts.clear(); Floaters.clear(); Rings.clear(); FX.reset();
    Player.reset();
    Teams.spawnWave(4); // arena should never open empty
    Telemetry.startRun();
  },

  addScore(n, x, y, label){
    n = Math.round(n);
    this.score += n;
    if(x!==undefined) Floaters.add(x, y-22*S, (label?label+" ":"+")+n, "#FFA800", label?15:19);
  },

  bumpMulti(x,y){
    this.multi = Math.min(CFG.MULTI_MAX, this.multi + CFG.MULTI_STEP);
    this.multiTimer = CFG.MULTI_GRACE;
    this.bestMulti = Math.max(this.bestMulti, this.multi);
    this.stats.grazes++;
    this.grazeStreak++;
    this.bestStreak = Math.max(this.bestStreak, this.grazeStreak);
    this.addScore(CFG.GRAZE_BASE*this.multi, x, y, "GRAZE");

    const milestone = CFG.STREAK_MILESTONES.includes(this.grazeStreak);
    this.hitstop = Math.max(this.hitstop, milestone ? CFG.HITSTOP_STREAK : CFG.HITSTOP_GRAZE);
    FX.kick(3.2+Math.min(9,this.multi*0.45)+(milestone?7:0));
    FX.glitchHit(0.35+Math.min(0.5,this.multi*0.04)+(milestone?0.35:0));
    FX.chroma = Math.min(1, 0.3+this.multi*0.06);
    FX.vignette(milestone?0.5:0.16+Math.min(0.14,this.multi*0.012), milestone?Theme.colors().yellow:"#FFA800");
    Parts.spawn(x,y, milestone?10:4, {c:milestone?Theme.colors().yellow:"#FFA800",smin:60,smax:milestone?360:200,lmin:.15,lmax:.4,spark:true});
    Rings.spawn(x,y,{r0:6,max:milestone?70:34,dur:milestone?0.5:0.3,c:milestone?Theme.colors().yellow:"#FFA800",w:milestone?4:2});
    SFX.graze(this.multi); Haptics.graze();

    if(milestone){
      this.addScore(CFG.STREAK_BONUS*(1+this.grazeStreak*0.08), x, y-18*S, `STREAK x${this.grazeStreak}`);
      Floaters.add(x, y-46*S, `x${this.grazeStreak} STREAK`, Theme.colors().yellow, 20);
      FX.invertHit(0.4);
      SFX.streak(this.grazeStreak);
    }
  },

  onHit(){
    if(Player.iframes>0 || Player.dash>0) return;
    this.stats.hits++;
    if(this.stats.firstHitAt===null) this.stats.firstHitAt = this.time;
    this.multi = Math.max(1, this.multi*CFG.MULTI_HIT_KEEP);
    this.multiTimer = 0;
    this.grazeStreak = 0;
    this.pumpStreak = 0; this.energy = 0; this.boosted = false;
    this.lives = Math.max(0, this.lives-1);
    Player.iframes = CFG.HIT_IFRAMES;
    this.hitstop = Math.max(this.hitstop, CFG.HITSTOP_HIT);
    FX.kick(26); FX.invertHit(0.9); FX.glitchHit(1.4); FX.flashHit(0.55); FX.vignette(0.6, "#FF2A2A");
    Parts.spawn(Player.x,Player.y,34,{c:"#FF2A2A",smin:120,smax:520,rmin:2,rmax:5});
    Rings.spawn(Player.x,Player.y,{r0:8,max:120,dur:0.5,c:"#FF2A2A",w:5});
    Floaters.add(Player.x, Player.y-30*S, "RUGGED", "#FF2A2A", 26);
    SFX.hit(); Haptics.hit();

    const brokenIcon = lifeIconPos(this.lives);
    Parts.spawn(brokenIcon.x, brokenIcon.y, 10, {c:"#FFFFFF", smin:40, smax:140, lmin:.2, lmax:.4, rmin:1, rmax:2.5, spark:true});
    Rings.spawn(brokenIcon.x, brokenIcon.y, {r0:3, max:22, dur:0.35, c:"rgba(255,255,255,.6)", w:1.5});

    if(this.lives<=0 && this.scene==="play" && !this.diedEarly){
      this.diedEarly = true;
      this.survivedFinal = false;
      this.deathTime = CFG.RUN_SECONDS - this.time;
      this.scene = "out"; this.sceneT = 0;
      FX.kick(40); FX.invertHit(1); FX.flashHit(1); FX.glitchHit(2.2); this.hitstop = CFG.HITSTOP_FINAL;
      // ember burst — the "mission failed" moment gets real drifting sparks,
      // not just a screen flash, matching the reference's particle language
      Parts.spawn(Player.x, Player.y, 40, {c:"#FF2A2A", smin:60, smax:340, lmin:.5, lmax:1.1, rmin:1.5, rmax:3.5, spark:true, g:40});
      Parts.spawn(Player.x, Player.y, 20, {c:"#FF8A3D", smin:30, smax:180, lmin:.6, lmax:1.3, rmin:1, rmax:2.2, g:60});
      SFX.lifeLost(); SFX.lose(); Haptics.lifeLost();
    }
  },

  /* --- difficulty curve --- */
  spawnLogic(dt){
    const elapsed = CFG.RUN_SECONDS - this.time;

    const tier = Math.min(5, Math.floor(elapsed / 10));
    this.difficulty = tier / 5;
    if(tier !== this.lastTier && this.lastTier >= 0){
      FX.kick(10); FX.chroma = Math.max(FX.chroma, 0.4);
      Floaters.add(W/2, H*0.14, "HEATING UP", Theme.colors().yellow, 22);
      SFX.tick(false);
    }
    this.lastTier = tier;

    const wasMelt = this.meltdown;
    this.meltdown = this.time <= CFG.MELTDOWN_AT;
    if(this.meltdown && !wasMelt){
      FX.invertHit(1); FX.kick(22); FX.glitchHit(1.6);
      Floaters.add(W/2, H*0.4, "MELTDOWN", "#FF2A2A", 46);
      Music.setIntensity("meltdown");
      Haptics.meltdown();
    }

    let rate = lerp(CFG.SPAWN_RATE_START, CFG.SPAWN_RATE_MID, this.difficulty);
    if(this.meltdown){
      const m = 1 - (this.time/CFG.MELTDOWN_AT);
      rate = lerp(CFG.SPAWN_RATE_MID, CFG.SPAWN_RATE_MELT_END, m);
    }

    this.spawnTimer -= dt;
    if(this.spawnTimer<=0){
      this.spawnTimer = rate*rnd(0.75,1.25);
      this.spawnOne();
      if(this.meltdown && Math.random()<0.45) this.spawnOne();
    }

    if(this.time <= CFG.BURST_AT){
      this.burstTimer -= dt;
      if(this.burstTimer<=0){
        this.burstTimer = CFG.BURST_INTERVAL;
        for(let i=0;i<CFG.BURST_COUNT;i++) this.spawnOne();
        FX.kick(9); FX.chroma = Math.max(FX.chroma, 0.5);
        Floaters.add(W/2, H*0.16, "INCOMING", "#FF2A2A", 20);
      }
    }

    // keep the arena stocked with team leaders — target count scales
    // lightly with difficulty (brief: "spawn 4-6 at once, scale with
    // difficulty"), meltdown biases toward the higher end
    this.teamSpawnTimer -= dt;
    const targetActive = Math.round(lerp(4, 6, this.meltdown ? 1 : this.difficulty));
    if(this.teamSpawnTimer<=0 && Teams.activeCount() < targetActive){
      Teams.spawn();
      this.teamSpawnTimer = rnd(0.6, 1.4);
    }
    Telemetry.sampleActiveTeams(Teams.activeCount(), dt);
  },

  spawnOne(){
    const d = this.difficulty;
    const bag = [];
    bag.push("DUMP","DUMP","DUMP");
    if(d>0.10) bag.push("WICK","WICK");
    if(d>0.28) bag.push("LIQUIDATION","LIQUIDATION");
    if(d>0.45) bag.push("FAKEOUT");
    if(d>0.55 && Math.random()<0.35) bag.push("WHALE");
    if(this.meltdown) bag.push("WICK","LIQUIDATION","FAKEOUT");
    // per-run bias — only leans toward an archetype that's already
    // legitimately unlocked at this difficulty, never forces one early
    if(this.runBias && bag.includes(this.runBias)) bag.push(this.runBias, this.runBias);
    const r = Rugs.spawn(pick(bag));
    if(r) this.stats.spawned++;
  },

  /* --- collision + graze --- */
  collisions(){
    for(const r of Rugs.pool){
      if(!r.on) continue;
      const dx = Player.x-r.x, dy = Player.y-r.y;
      const d  = Math.hypot(dx,dy);
      const touch = Player.r + r.r;

      if(d < touch){
        if(Player.dash>0){ Rugs.destroy(r, true); }
        else if(Player.iframes>0){ /* pass through */ }
        else { Telemetry.rugContact(); Telemetry.breakChain(); this.onHit(); Rugs.destroy(r, false); }
        continue;
      }
      if(!r.grazed && d < touch + CFG.NEAR_BAND*S){
        r.grazed = true;
        this.bumpMulti((Player.x+r.x)/2, (Player.y+r.y)/2);
      }
    }

    // --- Teams: dash-through nerfs, plain contact costs a life ---
    // Dash uses a CONTINUOUS swept check (segment from last frame's
    // position to this frame's) so a fast dash can't tunnel through a
    // team member's hitbox between frames — a real risk at
    // CFG.DASH_SPEED=1250 against CFG.TEAM_R's small hitbox.
    for(const t of Teams.pool){
      if(!t.on || t.disabled) continue;
      const touch = Player.r + t.r;

      if(Player.dash>0){
        if(segmentCircleHit(Player.prevX,Player.prevY, Player.x,Player.y, t.x,t.y, touch)){
          Teams.nerf(t);
        }
        continue;
      }

      const d = Math.hypot(Player.x-t.x, Player.y-t.y);
      if(d < touch){
        if(Player.iframes>0){ /* pass through */ }
        else { Telemetry.teamContact(); Telemetry.breakChain(); this.onHit(); }
        continue;
      }
      if(!t.grazed && d < touch + CFG.NEAR_BAND*S){
        t.grazed = true; t.grazeCooldown = 0.5;
        this.bumpMulti((Player.x+t.x)/2, (Player.y+t.y)/2);
      }
    }

    for(const p of Pumps.pool){
      if(!p.on) continue;
      if(Math.hypot(Player.x-p.x, Player.y-p.y) < Player.r+p.r+4*S){
        p.on=false; this.stats.pumps++;
        const big = this.multi >= CFG.BIG_PUMP_MULTI;
        const payout = CFG.PUMP_BASE*this.multi*(big?CFG.BIG_PUMP_MULT:1);
        this.addScore(payout, p.x, p.y, big?"BIG PUMP":undefined);
        this.hitstop = Math.max(this.hitstop, big?CFG.HITSTOP_STREAK:CFG.HITSTOP_PUMP);
        if(big){
          this.stats.bigPumps = (this.stats.bigPumps||0)+1;
          Parts.spawn(p.x,p.y,26,{c:Theme.colors().yellow,smin:120,smax:420,rmin:2,rmax:5,spark:true});
          Rings.spawn(p.x,p.y,{r0:8,max:64,dur:0.4,c:Theme.colors().yellow,w:3.5});
          FX.invertHit(0.25); FX.vignette(0.4, Theme.colors().yellow);
          SFX.bigPump();
        } else {
          Parts.spawn(p.x,p.y,16,{c:"#3DC96B",smin:90,smax:320,rmin:2,rmax:4});
          Rings.spawn(p.x,p.y,{r0:6,max:38,dur:0.28,c:"#3DC96B",w:2.5});
          FX.vignette(0.20, "#3DC96B");
          SFX.pump();
        }
        FX.kick(big?9:4); FX.chroma=Math.max(FX.chroma, big?0.6:0.4);

        if(!this.boosted){
          this.pumpStreak++;
          this.energy = Math.min(1, this.pumpStreak/CFG.ENERGY_FILL_PUMPS);
          if(this.energy>=1 && !this.boosted){
            this.boosted = true;
            this.pumpStreak = 0;
            FX.kick(14); FX.chroma = Math.max(FX.chroma, 0.7); FX.invertHit(0.3);
            Floaters.add(Player.x, Player.y-40*S, "ENERGY FULL", Theme.colors().yellow, 20);
            SFX.boost(); Haptics.boost();
          }
        }
      }
    }
  },

  launchFinalRug(){
    const side = rint(0,3);
    const r = {r:78*S, x:0, y:0, vx:0, vy:0, hit:false, born:0};
    const m = r.r+90*S;
    if(side===0){ r.x=Player.x; r.y=-m; }
    else if(side===1){ r.x=W+m; r.y=Player.y; }
    else if(side===2){ r.x=Player.x; r.y=H+m; }
    else { r.x=-m; r.y=Player.y; }
    const a = Math.atan2(Player.y-r.y, Player.x-r.x);
    const sp = 860*S;
    r.vx=Math.cos(a)*sp; r.vy=Math.sin(a)*sp;
    this.finalRug = r;
    FX.kick(30); FX.invertHit(1); FX.glitchHit(2);
  },

  update(dt){
    this.bgPulse += dt;
    FX.update(dt);
    Parts.update(dt); Floaters.update(dt);

    if(Input.dashQueued){ Input.dashQueued=false; if(this.scene==="play"||this.scene==="finalrug") Player.tryDash(); }

    Rings.update(dt);

    let gdt = dt;
    if(this.hitstop>0){ this.hitstop -= dt; gdt *= CFG.HITSTOP_SCALE; }

    if(this.scene==="play"){
      this.time -= gdt;

      const secNow = Math.ceil(this.time);
      if(this.time<=10 && this.time>0 && secNow!==this.lastTickSec){
        this.lastTickSec = secNow; SFX.tick(true);
      }

      if(this.multiTimer>0) this.multiTimer -= gdt;
      else {
        const before = this.multi;
        this.multi = Math.max(1, this.multi - CFG.MULTI_DECAY*gdt);
        if(this.multi<=1 && before>1) this.grazeStreak = 0;
      }

      if(this.boosted){
        this.energy -= gdt/CFG.ENERGY_DRAIN_TIME;
        if(this.energy<=0){ this.energy=0; this.boosted=false; this.pumpStreak=0; }
      }

      const meltFrac = this.meltdown ? clamp(1-(this.time/CFG.MELTDOWN_AT),0,1) : 0;
      this.pressureY = lerp(H*CFG.PRESSURE_START_FRAC, H*CFG.PRESSURE_END_FRAC, meltFrac);
      if(this.pressureHitCd>0) this.pressureHitCd -= gdt;
      if(this.meltdown && Player.y > this.pressureY && Player.iframes<=0 && Player.dash<=0){
        if(this.pressureHitCd<=0){
          this.pressureHitCd = CFG.PRESSURE_HIT_CD;
          Telemetry.breakChain();
          this.onHit();
          Floaters.add(Player.x, Player.y-50*S, "LIQUIDATED", "#FF2A2A", 18);
        }
      }

      this.spawnLogic(gdt);
      Player.update(gdt);
      Rugs.update(gdt);
      Pumps.update(gdt);
      Teams.update(gdt);
      this.collisions();

      if(this.time<=0 && this.scene==="play"){
        this.time=0; this.scene="freeze"; this.sceneT=0;
        this.hitstop = Math.max(this.hitstop, CFG.HITSTOP_FINAL*0.5);
        FX.kick(14); FX.flashHit(0.7);
      }
    }
    else if(this.scene==="out"){
      this.sceneT += dt;
      Player.update(dt);
      Teams.update(dt);
      if(this.sceneT >= 0.9) this.endRun();
    }
    else if(this.scene==="freeze"){
      this.sceneT += dt;
      Player.update(dt*0.15);
      if(this.sceneT >= CFG.FREEZE_SECONDS){
        this.scene="finalrug"; this.sceneT=0; Rugs.clear(); Pumps.clear(); Teams.clear();
        this.launchFinalRug();
      }
    }
    else if(this.scene==="finalrug"){
      this.sceneT += dt;
      Player.update(dt);
      const r = this.finalRug;
      r.born = Math.min(1, r.born+dt*6);
      r.x += r.vx*dt; r.y += r.vy*dt;
      if(Math.random()<0.6) Parts.spawn(r.x,r.y,2,{c:"#FF2A2A",smin:30,smax:140,lmin:.2,lmax:.5});

      if(!r.hit && Math.hypot(Player.x-r.x, Player.y-r.y) < Player.r+r.r*0.82){
        r.hit = true;
        this.finalRugHold = 0.65;
        if(Player.dash>0){
          this.survivedFinal=true; this.finalRugOutcome="dashed";
          Parts.spawn(r.x,r.y,60,{c:"#FFA800",smin:150,smax:700,rmin:2,rmax:6,spark:true});
          Rings.spawn(r.x,r.y,{r0:r.r*0.5,max:r.r*6,dur:0.6,c:"#FFA800",w:6});
          this.hitstop = CFG.HITSTOP_FINAL;
          FX.kick(34); FX.invertHit(1);
          SFX.win(); Haptics.finalWin();
        } else {
          this.survivedFinal=false; this.finalRugOutcome="rugged";
          if(this.stats.firstHitAt===null) this.stats.firstHitAt = 0;
          Parts.spawn(Player.x,Player.y,60,{c:"#FF2A2A",smin:150,smax:700,rmin:2,rmax:6});
          Rings.spawn(Player.x,Player.y,{r0:10,max:r.r*6,dur:0.6,c:"#FF2A2A",w:6});
          this.hitstop = CFG.HITSTOP_FINAL;
          FX.kick(34); FX.invertHit(1); FX.flashHit(1);
          SFX.lose(); Haptics.finalLose();
        }
      }
      if(r.hit){
        this.finalRugHold -= dt;
        if(this.finalRugHold<=0) this.endRun();
      }
      else if(this.sceneT > CFG.FINAL_RUG_WINDOW){
        this.survivedFinal = true;
        this.finalRugOutcome = "dodged";
        SFX.win(); Haptics.finalWin();
        this.endRun();
      }
    }
  },

  endRun(){
    if(this.diedEarly){
      this.survivalTime = this.deathTime;
    } else {
      this.score += CFG.SURVIVE_BONUS;
      if(this.survivedFinal) this.score += CFG.PERFECT_BONUS;
      this.survivalTime = CFG.RUN_SECONDS + CFG.FREEZE_SECONDS + this.sceneT;
    }
    this.scene = "results";
    Music.setIntensity("calm");
    Music.duck(0.22);
    Telemetry.endRun(Math.round(this.score), this.survivedFinal);
    showResults();
  }
};

// continuous circle-vs-moving-circle check — closest point on the
// (x0,y0)->(x1,y1) segment to (cx,cy), compared against rSum. This is
// what makes the dash-nerf collision immune to tunneling regardless of
// how far the player moves in one frame.
function segmentCircleHit(x0,y0,x1,y1, cx,cy, rSum){
  const dx=x1-x0, dy=y1-y0;
  const len2 = dx*dx+dy*dy;
  if(len2 < 0.0001) return Math.hypot(cx-x0,cy-y0) < rSum;
  let t = ((cx-x0)*dx + (cy-y0)*dy) / len2;
  t = clamp(t,0,1);
  const px = x0+dx*t, py = y0+dy*t;
  return Math.hypot(cx-px, cy-py) < rSum;
}

/* ============================================================
   RENDER PIPELINE
   ============================================================ */
function drawBackground(){
  const tc = Theme.colors();
  ctx.fillStyle = tc.bg;
  ctx.fillRect(0,0,W,H);

  const heat = Game.meltdown ? clamp(1-(Game.time/CFG.MELTDOWN_AT),0,1) : 0;

  // grid
  const step = 64*S;
  const gxs=[], gys=[];
  for(let x=(Game.bgPulse*14)%step; x<W; x+=step) gxs.push(x);
  for(let y=(Game.bgPulse*14)%step; y<H; y+=step) gys.push(y);
  ctx.strokeStyle = heat>0 ? `rgba(255,42,42,${0.05+heat*0.09})` : tc.grid;
  ctx.lineWidth=1;
  ctx.beginPath();
  for(const x of gxs){ ctx.moveTo(x,0); ctx.lineTo(x,H); }
  for(const y of gys){ ctx.moveTo(0,y); ctx.lineTo(W,y); }
  ctx.stroke();

  ctx.fillStyle = heat>0 ? `rgba(255,42,42,${0.10+heat*0.14})` : (Theme.mode==="light" ? "rgba(20,15,5,.06)" : "rgba(255,255,255,.05)");
  for(let i=0;i<gxs.length;i+=3){ for(let j=0;j<gys.length;j+=3){ ctx.beginPath(); ctx.arc(gxs[i],gys[j],1.2*S,0,TAU); ctx.fill(); } }

  // sunburst rays, faint
  ctx.save();
  ctx.translate(W/2,H*0.4);
  ctx.rotate(Game.bgPulse*0.05);
  for(let i=0;i<16;i++){
    ctx.rotate(TAU/16);
    ctx.globalAlpha = 0.020 + heat*0.05 + Math.sin(Game.bgPulse*2+i)*0.005;
    ctx.fillStyle = tc.cade;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0, Math.max(W,H), -0.02, 0.02); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha=1;
}

function drawPressureTide(){
  if(!Game.meltdown || Game.scene!=="play") return;
  const y = Game.pressureY;
  const g = ctx.createLinearGradient(0,y-40*S,0,H);
  g.addColorStop(0,"rgba(255,42,42,0)");
  g.addColorStop(0.15,"rgba(255,42,42,.14)");
  g.addColorStop(1,"rgba(120,0,0,.5)");
  ctx.fillStyle=g;
  ctx.fillRect(0,y,W,H-y);
  ctx.strokeStyle="rgba(255,80,80,.6)"; ctx.lineWidth=2*S;
  ctx.beginPath();
  for(let x=0;x<=W;x+=20*S){
    const wob = Math.sin(x*0.02+Game.bgPulse*3)*4*S;
    ctx.lineTo(x, y+wob);
  }
  ctx.stroke();
}

function drawPost(){
  ctx.globalAlpha = 1;
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0,0,W,H);

  ctx.globalAlpha = 0.5 + FX.glitch*0.4;
  ctx.fillStyle = scanPattern;
  ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=1;

  if(FX.glitch>0.05){
    const slices = Math.min(5, Math.ceil(FX.glitch*4));
    for(let i=0;i<slices;i++){
      const sy = rnd(0,H), sh = rnd(4,18)*S, off = rnd(-14,14)*FX.glitch*S;
      ctx.drawImage(cv, 0, sy*DPR, cv.width, sh*DPR, off, sy, W, sh);
    }
  }

  if(FX.chroma>0.02){
    ctx.globalCompositeOperation="screen";
    ctx.globalAlpha = FX.chroma*0.10;
    ctx.fillStyle="#FFA800"; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over";
  }

  if(FX.vig>0.02){
    const v = ctx.createRadialGradient(W/2,H/2, Math.min(W,H)*0.35, W/2,H/2, Math.max(W,H)*0.62);
    v.addColorStop(0,"rgba(0,0,0,0)");
    v.addColorStop(1, FX.vigColor);
    ctx.save();
    ctx.globalAlpha = clamp(FX.vig,0,1)*0.42;
    ctx.fillStyle = v;
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  if(FX.invert>0.02){
    ctx.globalCompositeOperation="difference";
    ctx.globalAlpha = clamp(FX.invert,0,1);
    ctx.fillStyle="#FFFFFF"; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over";
  }

  if(FX.flash>0.02){
    ctx.globalAlpha = clamp(FX.flash,0,1)*0.7;
    ctx.fillStyle="#FFFFFF"; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=1;
  }
}

function render(){
  const sh = FX.shake;
  ctx.save();
  if(sh>0.1) ctx.translate(rnd(-sh,sh), rnd(-sh,sh));

  drawBackground();
  if(Game.scene==="title") Ambient.draw();
  Pumps.draw();
  Rugs.draw();
  Teams.draw();
  if(Game.scene==="finalrug") drawFinalRug();
  drawPressureTide();
  Rings.draw();
  Parts.draw();
  if(Game.scene!=="title" && Game.scene!=="results") Player.draw();
  Floaters.draw();

  ctx.restore();

  if(Game.scene==="play"||Game.scene==="freeze"||Game.scene==="finalrug"){
    drawTimer(); drawHUD();
  }
  if(Game.scene==="freeze") drawFreeze();
  if(Game.scene==="out") drawOut();

  if(dashBtn.classList.contains("show")){
    const cooling = Player.dashCd>0 || Player.dash>0;
    dashBtn.classList.toggle("cooling", cooling);
  }

  drawPost();
}

let last = performance.now();
function frame(now){
  if(tabHidden){ last = now; requestAnimationFrame(frame); return; }
  let dt = (now-last)/1000; last = now;
  dt = Math.min(dt, 1/30); // cap so tab-switches/hitches don't teleport entities
  if(Game.scene!=="title" && Game.scene!=="results") Game.update(dt);
  else { FX.update(dt); Parts.update(dt); Floaters.update(dt); Rings.update(dt); Ambient.update(dt); Game.bgPulse += dt; }
  render();
  requestAnimationFrame(frame);
}

/* ============================================================
   BOOT SEQUENCE
   Everything below reads Store/Theme/W/H/DPR — bindings that are only
   safe to touch once every module has finished loading AND this file's
   own body (Store/Theme/canvas setup, resize()) has actually executed.
   This is NOT optional ordering — an earlier version of this file had
   these as eager top-level calls scattered across ui.js/leaderboard.js/
   particles.js, and every one of them threw "Cannot access before
   initialization" the first time the module graph was actually
   executed (caught by real runtime testing, not by syntax checking —
   see the project notes). If you add new startup logic that reads a
   circularly-imported value, put it here, not at another file's top
   level.
   ============================================================ */
Ambient.init();
paintTitleHighScore();
initTheme();   // also paints the brand marks via Theme.apply() -> paintDomMarks()
initSound();
initPlayerName();

/* ============================================================
   TITLE SHOWCASE REPAINT LIFECYCLE
   #roster-showcase can only be measured (getBoundingClientRect) once
   #scTitle actually has a non-zero layout — and #scTitle starts hidden
   behind the identity gate, so painting it here eagerly at boot would
   size the canvas backing store at 0x0 and produce a blank/see-through
   rectangle. Instead this repaints only once #scTitle gains the "on"
   class (identity gate resolved, or navigating back to title), plus on
   every resize/orientation change while title is showing. This is the
   single authoritative repaint path for the showcase — do not add a
   second one elsewhere.
   ============================================================ */
(function initRosterShowcaseLifecycle(){
  const title = document.getElementById("scTitle");
  const canvas = document.getElementById("roster-showcase");
  if(!title || !canvas) return;

  let raf = 0;
  function repaintIfVisible(){
    if(!title.classList.contains("on")) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(()=>{ if(title.classList.contains("on")) paintRosterShowcase(); });
  }

  new MutationObserver(muts=>{
    if(muts.some(m=>m.type==="attributes" && m.attributeName==="class")) repaintIfVisible();
  }).observe(title, {attributes:true, attributeFilter:["class"]});

  window.addEventListener("resize", repaintIfVisible, {passive:true});
  window.addEventListener("orientationchange", ()=>setTimeout(repaintIfVisible,120));

  repaintIfVisible(); // covers the case where #scTitle is already "on" at boot
})();

requestAnimationFrame(frame);
