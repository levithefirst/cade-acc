/* CADE OPS — BURST
   A single panic-button ability layered onto the existing game loop.
   Charge comes from normal play: Pumps are the main source, close calls add a small amount.
   No second simulation loop, no second game state, no external dependency. */
import { CFG, clamp, TAU } from "./config.js";
import { Game, W, H, S, ctx, Theme } from "./main.js";
import { Player } from "./player.js";
import { Teams } from "./teams.js";
import { Rugs } from "./rugs.js";
import { FX, Parts, Rings, Floaters } from "./particles.js";
import { SFX, Haptics } from "./audio.js";
import { shots } from "./combat-ai.js";

const BURST = Object.freeze({
  PUMP_CHARGE: 1 / 3,
  CLOSE_CALL_CHARGE: 0.055,
  RADIUS: 190,
  RUG_RADIUS: 210,
  SCORE_PER_NERF: 420,
  MULTI_PER_NERF: 0.65,
  HAZARD_BONUS: 90,
  COOLDOWN_LOCK: 0.18
});

let charge = 0;
let lastPumps = 0;
let lastGrazes = 0;
let burstLock = 0;
let pulse = 0;

const burstBtn = document.getElementById("burstBtn");
const burstHud = document.createElement("div");
burstHud.id = "burstHud";
burstHud.innerHTML = '<span class="burst-hud-label">BURST</span><span class="burst-hud-meter"><i></i></span><span class="burst-hud-value">0%</span>';
document.body.appendChild(burstHud);
const meter = burstHud.querySelector("i");
const value = burstHud.querySelector(".burst-hud-value");

function touchCapable(){
  return (window.matchMedia && matchMedia("(pointer:coarse)").matches) || "ontouchstart" in window;
}

function setCharge(v){
  charge = clamp(v, 0, 1);
  const pct = Math.round(charge*100);
  meter.style.width = `${pct}%`;
  value.textContent = charge >= 1 ? "READY" : `${pct}%`;
  burstHud.classList.toggle("ready", charge >= 1);
  if(burstBtn){
    burstBtn.classList.toggle("ready", charge >= 1);
    burstBtn.classList.toggle("show", Game.scene === "play" && touchCapable());
    burstBtn.setAttribute("aria-label", charge >= 1 ? "Burst ready" : `Burst ${pct}% charged`);
  }
}

function addCharge(delta){
  if(Game.scene !== "play" || delta <= 0 || charge >= 1) return;
  setCharge(charge + delta);
}

function clearNearbyThreats(){
  let cleared = 0;
  const radius = BURST.RUG_RADIUS*S;
  for(const r of Rugs.pool){
    if(!r.on) continue;
    if(Math.hypot(Player.x-r.x, Player.y-r.y) <= radius){
      Rugs.destroy(r, true);
      cleared++;
    }
  }
  const projectileRadius = BURST.RADIUS*S;
  for(let i=shots.length-1;i>=0;i--){
    const q=shots[i];
    if(Math.hypot(Player.x-q.x, Player.y-q.y) <= projectileRadius){
      Parts.spawn(q.x,q.y,6,{c:q.color||"#FFA800",smin:60,smax:180,rmin:1,rmax:3,spark:true});
      shots.splice(i,1);
      cleared++;
    }
  }
  return cleared;
}

function killNearbyNerfs(){
  const radius = BURST.RADIUS*S;
  let kills = 0;
  for(const t of Teams.pool){
    if(!t.on || t.disabled || !t.roster) continue;
    if(Math.hypot(Player.x-t.x, Player.y-t.y) <= radius){
      Teams.nerf(t);
      kills++;
    }
  }
  return kills;
}

export function activate(){
  if(Game.scene !== "play" || Player.alive === false || burstLock > 0 || charge < 1) return false;
  setCharge(0);
  burstLock = BURST.COOLDOWN_LOCK;
  Game.stats.burstUses = (Game.stats.burstUses||0) + 1;

  const cleared = clearNearbyThreats();
  const kills = killNearbyNerfs();
  if(kills){
    const bonus = Math.round(BURST.SCORE_PER_NERF * kills * Game.multi);
    Game.addScore(bonus, Player.x, Player.y-20*S, "BURST KILL");
    Game.multi = Math.min(CFG.MULTI_MAX, Game.multi + BURST.MULTI_PER_NERF*kills);
    Game.bestMulti = Math.max(Game.bestMulti, Game.multi);
    Floaters.add(Player.x, Player.y-58*S, `${kills} NERF${kills===1?"":"S"} ELIMINATED`, Theme.colors().yellow, 17);
  }
  if(cleared){
    Game.addScore(BURST.HAZARD_BONUS*cleared*Game.multi, Player.x, Player.y+34*S, "CLEARED");
  }

  pulse = 0.72;
  FX.kick(30);
  FX.invertHit(0.38);
  FX.chroma = Math.max(FX.chroma, 0.85);
  FX.vignette(0.72, Theme.colors().cade);
  Parts.spawn(Player.x,Player.y,54,{c:Theme.colors().cade,smin:160,smax:760,lmin:.25,lmax:.7,rmin:2,rmax:5,spark:true,g:70});
  Parts.spawn(Player.x,Player.y,26,{c:"#FFFFFF",smin:100,smax:430,lmin:.15,lmax:.42,rmin:1,rmax:3,spark:true});
  Rings.spawn(Player.x,Player.y,{r0:8,max:BURST.RADIUS*S,dur:.48,c:Theme.colors().yellow,w:5});
  Rings.spawn(Player.x,Player.y,{r0:22,max:BURST.RADIUS*S*.72,dur:.32,c:Theme.colors().cade,w:2.5});
  Floaters.add(Player.x, Player.y-88*S, "BURST", Theme.colors().yellow, 24);
  SFX.win();
  Haptics.boost();
  return true;
}

const originalReset = Game.reset.bind(Game);
Game.reset = function(){
  originalReset();
  setCharge(0);
  lastPumps = 0;
  lastGrazes = 0;
  burstLock = 0;
  pulse = 0;
  Game.stats.burstUses = 0;
  shots.length = 0;
};

const originalEndRun = Game.endRun.bind(Game);
Game.endRun = function(){
  shots.length = 0;
  setCharge(0);
  originalEndRun();
};

const originalCollisions = Game.collisions.bind(Game);
Game.collisions = function(){
  const beforePumps = this.stats.pumps||0;
  const beforeGrazes = this.stats.grazes||0;
  originalCollisions();
  addCharge((this.stats.pumps-beforePumps)*BURST.PUMP_CHARGE);
  addCharge((this.stats.grazes-beforeGrazes)*BURST.CLOSE_CALL_CHARGE);
};

window.addEventListener("keydown", e=>{
  if(e.code !== "Space" || Game.scene !== "play") return;
  e.preventDefault();
  e.stopImmediatePropagation();
  activate();
}, true);

if(burstBtn){
  const trigger = e=>{
    e.preventDefault();
    e.stopPropagation();
    SFX.unlock();
    activate();
  };
  burstBtn.addEventListener("pointerdown", trigger, {passive:false});
}

function drawBurstPulse(){
  if(pulse<=0 || Game.scene !== "play") return;
  const radius = BURST.RADIUS*S*(1-pulse*.18);
  ctx.save();
  ctx.globalAlpha = pulse*.32;
  ctx.strokeStyle = Theme.colors().yellow;
  ctx.lineWidth = 2*S;
  ctx.beginPath(); ctx.arc(Player.x,Player.y,radius,0,TAU); ctx.stroke();
  ctx.globalAlpha = pulse*.10;
  ctx.fillStyle = Theme.colors().cade;
  ctx.beginPath(); ctx.arc(Player.x,Player.y,radius,0,TAU); ctx.fill();
  ctx.restore();
}

function frame(){
  if(burstLock>0) burstLock=Math.max(0,burstLock-1/60);
  if(pulse>0) pulse=Math.max(0,pulse-1/45);

  if(Game.scene !== "play"){
    if(shots.length) shots.length=0;
    burstHud.classList.remove("show","ready");
    if(burstBtn) burstBtn.classList.remove("show","ready");
  }else{
    burstHud.classList.add("show");
    setCharge(charge);
    drawBurstPulse();
  }
  requestAnimationFrame(frame);
}

setCharge(0);
requestAnimationFrame(frame);
