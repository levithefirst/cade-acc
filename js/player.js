/* ============================================================
   CADE OPS — player.js
   Movement, Ape Dash, iframes, and the energy-boost speed multiplier.
   Unmodified from CADE RUSH — the movement tuning here was deliberately
   tightened for a "direct control" feel (not floaty) and the top speed
   (CFG.PLAYER_MAXV) is calibrated against the hazard-speed curve. The
   energy boost (Game.boosted) scales ON TOP of that base, multiplicatively
   — it never replaces the calibrated numbers, so CFG.PLAYER_MAXV/ACCEL
   stay meaningful even when boosted.
   ============================================================ */
import { CFG, clamp, rnd, TAU } from "./config.js";
import { ctx, W, H, S, Input } from "./main.js";
import { Game } from "./main.js";
import { Theme } from "./main.js";
import { FX, Parts } from "./particles.js";
import { SFX, Haptics } from "./audio.js";
import { Telemetry } from "./telemetry.js";

export const Player = {
  x:0,y:0,prevX:0,prevY:0,vx:0,vy:0,r:CFG.PLAYER_R,
  dash:0, dashCd:0, dashAng:0,
  iframes:0, alive:true, trail:[],
  reset(){
    this.x=W/2; this.y=H*0.68; this.prevX=this.x; this.prevY=this.y; this.vx=this.vy=0;
    this.r=CFG.PLAYER_R*S; this.dash=0; this.dashCd=0; this.iframes=0;
    this.alive=true; this.trail.length=0;
  },
  tryDash(){
    if(this.dashCd>0 || this.dash>0) return;
    let ax=0, ay=0;
    if(Input.mode==="pointer" && Input.pointer.active){
      const [tx,ty] = Player.effectiveTarget();
      ax = tx-this.x; ay = ty-this.y;
    }
    if(Math.hypot(ax,ay) < 8){ ax=this.vx; ay=this.vy; }
    if(Math.hypot(ax,ay) < 8){ ax=0; ay=-1; }
    this.dashAng = Math.atan2(ay,ax);
    this.dash = CFG.DASH_TIME; this.dashCd = CFG.DASH_COOLDOWN;
    Game.stats.dashes++;
    Telemetry.dashAttempt();
    FX.kick(7); FX.chroma = 1;
    SFX.dash(); Haptics.dash();
    Parts.spawn(this.x,this.y,18,{c:"#FC8400",angle:this.dashAng+Math.PI,spread:1.1,smin:180,smax:460,spark:true});
  },
  // touch gets an on-screen offset so the finger doesn't cover the character
  effectiveTarget(){
    const oy = Input.isTouch ? CFG.TOUCH_OFFSET_Y*S : 0;
    return [Input.pointer.x, Input.pointer.y - oy];
  },
  update(dt){
    // captured BEFORE any movement this frame — Game.collisions() uses the
    // (prevX,prevY)->(x,y) segment for a continuous swept check against
    // Teams, so a fast dash can't tunnel through a hitbox between frames
    this.prevX = this.x; this.prevY = this.y;

    if(this.dashCd>0) this.dashCd -= dt;
    if(this.iframes>0) this.iframes -= dt;

    if(this.dash>0){
      this.dash -= dt;
      this.vx = Math.cos(this.dashAng)*CFG.DASH_SPEED*S;
      this.vy = Math.sin(this.dashAng)*CFG.DASH_SPEED*S;
      if(Math.random()<0.8) Parts.spawn(this.x,this.y,1,{c:"#D96D00",smin:20,smax:80,lmin:.15,lmax:.35});
    } else {
      const boost = Game.boosted ? CFG.ENERGY_BOOST_MULT : 1;
      let kx=0, ky=0;
      if(Input.keys["a"]||Input.keys["arrowleft"])  kx-=1;
      if(Input.keys["d"]||Input.keys["arrowright"]) kx+=1;
      if(Input.keys["w"]||Input.keys["arrowup"])    ky-=1;
      if(Input.keys["s"]||Input.keys["arrowdown"])  ky+=1;

      if(kx||ky){
        const m = Math.hypot(kx,ky)||1;
        this.vx += (kx/m)*CFG.PLAYER_ACCEL*boost*S*dt;
        this.vy += (ky/m)*CFG.PLAYER_ACCEL*boost*S*dt;
        Input.mode="key";
      } else if(Input.mode==="pointer" && Input.pointer.active){
        // acceleration-based follow (same family as keyboard) — precise,
        // no overshoot oscillation, eases in near the target so tiny
        // finger/mouse jitter doesn't make the player twitch
        const [tx,ty] = this.effectiveTarget();
        const dx=tx-this.x, dy=ty-this.y, dist=Math.hypot(dx,dy);
        if(dist > CFG.POINTER_DEADZONE*S){
          const ax=dx/dist, ay=dy/dist;
          const pull = clamp(dist/(CFG.POINTER_EASE*S), 0.55, 1);
          this.vx += ax*CFG.POINTER_ACCEL*boost*S*pull*dt;
          this.vy += ay*CFG.POINTER_ACCEL*boost*S*pull*dt;
        } else {
          this.vx *= 0.8; this.vy *= 0.8;
        }
      } else {
        this.vx *= CFG.PLAYER_DRAG; this.vy *= CFG.PLAYER_DRAG;
      }
      const sp = Math.hypot(this.vx,this.vy), mx = CFG.PLAYER_MAXV*boost*S;
      if(sp>mx){ this.vx = this.vx/sp*mx; this.vy = this.vy/sp*mx; }
      if(!kx&&!ky&&Input.mode==="key"){ this.vx*=CFG.PLAYER_DRAG; this.vy*=CFG.PLAYER_DRAG; }
    }

    this.x += this.vx*dt; this.y += this.vy*dt;

    // walls — clamp and kill outward velocity, no bounce. A dodge game
    // needs predictable edges, not a rebound that can carry you into a rug.
    const pad = this.r;
    if(this.x<pad){ this.x=pad; if(this.vx<0) this.vx=0; }
    if(this.x>W-pad){ this.x=W-pad; if(this.vx>0) this.vx=0; }
    if(this.y<pad){ this.y=pad; if(this.vy<0) this.vy=0; }
    if(this.y>H-pad){ this.y=H-pad; if(this.vy>0) this.vy=0; }

    this.trail.push({x:this.x,y:this.y});
    if(this.trail.length>14) this.trail.shift();
  },
  draw(){
    const tc = Theme.colors();
    // trail
    for(let i=0;i<this.trail.length;i++){
      const t = i/this.trail.length, p=this.trail[i];
      ctx.globalAlpha = t*(Game.boosted?0.42:0.30);
      ctx.fillStyle = this.dash>0 ? "#D96D00" : (Game.boosted ? tc.yellow : "#FC8400");
      ctx.beginPath(); ctx.arc(p.x,p.y,this.r*t*0.9,0,TAU); ctx.fill();
    }
    ctx.globalAlpha=1;

    const blink = this.iframes>0 && Math.floor(this.iframes*18)%2===0;
    if(blink) ctx.globalAlpha = 0.35;

    // glow — hotter and wider as the Degen Multiplier climbs
    const heat = Game.scene==="play" ? clamp((Game.multi-1)/(CFG.MULTI_MAX-1),0,1) : 0;
    const glowR = this.r*(3.4+heat*1.6);
    const g = ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,glowR);
    g.addColorStop(0, this.dash>0 ? "rgba(217,109,0,.55)" : `rgba(252,132,0,${0.42+heat*0.28})`);
    g.addColorStop(1,"rgba(252,132,0,0)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(this.x,this.y,glowR,0,TAU); ctx.fill();

    // electric arcs — jagged crackle, more frequent and longer at high heat / while dashing
    const arcChance = this.dash>0 ? 1 : heat*0.9;
    if(Math.random() < arcChance*0.9){
      const n = this.dash>0 ? 3 : 1+Math.floor(heat*2);
      for(let i=0;i<n;i++){
        const a0 = rnd(0,TAU);
        const baseR = this.r+3*S;
        const len = this.r*(1.6+heat*1.8+ (this.dash>0?1.4:0));
        ctx.strokeStyle = i%2===0 ? "#FFD23C" : "#FC8400";
        ctx.lineWidth = 1.4*S;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        let px=this.x+Math.cos(a0)*baseR, py=this.y+Math.sin(a0)*baseR;
        ctx.moveTo(px,py);
        const segs=3;
        for(let s=1;s<=segs;s++){
          const rr = baseR + (len*s/segs);
          const jag = a0 + rnd(-0.5,0.5);
          px = this.x+Math.cos(jag)*rr; py = this.y+Math.sin(jag)*rr;
          ctx.lineTo(px,py);
        }
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }

    // body
    ctx.fillStyle = this.dash>0 ? "#FFFFFF" : "#FC8400";
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,TAU); ctx.fill();
    ctx.lineWidth = 2*S; ctx.strokeStyle = this.dash>0 ? "#D96D00" : (Game.boosted ? tc.yellow : "#FFE9A8");
    ctx.stroke();

    // lightning bolt mark inside the body
    ctx.save();
    ctx.translate(this.x,this.y); ctx.scale(this.r/13,this.r/13);
    ctx.fillStyle = "#0C0C0A";
    ctx.beginPath();
    ctx.moveTo(1.6,-7.5); ctx.lineTo(-4.6,1.0); ctx.lineTo(-0.6,1.0);
    ctx.lineTo(-1.8,7.5); ctx.lineTo(4.6,-1.2); ctx.lineTo(0.6,-1.2);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // boost ring — a second, faster pulse outside the dash-ready ring,
    // makes "you are currently fast" unmistakable at a glance
    if(Game.boosted){
      ctx.globalAlpha = 0.55+Math.sin(performance.now()/90)*0.3;
      ctx.strokeStyle = tc.yellow; ctx.lineWidth = 2*S;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+13*S,0,TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // dash-ready ring
    if(this.dashCd<=0 && this.dash<=0){
      ctx.globalAlpha = 0.5+Math.sin(performance.now()/180)*0.25;
      ctx.strokeStyle="#FC8400"; ctx.lineWidth=1.5*S;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+7*S,0,TAU); ctx.stroke();
    } else if(this.dashCd>0){
      const p = 1 - this.dashCd/CFG.DASH_COOLDOWN;
      ctx.globalAlpha=0.55; ctx.strokeStyle="#4A4A5A"; ctx.lineWidth=2.2*S;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+7*S,-Math.PI/2,-Math.PI/2+TAU*p); ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
};
