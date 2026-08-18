/* ============================================================
   CADE OPS — rugs.js
   Rugs kept as SECONDARY hazards per the CADE OPS brief — the primary
   threat/objective is now the Teams system (teams.js). This module is
   an unmodified port: same five archetypes (DUMP/WICK/LIQUIDATION/
   FAKEOUT/WHALE), same calibrated speeds, same graze/dash-kill logic.

   Game.addScore/hitstop/multi/stats are read from the central Game
   object in main.js — see that file's header for the circular-import
   note, same pattern applies here.
   ============================================================ */
import { CFG, RUG_TYPES, rnd, rint, lerp, clamp, TAU, shadeColor } from "./config.js";
import { ctx, W, H, S } from "./main.js";
import { Game } from "./main.js";
import { Player } from "./player.js";
import { FX, Parts, Rings } from "./particles.js";

export const Rugs = {
  pool: Array.from({length:CFG.MAX_RUGS},()=>({on:false})),
  get(){ return this.pool.find(r=>!r.on) || null; },
  clear(){ for(const r of this.pool) r.on=false; },

  spawn(type){
    const r = this.get(); if(!r) return null;
    const T = RUG_TYPES[type];
    const edge = rint(0,3);
    const m = (T.r+40)*S;
    let x,y;
    if(edge===0){ x=rnd(0,W); y=-m; }
    else if(edge===1){ x=W+m; y=rnd(0,H); }
    else if(edge===2){ x=rnd(0,W); y=H+m; }
    else { x=-m; y=rnd(0,H); }

    // aim toward a point near the player, with scatter
    const tx = Player.x + rnd(-W*0.18, W*0.18);
    const ty = Player.y + rnd(-H*0.18, H*0.18);
    const a  = Math.atan2(ty-y, tx-x);
    const sp = rnd(T.speed[0], T.speed[1])*S;

    r.on=true; r.type=type; r.T=T; r.r=T.r*S; r.x=x; r.y=y;
    r.vx=Math.cos(a)*sp; r.vy=Math.sin(a)*sp; r.speed=sp;
    r.ang=a; r.spin=rnd(-2.2,2.2); r.rot=rnd(0,TAU);
    r.grazed=false; r.age=0; r.dead=false; r.phase=0; r.timer=0; r.flash=0;
    return r;
  },

  update(dt){
    for(const r of this.pool){
      if(!r.on) continue;
      r.age += dt; r.rot += r.spin*dt;
      if(r.flash>0) r.flash -= dt*4;

      switch(r.type){
        case "LIQUIDATION": {
          if(r.phase===0){
            // track the player
            const a = Math.atan2(Player.y-r.y, Player.x-r.x);
            r.ang = lerp(r.ang, a, 0.055);
            r.vx = Math.cos(r.ang)*r.speed; r.vy = Math.sin(r.ang)*r.speed;
            r.timer += dt;
            if(r.timer > 1.15){ r.phase=1; r.speed*=3.1;
              r.vx=Math.cos(r.ang)*r.speed; r.vy=Math.sin(r.ang)*r.speed;
              Parts.spawn(r.x,r.y,10,{c:"#FF3D6E",smin:60,smax:220,lmin:.2,lmax:.5});
            }
          }
          break;
        }
        case "FAKEOUT": {
          r.timer += dt;
          if(r.phase===0 && r.timer>0.75){ r.phase=1; r.timer=0; r.vx=0; r.vy=0; }
          else if(r.phase===1 && r.timer>0.45){
            r.phase=2; r.timer=0;
            const a = Math.atan2(Player.y-r.y, Player.x-r.x);
            r.ang=a; r.speed*=3.0;
            r.vx=Math.cos(a)*r.speed; r.vy=Math.sin(a)*r.speed;
            r.flash=1;
            Parts.spawn(r.x,r.y,14,{c:"#C42BFF",smin:80,smax:300,spark:true});
          }
          break;
        }
        case "WHALE": {
          // pushes the player around within range
          const dx=Player.x-r.x, dy=Player.y-r.y, d=Math.hypot(dx,dy)||1;
          const range = r.r*3.2;
          if(d<range){
            const f = (1-d/range)*520*S*dt;
            Player.vx += dx/d*f; Player.vy += dy/d*f;
          }
          break;
        }
      }

      r.x += r.vx*dt; r.y += r.vy*dt;

      // cull offscreen
      const m = r.r + 120*S;
      if(r.x<-m||r.x>W+m||r.y<-m||r.y>H+m){ r.on=false; }
    }
  },

  destroy(r, byDash){
    r.on = false;
    Parts.spawn(r.x,r.y, byDash?26:16, {c:byDash?"#FC8400":r.T.col, smin:100, smax:420, spark:byDash, rmin:2, rmax:5});
    if(byDash){
      Game.stats.shredded++;
      Game.addScore(80*Game.multi, r.x, r.y, "SHREDDED");
      Game.hitstop = Math.max(Game.hitstop, CFG.HITSTOP_DASHKILL);
      Rings.spawn(r.x,r.y,{r0:r.r*0.6,max:r.r*4.5,dur:0.42,c:"#FC8400",w:4});
      FX.kick(11); FX.invertHit(0.35); FX.glitchHit(0.5); FX.vignette(0.55, "#FC8400");
    }
  },

  draw(){
    for(const r of this.pool){
      if(!r.on) continue;
      const T=r.T;
      ctx.save();
      ctx.translate(r.x,r.y);
      ctx.rotate(r.type==="WICK"||r.type==="DUMP" ? Math.atan2(r.vy,r.vx) : r.rot);

      // charge / snap warning glow
      if((r.type==="LIQUIDATION"&&r.phase===0) || (r.type==="FAKEOUT"&&r.phase===1)){
        ctx.globalAlpha = 0.28+Math.sin(r.age*22)*0.2;
        ctx.fillStyle = T.col;
        ctx.beginPath(); ctx.arc(0,0,r.r*2.3,0,TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }

      const gg = ctx.createRadialGradient(0,0,0,0,0,r.r*2.2);
      gg.addColorStop(0, T.col+"66"); gg.addColorStop(1, T.col+"00");
      ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(0,0,r.r*2.2,0,TAU); ctx.fill();

      const w = r.r*2*T.w, h = r.r*2*T.h;
      if(r.flash>0){
        ctx.fillStyle = "#FFFFFF";
      } else {
        const bodyGrad = ctx.createLinearGradient(0,-h/2,0,h/2);
        bodyGrad.addColorStop(0, shadeColor(T.col, 0.30));
        bodyGrad.addColorStop(0.55, T.col);
        bodyGrad.addColorStop(1, shadeColor(T.col, -0.24));
        ctx.fillStyle = bodyGrad;
      }
      ctx.fillRect(-w/2,-h/2,w,h);
      ctx.lineWidth=2.5*S; ctx.strokeStyle="rgba(0,0,0,.65)";
      ctx.strokeRect(-w/2,-h/2,w,h);
      // bevel highlight — a thin lighter line along the top edge, the
      // cheapest possible "this surface catches light" cue without any
      // actual 3D geometry
      if(r.flash<=0){
        ctx.strokeStyle = shadeColor(T.col, 0.42);
        ctx.lineWidth = 1.1*S;
        ctx.beginPath();
        ctx.moveTo(-w/2+1.5*S, -h/2+1.5*S); ctx.lineTo(w/2-1.5*S, -h/2+1.5*S);
        ctx.stroke();
      }

      // red candle wick detail
      ctx.fillStyle="rgba(0,0,0,.35)";
      ctx.fillRect(-w/2, -h/2, w, Math.max(2, h*0.22));

      if(r.type==="WHALE"){
        ctx.fillStyle="rgba(255,42,42,.25)";
        ctx.beginPath(); ctx.arc(0,0,r.r*3.2,0,TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
};
