/* ============================================================
   CADE OPS — ui.js
   HUD, screen management, and the results flow. The one deliberate
   restructure from CADE RUSH: the brief calls for "HUD prioritizes
   NERFS count," so the top-left hero number is now Nerfs, with Bag
   (score) as a smaller secondary line underneath — CADE RUSH had it
   the other way around. Everything else in the HUD (lives-as-shields,
   energy meter, multiplier, timer) is an unmodified port.

   NOTE: this file has the same circular-import relationship with
   main.js that every other module does — see main.js's header.
   ============================================================ */
import { CFG, RANKS, RUG_TYPES, shadeColor, clamp, pick, TAU } from "./config.js";
import { ctx, W, H, S, DPR, Theme, Store, Input, lifeIconPos } from "./main.js";
import { Game } from "./main.js";
import { Player } from "./player.js";
import { Teams, TEAM_ROSTER } from "./teams.js";
import { SFX, Music } from "./audio.js";
import { submitScoreToLeaderboard } from "./leaderboard.js";

/* ============================================================
   Canvas drawing helpers
   ============================================================ */
export function roundRectPath(g, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  g.beginPath();
  g.moveTo(x+rr,y);
  g.arcTo(x+w,y,x+w,y+h,rr);
  g.arcTo(x+w,y+h,x,y+h,rr);
  g.arcTo(x,y+h,x,y,rr);
  g.arcTo(x,y,x+w,y,rr);
  g.closePath();
}

export function drawGlassChip(x,y,w,h,r){
  const tc = Theme.colors();
  const g = ctx.createLinearGradient(x,y,x,y+h);
  if(Theme.mode==="light"){
    g.addColorStop(0,"rgba(255,255,255,.55)"); g.addColorStop(1,"rgba(255,255,255,.30)");
  } else {
    g.addColorStop(0,"rgba(255,255,255,.10)"); g.addColorStop(1,"rgba(255,255,255,.03)");
  }
  roundRectPath(ctx,x,y,w,h,r);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = Theme.mode==="light" ? "rgba(20,15,5,.10)" : "rgba(255,255,255,.08)";
  ctx.lineWidth = 1; ctx.stroke();
}

export function drawCadeMark(g, x, y, r, opt={}){
  g.save();
  g.globalAlpha = opt.alpha!==undefined?opt.alpha:1;
  g.translate(x,y);
  g.strokeStyle = opt.ring || "#FC8400"; g.lineWidth = Math.max(1.5, r*0.12);
  g.beginPath(); g.arc(0,0,r,0.34*Math.PI,1.66*Math.PI); g.stroke();
  g.fillStyle = opt.cut || "#141414";
  g.beginPath();
  g.moveTo(r*0.15,-r*0.7); g.lineTo(-r*0.45,r*0.1); g.lineTo(-r*0.05,r*0.1);
  g.lineTo(-r*0.15,r*0.7); g.lineTo(r*0.45,-r*0.1); g.lineTo(r*0.05,-r*0.1);
  g.closePath(); g.fill();
  g.restore();
}

/* ============================================================
   HUD
   ============================================================ */
export function drawTimer(){
  const t = Math.max(0, Game.time);
  const secs = Math.ceil(t);
  const urgent = t <= CFG.MELTDOWN_AT;
  const critical = t <= 10;

  if(critical && Game.scene==="play"){
    const frac = t - Math.floor(t);
    const burn = clamp((10-t)/10, 0, 1);
    const pop  = 1 + (1-frac)*0.16 + burn*0.22;
    ctx.save();
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.globalAlpha = 0.13 + (1-frac)*0.17 + burn*0.10;
    ctx.font = `900 ${Math.min(W,H)*(0.80+burn*0.14)*pop}px Arial Black, Impact, sans-serif`;
    ctx.fillStyle = "#FF2A2A";
    ctx.fillText(secs, W/2, H/2);
    ctx.restore();
  }

  const tc = Theme.colors();
  const size = urgent ? 54*S : 40*S;
  const bob  = urgent ? Math.sin(performance.now()/90)*2.5*S : 0;
  ctx.textAlign="center"; ctx.textBaseline="top";
  ctx.font = `900 ${size}px Arial Black, Impact, sans-serif`;
  ctx.fillStyle = critical ? "#FF2A2A" : tc.cade;
  ctx.shadowColor = critical ? "#FF2A2A" : tc.cade; ctx.shadowBlur = urgent ? 26 : 12;
  const ss = Math.floor(t%60);
  const cs = Math.floor((t*100)%100);
  ctx.fillText(`0:${String(ss).padStart(2,"0")}`, W/2, 14*S+bob);
  ctx.shadowBlur=0;
  ctx.font = `700 ${13*S}px ui-monospace, monospace`;
  ctx.fillStyle = tc.dim;
  ctx.fillText(`.${String(cs).padStart(2,"0")}`, W/2, 14*S+size+bob);

  const bw = Math.min(W*0.62, 520*S), bh=4*S, bx=(W-bw)/2, by=8*S;
  ctx.fillStyle= Theme.mode==="light" ? "rgba(20,15,5,.08)" : "rgba(255,255,255,.08)";
  ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle= critical?"#FF2A2A":tc.cade;
  ctx.fillRect(bx,by,bw*(t/CFG.RUN_SECONDS),bh);
}

export function drawHUD(){
  ctx.textBaseline="top";
  const tc = Theme.colors();

  drawGlassChip(10*S, 10*S, 148*S, 66*S, 14*S);
  drawGlassChip(W-146*S, 10*S, 136*S, 56*S, 14*S);

  // NERFS — the new hero number, per the brief. Score (Bag) is now the
  // smaller secondary line underneath, not the other way around.
  ctx.textAlign="left";
  ctx.font=`900 ${34*S}px Arial Black, Impact, sans-serif`;
  ctx.fillStyle=tc.cade;
  ctx.shadowColor=tc.cade; ctx.shadowBlur=10;
  ctx.fillText(String(Game.stats.nerfs||0), 18*S, 16*S);
  ctx.shadowBlur=0;
  ctx.font=`700 ${9*S}px ui-monospace, monospace`;
  ctx.fillStyle=tc.dim;
  ctx.fillText("NERFS", 20*S, 16*S+36*S);
  ctx.font=`700 ${11*S}px ui-monospace, monospace`;
  ctx.fillStyle=tc.dim;
  ctx.textAlign="right";
  ctx.fillText(Math.round(Game.score).toLocaleString()+" BAG", 148*S, 20*S);
  ctx.textAlign="left";

  // lives — shield icons, unchanged from CADE RUSH
  for(let i=0;i<CFG.LIVES;i++){
    const alive = i < Game.lives;
    const pos = lifeIconPos(i);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(pos.size/13, pos.size/13);
    const shieldPath = ()=>{
      ctx.beginPath();
      ctx.moveTo(0,-7.5);
      ctx.lineTo(5.5,-5.2); ctx.lineTo(5.5,0.5);
      ctx.quadraticCurveTo(5.5,5.5, 0,7.8);
      ctx.quadraticCurveTo(-5.5,5.5, -5.5,0.5);
      ctx.lineTo(-5.5,-5.2);
      ctx.closePath();
    };
    if(alive){
      ctx.fillStyle = tc.cade; ctx.shadowColor=tc.cade; ctx.shadowBlur=6;
      shieldPath(); ctx.fill();
      ctx.shadowBlur=0;
    } else {
      ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth=1;
      shieldPath(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth=0.8;
      ctx.beginPath();
      ctx.moveTo(-1.5,-6); ctx.lineTo(0.5,-1.5); ctx.lineTo(-1.2,1.5); ctx.lineTo(1.8,6.5);
      ctx.moveTo(0.5,-1.5); ctx.lineTo(3.5,1.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // energy meter — derived from lifeIconPos() itself, not stale locals
  // (CADE RUSH had a real ReferenceError bug here — fixed before porting)
  const lastLife = lifeIconPos(0);
  const ey0 = lastLife.y + lastLife.size/2 + 8*S, eH = 12*S, eW = 130*S;
  drawGlassChip(10*S, ey0-2*S, eW+16*S, eH+8*S, 8*S);
  const segGap = 4*S, segW = (eW - segGap*2)/3;
  for(let i=0;i<3;i++){
    const fill = clamp(Game.energy*3 - i, 0, 1);
    const sx = 18*S + i*(segW+segGap);
    ctx.fillStyle = Theme.mode==="light" ? "rgba(20,15,5,.10)" : "rgba(255,255,255,.10)";
    roundRectPath(ctx, sx, ey0, segW, eH, 3*S); ctx.fill();
    if(fill>0){
      const pulse = Game.boosted ? 0.7+Math.sin(performance.now()/110)*0.3 : 1;
      ctx.fillStyle = tc.yellow;
      ctx.globalAlpha = pulse;
      if(Game.boosted){ ctx.shadowColor=tc.yellow; ctx.shadowBlur=10; }
      roundRectPath(ctx, sx, ey0, segW*fill, eH, 3*S); ctx.fill();
      ctx.shadowBlur=0; ctx.globalAlpha=1;
    }
  }
  ctx.font=`700 ${8*S}px ui-monospace, monospace`;
  ctx.fillStyle = Game.boosted ? tc.yellow : tc.dim;
  ctx.textAlign="left";
  ctx.fillText(Game.boosted ? "BOOST" : "ENERGY", 18*S+eW+6*S, ey0+eH/2-4*S);

  // multiplier (right)
  const m = Game.multi;
  const hot = clamp((m-1)/(CFG.MULTI_MAX-1),0,1);
  const pulse = 1 + Math.sin(performance.now()/(160-hot*100))*0.05*hot;
  ctx.textAlign="right";
  ctx.save();
  ctx.translate(W-18*S, 14*S);
  ctx.scale(pulse,pulse);
  ctx.font=`900 ${38*S}px Arial Black, Impact, sans-serif`;
  ctx.fillStyle = hot>0.62 ? "#FF2A2A" : hot>0.3 ? tc.yellow : tc.cade;
  if(hot>0.35){ ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=18+hot*26; }
  ctx.fillText(`${m.toFixed(2)}x`, 0, 0);
  ctx.restore();
  ctx.shadowBlur=0;
  ctx.font=`700 ${9*S}px ui-monospace, monospace`;
  ctx.fillStyle=tc.dim;
  ctx.fillText("DEGEN MULTI", W-20*S, 14*S+38*S);

  const bw2=110*S, bx2=W-18*S-bw2, by2=14*S+52*S;
  ctx.fillStyle= Theme.mode==="light" ? "rgba(20,15,5,.08)" : "rgba(255,255,255,.08)";
  ctx.fillRect(bx2,by2,bw2,3*S);
  if(Game.multiTimer>0){
    ctx.fillStyle=tc.cade;
    ctx.fillRect(bx2,by2,bw2*(Game.multiTimer/CFG.MULTI_GRACE),3*S);
  }else if(m>1){
    ctx.fillStyle="#FF2A2A"; ctx.fillRect(bx2,by2,bw2*0.06,3*S);
  }

  ctx.textAlign="left"; ctx.textBaseline="bottom";
  ctx.font=`700 ${11*S}px ui-monospace, monospace`;
  ctx.fillStyle=tc.dim;
  ctx.fillText(`GRAZES ${Game.stats.grazes}   PUMPS ${Game.stats.pumps}   HITS ${Game.stats.hits}`, 18*S, H-16*S);
  ctx.textBaseline="top";

  drawCadeMark(ctx, W-30*S, H-30*S, 16*S, {ring:tc.cade, cut:tc.cut, alpha:0.30});
}

export function drawFreeze(){
  ctx.save();
  ctx.fillStyle="rgba(20,20,20,.55)"; ctx.fillRect(0,0,W,H);
  const t = Game.sceneT/CFG.FREEZE_SECONDS;
  const pop = 1+Math.max(0,(0.18-t))*3;
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.font=`900 ${Math.min(W*0.11, 76*S)*pop}px Arial Black, Impact, sans-serif`;
  ctx.fillStyle="#3DC96B"; ctx.shadowColor="#3DC96B"; ctx.shadowBlur=40;
  ctx.fillText(`${Game.stats.nerfs||0} TEAMS NERFED`, W/2, H/2);
  ctx.shadowBlur=0;
  ctx.restore();
}

export function drawOut(){
  ctx.save();
  ctx.fillStyle="rgba(40,0,0,.5)"; ctx.fillRect(0,0,W,H);

  // diagonal glitch-bar behind the headline — the reference composition's
  // signature move: a dark angled band with a thin bright top edge, not
  // just text floating on a flat overlay
  const barH = H*0.34, barY = H*0.46 - barH/2;
  ctx.save();
  ctx.translate(0, barY + barH/2);
  ctx.transform(1,0, -0.06,1, 0,0); // slight shear for the angled-cut feel
  ctx.fillStyle = "rgba(10,4,4,.65)";
  ctx.fillRect(-40*S, -barH/2, W+80*S, barH);
  ctx.fillStyle = "rgba(255,42,42,.55)";
  ctx.fillRect(-40*S, -barH/2, W+80*S, 2.5*S);
  ctx.fillRect(-40*S, barH/2-2.5*S, W+80*S, 2.5*S);
  ctx.restore();

  const t = Game.sceneT/0.9;
  const pop = 1+Math.max(0,(0.2-t))*3.5;
  ctx.textAlign="center"; ctx.textBaseline="middle";

  ctx.font=`700 ${13*S}px ui-monospace, monospace`;
  ctx.fillStyle="rgba(255,255,255,.5)";
  ctx.fillText("MISSION", W/2, H*0.46 - 62*S*pop);

  ctx.font=`900 ${Math.min(W*0.15, 100*S)*pop}px Arial Black, Impact, sans-serif`;
  ctx.fillStyle="#FF2A2A"; ctx.shadowColor="#FF2A2A"; ctx.shadowBlur=44;
  ctx.fillText("WIPED", W/2, H*0.46);
  ctx.shadowBlur=0;
  ctx.font=`700 ${16*S}px ui-monospace, monospace`;
  ctx.fillStyle="#FFB0B0";
  ctx.fillText(`out of lives at ${Game.deathTime.toFixed(1)}s — ${Game.stats.nerfs||0} nerfed`, W/2, H*0.46+64*S);
  ctx.restore();
}

export function drawFinalRug(){
  const r = Game.finalRug; if(!r) return;
  ctx.save();
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.globalAlpha = 0.5+Math.sin(performance.now()/70)*0.3;
  ctx.font=`900 ${Math.min(W*0.09,54*S)}px Arial Black, Impact, sans-serif`;
  ctx.fillStyle="#FF2A2A";
  ctx.fillText("ONE MORE RUG", W/2, H*0.2);
  ctx.globalAlpha=1;

  const g = ctx.createRadialGradient(r.x,r.y,0,r.x,r.y,r.r*2.6);
  g.addColorStop(0,"rgba(255,42,42,.6)"); g.addColorStop(1,"rgba(255,42,42,0)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(r.x,r.y,r.r*2.6,0,TAU); ctx.fill();
  ctx.fillStyle="#FF2A2A";
  ctx.fillRect(r.x-r.r, r.y-r.r*0.75, r.r*2, r.r*1.5);
  ctx.lineWidth=3*S; ctx.strokeStyle="#FFFFFF";
  ctx.strokeRect(r.x-r.r, r.y-r.r*0.75, r.r*2, r.r*1.5);
  ctx.restore();
}

/* ============================================================
   SCREEN MANAGEMENT
   ============================================================ */
export const scTitle = document.getElementById("scTitle");
export const scEnd = document.getElementById("scEnd");
export const scLeaderboard = document.getElementById("scLeaderboard");
export const scHowToPlay = document.getElementById("scHowToPlay");
export const dashBtn = document.getElementById("dashBtn");
scTitle.classList.add("first-in");
export const isTouchDevice = (window.matchMedia && matchMedia("(pointer:coarse)").matches) || "ontouchstart" in window;

export function show(el){
  [scTitle,scEnd,scLeaderboard,scHowToPlay].forEach(s=>s && s.classList.remove("on"));
  if(el) el.classList.add("on");
  dashBtn.classList.remove("show");
}

document.getElementById("btnHowToPlay")?.addEventListener("click", ()=>{ SFX.ui(); show(scHowToPlay); });
document.getElementById("btnHowToPlayBack")?.addEventListener("click", ()=>{ SFX.ui(); show(scTitle); });

export function startRun(){
  show(null);
  Game.reset();
  Game.scene="play";
  Input.pointer.x = W/2; Input.pointer.y = H*0.68;
  SFX.unlock();
  Music.start("normal");
  if(isTouchDevice) dashBtn.classList.add("show");
}
document.getElementById("btnStart").addEventListener("click", ()=>{ SFX.ui(); startRun(); });
document.getElementById("btnAgain")?.addEventListener("click", ()=>{ SFX.ui(); startRun(); });

// dedicated touch dash button — more reliable than double-tap during
// frantic drag movement, shown only on touch-capable devices (see
// startRun), only while a run is in progress
dashBtn.addEventListener("touchstart", e=>{ e.preventDefault(); SFX.unlock(); Input.dashQueued=true; },{passive:false});
dashBtn.addEventListener("mousedown", e=>{ e.preventDefault(); Input.dashQueued=true; });

// title screen high score line — deferred, see initUI() below and
// main.js's boot sequence for why this can't run eagerly
export function paintTitleHighScore(){
  const s = Store.read();
  const el = document.getElementById("tHigh");
  if(el) el.innerHTML = s.high
    ? `Best <b>${s.high.toLocaleString()}</b> &nbsp;·&nbsp; ${s.bestNerfs||0} nerfs &nbsp;·&nbsp; ${s.runs} runs`
    : `No runs yet. Coward.`;
}

/* ============================================================
   RANKS — rebuilt around Teams Nerfed, the new headline metric.
   Score-based RANKS from config.js still exist and are used as a
   secondary flavor line, but nerf count drives the primary title now.
   ============================================================ */
const NERF_RANKS = [
  [0,  "GHOSTED",          "Didn't land a single nerf. Rough out there."],
  [1,  "WARM UP",          "Found your footing. Barely."],
  [4,  "ON THE BOARD",     "Respectable pace."],
  [8,  "NERF MACHINE",     "You're a problem out here."],
  [13, "TEAM WIPER",       "Nobody's safe when you're dashing."],
  [19, "ABSOLUTE MENACE",  "Every team leader fears your name."],
];
export function rankFor(nerfs){
  let r = NERF_RANKS[0];
  for(const row of NERF_RANKS) if(nerfs>=row[0]) r=row;
  return {title:r[1], roast:r[2]};
}

export function buildRoastLine(st, rk){
  const bits = [];
  if(st.hits===0) bits.push(pick(["Not one rug landed on you. Untouched.", "Zero hits. Clean sweep."]));
  else if(st.hits>=6) bits.push(`Got clipped ${st.hits} times and still kept nerfing.`);
  if(Game.bestStreak>=10) bits.push(`${Game.bestStreak}-graze streak without blinking.`);
  if(Game.finalRugOutcome==="dashed") bits.push("Then shredded the final rug on the way out.");
  else if(Game.finalRugOutcome==="dodged") bits.push("Then slipped the final rug by a hair.");
  else if(Game.finalRugOutcome==="rugged") bits.push("Then got clipped right at the buzzer. Brutal.");
  const extra = bits.length ? " " + pick(bits) : "";
  return rk.roast + extra;
}

function scoreBracket(score){
  if(score<1500) return "low";
  if(score<5000) return "mid";
  if(score<12000) return "high";
  return "legend";
}

export function buildTweet(score, rank, st){
  const bracket = scoreBracket(score);
  const nerfs = st.nerfs||0;

  const hookPool = [
    `Nerfed ${nerfs} teams in 60 seconds. CADE OPS is unforgiving.`,
    `${nerfs} teams down. The arena is not safe.`,
  ];
  const bracketPool = {
    low:    ["Rough round, posting anyway.", "Not my best — still posting it."],
    mid:    ["Solid bag for a 60-second sprint.", "Put up a respectable number."],
    high:   ["Absolutely printed.", "That's a real bag right there."],
    legend: ["Erased the arena. Legendary run.", "This is what a top score looks like."]
  }[bracket];
  const ctaPool = ["Beat it. I dare you.", "Your turn, degen.", "Tag someone who'd get instantly nerfed.", "Bet you can't top this."];

  const lines = [
    pick(hookPool),
    pick(bracketPool),
    "",
    `CADE OPS — ${score.toLocaleString()} pts · ${rank} · ${nerfs} nerfed`,
    `Max multi ${Game.bestMulti.toFixed(2)}x · ${st.grazes} close calls · ${st.shredded} rugs shredded`,
    "",
    pick(ctaPool),
    "@CadeMarket #CadeOps"
  ];
  return lines.join("\n");
}

export function animateScoreReveal(target){
  const el = document.getElementById("eScore");
  const dur = 900, t0 = performance.now();
  function tick(now){
    const p = clamp((now-t0)/dur, 0, 1);
    const eased = 1-Math.pow(1-p, 3);
    const val = Math.round(target*eased).toLocaleString();
    el.textContent = val;
    el.setAttribute("data-text", val);
    if(p<1) requestAnimationFrame(tick);
    else { el.textContent = target.toLocaleString(); el.setAttribute("data-text", target.toLocaleString()); }
  }
  requestAnimationFrame(tick);
}

export function showResults(){
  const s = Store.read();
  const score = Math.round(Game.score);
  const st = Game.stats;
  const previousBest = s.high;
  const isHigh = score > s.high;
  s.high = Math.max(s.high, score);
  s.bestNerfs = Math.max(s.bestNerfs||0, st.nerfs||0);
  s.runs = (s.runs||0)+1;
  s.bestMulti = Math.max(s.bestMulti||0, Game.bestMulti);
  s.bestGrazes = Math.max(s.bestGrazes||0, st.grazes);
  if(Game.survivedFinal) s.survivals = (s.survivals||0)+1;
  Store.write(s);

  const rk = rankFor(st.nerfs||0);
  const v = document.getElementById("eVerdict");
  if(Game.survivedFinal){ v.innerHTML="ARENA CLEARED"; v.className="verdict win"; }
  else { v.innerHTML='<span class="verdict-mission">MISSION</span>WIPED AT THE BUZZER'; v.className="verdict lose"; }

  document.getElementById("eScore").textContent = "0";
  animateScoreReveal(score);
  document.getElementById("eRank").textContent = rk.title;
  document.getElementById("eRoast").textContent = buildRoastLine(st, rk);

  const eHighEl = document.getElementById("eHigh");
  eHighEl.classList.remove("pulse");
  if(isHigh && previousBest>0){
    eHighEl.innerHTML = `<b>NEW HIGH SCORE</b> &nbsp;·&nbsp; beat your old best by ${(score-previousBest).toLocaleString()}`;
    eHighEl.classList.add("pulse");
  } else if(isHigh){
    eHighEl.innerHTML = `<b>NEW HIGH SCORE</b> &nbsp;·&nbsp; run ${s.runs}`;
    eHighEl.classList.add("pulse");
  } else {
    const gap = previousBest - score;
    if(gap<=150){
      eHighEl.innerHTML = `<b>${gap.toLocaleString()} points off your best</b> &nbsp;·&nbsp; run it back`;
      eHighEl.classList.add("pulse");
    } else {
      eHighEl.innerHTML = `Best <b>${s.high.toLocaleString()}</b> &nbsp;·&nbsp; run ${s.runs}`;
    }
  }

  const statsPrimary = [
    ["NERFS", st.nerfs||0],
    ["MAX MULTI", Game.bestMulti.toFixed(2)+"x"],
    ["CLOSE CALLS", st.grazes],
    ["SURVIVAL TIME", Game.survivalTime.toFixed(1)+"s"],
  ];
  const statsSecondary = [
    ["PUMPS", st.pumps],
    ["BIG PUMPS", st.bigPumps||0],
    ["SHREDDED", st.shredded],
    ["STREAK", Game.bestStreak],
    ["DASHES", st.dashes],
    ["HITS", st.hits],
  ];
  document.getElementById("eStatsPrimary").innerHTML = statsPrimary.map(([l,v])=>
    `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
  document.getElementById("eStatsSecondary").innerHTML = statsSecondary.map(([l,v])=>
    `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");

  document.getElementById("eTweet").textContent = buildTweet(score, rk.title, st);
  show(scEnd);
  paintDomMarks();
  submitScoreToLeaderboard(score);
}

/* ============================================================
   SHARE CARD / BRAND MARKS / THEME TOGGLE
   ============================================================ */
export function paintDomMark(id, ringAlpha, ringColor, cutColor){
  const c = document.getElementById(id); if(!c) return;
  const rect = c.getBoundingClientRect();
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  c.width = w*DPR; c.height = h*DPR;
  const g = c.getContext("2d");
  g.setTransform(DPR,0,0,DPR,0,0);
  g.clearRect(0,0,w,h);
  drawCadeMark(g, w/2, h/2, Math.min(w,h)/2, {ring:ringColor, cut:cutColor, alpha:ringAlpha});
}
export function paintDomMarks(){
  const tc = Theme.colors();
  paintDomMark("markTitle", 0.06, tc.cade, tc.bg);
  paintDomMark("markEnd", 0.10, tc.cade, tc.bg);
}

// title-screen character showcase — draws the real 6 roster silhouettes
// using their actual in-game draw() functions from teams.js. Zero new
// art: whatever you see here is pixel-identical to what appears in a
// real match, just laid out in a static row instead of roaming the arena.
export function paintRosterShowcase(){
  const c = document.getElementById("roster-showcase"); if(!c) return;
  const rect = c.getBoundingClientRect();
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  c.width = w*DPR; c.height = h*DPR;
  const g = c.getContext("2d");
  g.setTransform(DPR,0,0,DPR,0,0);
  g.clearRect(0,0,w,h);
  // canvas stays transparent on purpose — the .screen panel behind it is
  // already translucent over the live game canvas (ambient embers, grid,
  // sunburst), so the composition gets real atmosphere for free instead
  // of duplicating it here.

  const cx = w*0.52, cy = h*0.58; // operator sits slightly right of center, lower-mid

  // --- pump trail — a curved path of pumps leading the eye toward the operator ---
  const pumpPts = [
    {x:w*0.08, y:h*0.22}, {x:w*0.20, y:h*0.38}, {x:w*0.34, y:h*0.30}
  ];
  for(const p of pumpPts){
    const pr = Math.min(w,h)*0.026;
    const glow = g.createRadialGradient(p.x,p.y,0,p.x,p.y,pr*2.4);
    glow.addColorStop(0,"rgba(61,201,107,.45)"); glow.addColorStop(1,"rgba(61,201,107,0)");
    g.fillStyle = glow; g.beginPath(); g.arc(p.x,p.y,pr*2.4,0,TAU); g.fill();
    g.fillStyle = "#3DC96B";
    g.beginPath(); g.arc(p.x,p.y,pr,0,TAU); g.fill();
  }

  // --- a rug mid-shatter, upper-right, away from the operator's line ---
  (function drawShatteringRug(){
    const rx = w*0.85, ry = h*0.22, T = RUG_TYPES.DUMP;
    const baseW = Math.min(w,h)*0.13, baseH = baseW*T.h/T.w*2.2;
    g.save();
    g.translate(rx, ry); g.rotate(-0.35);
    // three separated fragments instead of one solid piece — "already broken"
    const frags = [
      {dx:-baseW*0.32, dy:-baseH*0.1, rot:-0.25, s:0.55},
      {dx:baseW*0.28,  dy:baseH*0.05, rot:0.4,  s:0.45},
      {dx:baseW*0.02,  dy:baseH*0.35, rot:0.1,  s:0.4},
    ];
    for(const f of frags){
      g.save();
      g.translate(f.dx, f.dy); g.rotate(f.rot);
      const fw=baseW*f.s, fh=baseH*f.s*0.55;
      const grad = g.createLinearGradient(0,-fh/2,0,fh/2);
      grad.addColorStop(0, shadeColor(T.col,0.25)); grad.addColorStop(1, shadeColor(T.col,-0.2));
      g.fillStyle = grad;
      g.fillRect(-fw/2,-fh/2,fw,fh);
      g.restore();
    }
    // static spark fragments around the break
    g.fillStyle = "#FC8400";
    for(let i=0;i<7;i++){
      const a = (i/7)*TAU, d = baseW*0.55;
      g.beginPath(); g.arc(Math.cos(a)*d, Math.sin(a)*d, 1.6, 0, TAU); g.fill();
    }
    g.restore();
  })();

  // --- team leaders, staggered depth/scale around the operator, background layer ---
  const bgSlots = [
    {id:"steve",    x:0.12, y:0.64, s:0.58},
    {id:"gnar",     x:0.24, y:0.84, s:0.62},
    {id:"kosgood",  x:0.36, y:0.68, s:0.66},
    {id:"scotty",   x:0.70, y:0.68, s:0.66},
    {id:"rookmate", x:0.86, y:0.56, s:0.56},
    {id:"poppunk",  x:0.60, y:0.86, s:0.68},
  ];
  const baseR = Math.min(w,h)*0.10;
  for(const slot of bgSlots){
    const def = TEAM_ROSTER.find(r=>r.id===slot.id); if(!def) continue;
    g.save();
    g.globalAlpha = 0.82;
    g.translate(w*slot.x, h*slot.y);
    def.draw(g, {r:baseR*slot.s, disabled:false, age:0}, 1);
    g.restore();
  }

  // --- operator, front and center, larger than every team leader, dash-lean pose ---
  (function drawOperatorHero(){
    const opR = baseR*1.35;
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.18); // leaning into the dash

    // motion trail — a streak of fading circles behind the lean direction
    for(let i=6;i>=1;i--){
      const t = i/6;
      g.globalAlpha = (1-t)*0.32;
      g.fillStyle = "#FC8400";
      g.beginPath(); g.arc(-i*opR*0.42, i*opR*0.14, opR*t*0.85, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;

    // glow
    const glowR = opR*3.2;
    const gg = g.createRadialGradient(0,0,0,0,0,glowR);
    gg.addColorStop(0,"rgba(252,132,0,.45)"); gg.addColorStop(1,"rgba(252,132,0,0)");
    g.fillStyle = gg; g.beginPath(); g.arc(0,0,glowR,0,TAU); g.fill();

    // body — same silhouette language as the real in-game operator
    g.scale(opR/13, opR/13);
    g.fillStyle = "#1A1A1E";
    g.beginPath();
    g.arc(0,-1,8,Math.PI,0);
    g.lineTo(6.5,6.5); g.quadraticCurveTo(0,10.5,-6.5,6.5);
    g.closePath(); g.fill();
    g.lineWidth = 1.5; g.strokeStyle = "#FC8400"; g.stroke();
    g.fillStyle = "#FC8400"; g.fillRect(-5.5,-3.2,11,2.6);
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(0.8,3); g.lineTo(-1.6,6.4); g.lineTo(-0.3,6.4);
    g.lineTo(-0.9,9.6); g.lineTo(1.8,5.6); g.lineTo(0.5,5.6);
    g.closePath(); g.fill();
    g.globalAlpha = 1;
    g.restore();
  })();
}

export function toggleTheme(){
  const next = Theme.mode==="light" ? "dark" : "light";
  Theme.apply(next);
  const s = Store.read(); s.theme = next; Store.write(s);
}
document.getElementById("btnTheme")?.addEventListener("click", toggleTheme);
document.getElementById("btnThemeEnd")?.addEventListener("click", toggleTheme);

const btnSound = document.getElementById("btnSound");
const soundLabel = document.getElementById("soundLabel");
const soundIconSvg = document.getElementById("soundIconSvg");
function setSoundIcon(on){
  if(soundLabel) soundLabel.textContent = on ? "Sound On" : "Sound Off";
  if(soundIconSvg) soundIconSvg.style.opacity = on ? "1" : "0.4";
}
export function initSound(){
  const s = Store.read();
  const on = s.sound!==false;
  SFX.setEnabled(on); Music.setEnabled(on);
  setSoundIcon(on);
}
btnSound?.addEventListener("click", ()=>{
  const next = !SFX.isEnabled();
  SFX.setEnabled(next); Music.setEnabled(next);
  setSoundIcon(next);
  const s = Store.read(); s.sound = next; Store.write(s);
  if(next){ SFX.unlock(); SFX.ui(); if(Game.scene==="title"||Game.scene==="results") Music.start("calm"); }
  else Music.stop(0.2);
});

export function initTheme(){
  const s = Store.read();
  let mode = s.theme;
  if(mode!=="dark" && mode!=="light"){
    mode = (window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
  }
  Theme.apply(mode);
}

/* ============================================================
   SHARE ON X / COPY TWEET
   ============================================================ */
document.getElementById("btnShareX")?.addEventListener("click", ()=>{
  SFX.ui();
  const txt = document.getElementById("eTweet").textContent;
  const liveUrl = location.protocol.startsWith("http") ? location.href : "https://cade-ops.vercel.app";
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(liveUrl)}`;
  window.open(intent, "_blank", "noopener,noreferrer");
});
document.getElementById("btnCopy")?.addEventListener("click", async e=>{
  SFX.ui();
  const txt = document.getElementById("eTweet").textContent;
  const btn = e.currentTarget;
  try{ await navigator.clipboard.writeText(txt); }
  catch(err){
    const ta=document.createElement("textarea"); ta.value=txt;
    ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy"); }catch(e2){}
    ta.remove();
  }
  btn.textContent="Copied";
  setTimeout(()=>btn.textContent="Copy Tweet",1600);
});

/* ============================================================
   SHARE CARD — canvas-generated, downloadable PNG. Rebuilt around
   Nerfs as the headline stat, same visual system otherwise.
   ============================================================ */
function buildShareCard(){
  const score = Math.round(Game.score);
  const st = Game.stats;
  const rk = rankFor(st.nerfs||0);

  const cw=1080, ch=1350;
  const c = document.createElement("canvas");
  c.width=cw; c.height=ch;
  const g = c.getContext("2d");

  const tc = Theme.colors();
  g.fillStyle = tc.bg; g.fillRect(0,0,cw,ch);
  const glow = g.createRadialGradient(cw/2,ch*0.4,0,cw/2,ch*0.4,cw*0.9);
  glow.addColorStop(0,"rgba(252,132,0,.12)"); glow.addColorStop(1,"rgba(20,20,20,0)");
  g.fillStyle=glow; g.fillRect(0,0,cw,ch);

  g.save(); g.translate(cw/2,ch*0.4);
  for(let i=0;i<20;i++){
    g.rotate(Math.PI/10);
    g.globalAlpha=0.025;
    g.fillStyle=tc.cade;
    g.beginPath(); g.moveTo(0,0);
    g.lineTo(Math.cos(-0.05)*cw,Math.sin(-0.05)*cw);
    g.lineTo(Math.cos(0.05)*cw,Math.sin(0.05)*cw);
    g.closePath(); g.fill();
  }
  g.restore(); g.globalAlpha=1;

  drawCadeMark(g, cw-90, 90, 52, {ring:tc.cade, cut:tc.bg, alpha:0.9});

  g.textAlign="left";
  g.fillStyle=tc.cade; g.font="700 26px ui-monospace, monospace";
  g.fillText("CADE OPS", 70, 80);

  if(!Game.survivedFinal){
    g.fillStyle="rgba(255,255,255,.5)"; g.font="700 18px ui-monospace, monospace";
    g.fillText("MISSION", 71, 132);
  }
  g.fillStyle = Game.survivedFinal ? "#3DC96B" : "#FF2A2A";
  g.font="900 52px Arial Black, Impact, sans-serif";
  g.fillText(Game.survivedFinal ? "ARENA CLEARED" : "WIPED AT THE BUZZER", 70, 180);

  g.fillStyle=tc.dim; g.font="700 24px ui-monospace, monospace";
  g.fillText("TEAMS NERFED", 70, 300);
  g.fillStyle=tc.cade; g.font="900 168px Arial Black, Impact, sans-serif";
  g.fillText(String(st.nerfs||0), 66, 460);

  g.fillStyle=tc.text; g.font="900 54px Arial Black, Impact, sans-serif";
  g.fillText(rk.title, 70, 560);

  const chips = [
    ["BAG", score.toLocaleString()],
    ["MAX MULTI", Game.bestMulti.toFixed(2)+"x"],
    ["CLOSE CALLS", st.grazes],
    ["SURVIVAL TIME", Game.survivalTime.toFixed(1)+"s"]
  ];
  const chipY=650, chipH=190, gap=18, chipW=(cw-140-gap*3)/4;
  chips.forEach(([l,v],i)=>{
    const x = 70+i*(chipW+gap);
    g.fillStyle="#1C1C1C"; g.fillRect(x,chipY,chipW,chipH);
    g.strokeStyle="#2A2A2A"; g.lineWidth=2; g.strokeRect(x,chipY,chipW,chipH);
    g.fillStyle="#FFFFFF"; g.textAlign="left";
    g.font="900 42px Arial Black, Impact, sans-serif";
    g.fillText(String(v), x+16, chipY+90);
    g.fillStyle="#7A7A8C"; g.font="700 17px ui-monospace, monospace";
    wrapText(g, l, x+16, chipY+130, chipW-24, 20);
  });

  g.fillStyle="#4E4E5E"; g.font="700 22px ui-monospace, monospace"; g.textAlign="left";
  g.fillText(`CADE OPS · 60-second arena · @CadeMarket #CadeOps`, 70, ch-70);

  return c;
}
function wrapText(g,text,x,y,maxW,lh){
  const words=text.split(" "); let line="", yy=y;
  for(const w of words){
    const test=line+w+" ";
    if(g.measureText(test).width>maxW && line){ g.fillText(line,x,yy); line=w+" "; yy+=lh; }
    else line=test;
  }
  g.fillText(line,x,yy);
}
document.getElementById("btnCard")?.addEventListener("click", e=>{
  const btn = e.currentTarget;
  const c = buildShareCard();
  const score = Math.round(Game.score);
  const a = document.createElement("a");
  a.download = `cade-ops-${score}.png`;
  a.href = c.toDataURL("image/png");
  document.body.appendChild(a); a.click(); a.remove();
  btn.textContent="Saved";
  setTimeout(()=>btn.textContent="Save Image",1600);
});
