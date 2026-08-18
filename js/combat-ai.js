/* CADE OPS — combat AI
   One movement system for the six Nerfs. Each archetype owns a combat
   profile, a preferred distance, attack cooldown and readable telegraph.
   Game.onHit() remains the single source of truth for player damage/lives. */
import { CFG, rnd, clamp, lerp, TAU } from "./config.js";
import { Teams } from "./teams.js";
import { Player } from "./player.js";
import { Game, ctx, W, H, S, Theme } from "./main.js";
import { Pumps } from "./pumps.js";
import { FX, Parts, Rings, Floaters } from "./particles.js";
import { SFX, Haptics } from "./audio.js";
import { Telemetry } from "./telemetry.js";

export const COMBAT = {
  steve:    {kind:"melee",  speed:1.10, range:62,  ideal:62,  cooldown:1.35, damage:1, orbit:.12},
  gnar:     {kind:"ranged", speed:.88, range:235, ideal:190, cooldown:1.55, projectile:520, radius:7, orbit:.60},
  kosgood:  {kind:"ranged", speed:.96, range:300, ideal:215, cooldown:1.85, projectile:590, radius:5, orbit:.80},
  scotty:   {kind:"melee",  speed:.82, range:70,  ideal:66,  cooldown:1.70, damage:1, orbit:.08},
  rookmate: {kind:"ranged", speed:.74, range:360, ideal:275, cooldown:2.20, projectile:720, radius:4, orbit:.20},
  poppunk:  {kind:"hybrid", speed:1.04, range:118, ideal:102, cooldown:1.45, projectile:430, radius:8, orbit:1.0}
};

const shots=[];
const originalUpdate = Teams.update.bind(Teams);
let installed = false;

function profile(t){ return COMBAT[t.roster?.id] || COMBAT.steve; }
function distanceToPlayer(t){ return Math.hypot(Player.x-t.x,Player.y-t.y)||1; }

function telegraph(t,p){
  const c=t.roster?.accent || "#FFA800";
  t.attackT = .24;
  Parts.spawn(t.x,t.y, p.kind==="melee"?5:3,{c,smin:45,smax:150,lmin:.12,lmax:.28,rmin:1,rmax:2,spark:true});
  Rings.spawn(t.x,t.y,{r0:t.r*.8,max:t.r*(p.kind==="melee"?2.0:1.45),dur:.18,c,w:1.8});
}

function fire(t,p){
  if(p.kind==="melee"){
    telegraph(t,p);
    const d=distanceToPlayer(t);
    if(d<=p.range+Player.r && Player.dash<=0 && Player.iframes<=0){
      Game.onHit();
      t.recoil=.16;
      t.vx=-Math.cos(t.aimAngle)*120;
      t.vy=-Math.sin(t.aimAngle)*120;
    }
    return;
  }

  telegraph(t,p);
  const angle=Math.atan2(Player.y-t.y,Player.x-t.x);
  t.aimAngle=angle;
  shots.push({
    owner:t,
    x:t.x+Math.cos(angle)*(t.r+9*S),
    y:t.y+Math.sin(angle)*(t.r+9*S),
    vx:Math.cos(angle)*p.projectile*S,
    vy:Math.sin(angle)*p.projectile*S,
    r:p.radius*S,
    life:1.7,
    color:t.roster?.accent || "#FFA800",
    damage:p.damage||1
  });
  SFX.ui();
}

function updateShots(dt){
  for(let i=shots.length-1;i>=0;i--){
    const q=shots[i];
    q.life-=dt;
    q.x+=q.vx*dt;q.y+=q.vy*dt;
    if(q.life<=0 || q.x<-40 || q.x>W+40 || q.y<-40 || q.y>H+40){shots.splice(i,1);continue;}

    const d=Math.hypot(Player.x-q.x,Player.y-q.y);
    if(d<=Player.r+q.r){
      if(Player.dash<=0 && Player.iframes<=0){
        Game.onHit();
        FX.kick(10);FX.vignette(.28,q.color);
        Parts.spawn(q.x,q.y,10,{c:q.color,smin:80,smax:230,rmin:1,rmax:3,spark:true});
      }
      shots.splice(i,1);
    }
  }
}

function drawShots(){
  for(const q of shots){
    const a=Math.atan2(q.vy,q.vx), len=18*S;
    ctx.save();
    ctx.translate(q.x,q.y);ctx.rotate(a);
    ctx.globalAlpha=Math.min(1,q.life*3);
    ctx.shadowColor=q.color;ctx.shadowBlur=12*S;
    ctx.strokeStyle=q.color;ctx.lineWidth=Math.max(2,q.r*.7);
    ctx.beginPath();ctx.moveTo(-len,0);ctx.lineTo(len*.55,0);ctx.stroke();
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(len*.55,0,q.r*.75,0,TAU);ctx.fill();
    ctx.restore();
  }
}

function movement(t,p,dt,d){
  const dx=Player.x-t.x,dy=Player.y-t.y;
  const nx=dx/d,ny=dy/d;
  const tangentX=-ny,tangentY=nx;
  const orbit=Math.sin(t.age*1.7+t.roster.id.length)*p.orbit;
  let tx=0,ty=0;

  if(p.kind==="melee"){
    if(d>p.range+18){ tx=nx;ty=ny; }
    else { tx=tangentX*orbit;ty=tangentY*orbit; }
  }else{
    const band=34*S;
    if(d>p.ideal+band){tx=nx;ty=ny;}
    else if(d<p.ideal-band){tx=-nx;ty=-ny;}
    else {tx=tangentX*orbit;ty=tangentY*orbit;}
  }

  const m=Math.hypot(tx,ty)||1;tx/=m;ty/=m;
  const targetSpeed=CFG.TEAM_SPEED[1]*p.speed*S*(Game.meltdown?1.05:1);
  const steer=clamp(dt*3.2,0,1);
  t.vx=lerp(t.vx,tx*targetSpeed,steer);
  t.vy=lerp(t.vy,ty*targetSpeed,steer);
  if(t.recoil>0){t.recoil-=dt;}
  t.x=clamp(t.x+t.vx*dt,t.r,W-t.r);
  t.y=clamp(t.y+t.vy*dt,t.r,H-t.r);
}

function updateCombatTeam(t,dt){
  if(!t.on)return;
  t.age+=dt;
  t.attackCd=Math.max(0,(t.attackCd||0)-dt);
  t.attackT=Math.max(0,(t.attackT||0)-dt);
  t.grazeCooldown=Math.max(0,(t.grazeCooldown||0)-dt);
  if(t.grazeCooldown<=0)t.grazed=false;

  if(t.disabled){
    t.vx+=rnd(-1,1)*40*dt;t.vy+=rnd(-1,1)*40*dt;t.vx*=.94;t.vy*=.94;
    t.x=clamp(t.x+t.vx*dt,t.r,W-t.r);t.y=clamp(t.y+t.vy*dt,t.r,H-t.r);
    t.disableT-=dt;
    if(t.disableT<=0&&t.respawnT<=0)t.respawnT=CFG.TEAM_RESPAWN_DELAY;
    if(t.respawnT>0){
      t.respawnT-=dt;
      if(t.respawnT<=0){
        t.disabled=false;t.state="hunt";t.roamAngle=rnd(0,TAU);t.roamTimer=rnd(1,2.5);
        t.attackCd=.6+rnd(0,.8);
      }
    }
    return;
  }

  if(t.exposedTimer===undefined)t.exposedTimer=rnd(3,6);
  t.exposedTimer-=dt;
  if(t.exposedTimer<=0){
    if(t.exposed){t.exposed=false;t.exposedTimer=rnd(3.5,6.5);}
    else{t.exposed=true;t.exposedTimer=1.5;}
  }

  const p=profile(t),d=distanceToPlayer(t);
  t.state="hunt";
  t.aimAngle=Math.atan2(Player.y-t.y,Player.x-t.x);

  movement(t,p,dt,d);

  const canAttack=Player.alive && Game.scene==="play" && Player.dash<=0 && Player.iframes<=0;
  if(t.attackCd<=0&&canAttack){
    const attackRange=p.kind==="melee"?p.range+Player.r:p.range;
    if(d<=attackRange){
      fire(t,p);
      t.attackCd=p.cooldown*(.92+Math.random()*.16);
    }
  }
}

function install(){
  if(installed)return;
  installed=true;
  Teams.update=function(dt){
    if(Game.scene!=="play" && Game.scene!=="out"){
      /* Preserve the original disabled/respawn behavior outside gameplay. */
      originalUpdate(dt);
      updateShots(dt);
      return;
    }
    for(const t of this.pool)updateCombatTeam(t,dt);
    updateShots(dt);
  };

  const originalDraw=Teams.draw.bind(Teams);
  Teams.draw=function(){
    originalDraw();
    for(const t of this.pool){
      if(!t.on||t.disabled||!t.roster)continue;
      const p=profile(t);
      ctx.save();
      ctx.translate(t.x,t.y);
      if(t.attackT>0){
        ctx.globalAlpha=.35+Math.sin(performance.now()/35)*.15;
        ctx.strokeStyle=t.roster.accent;ctx.lineWidth=2*S;
        ctx.beginPath();ctx.arc(0,0,t.r+9*S,0,TAU);ctx.stroke();
      }
      ctx.globalAlpha=1;
      if(p.kind!=="melee"){
        ctx.globalAlpha=.35;
        ctx.strokeStyle=t.roster.accent;ctx.lineWidth=1*S;
        ctx.beginPath();ctx.arc(0,0,p.range,0,TAU);ctx.stroke();
      }
      ctx.restore();
    }
    drawShots();
  };
}

install();
export { shots };
