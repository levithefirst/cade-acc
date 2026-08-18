/* ============================================================
   CADE OPS — pumps.js
   Unmodified port. Pumps still work exactly as before: collect for
   score (multiplied), 3-in-a-row fills the energy meter for a speed
   boost (see player.js / main.js's Game.collisions()).
   ============================================================ */
import { CFG, rnd, TAU } from "./config.js";
import { ctx, W, H, S } from "./main.js";
import { Game } from "./main.js";
import { Parts } from "./particles.js";

export const Pumps = {
  pool: Array.from({length:CFG.MAX_PUMPS},()=>({on:false})),
  timer:0,
  clear(){ for(const p of this.pool) p.on=false; this.timer=0; },
  spawn(){
    const p = this.pool.find(q=>!q.on); if(!p) return;
    const pad = 70*S;
    p.on=true; p.x=rnd(pad,W-pad); p.y=rnd(pad,H-pad);
    p.r=CFG.PUMP_R*S; p.age=0; p.life=rnd(5.5,8.5); p.born=0;
  },
  update(dt){
    this.timer -= dt;
    const active = this.pool.filter(p=>p.on).length;
    const want = Game.meltdown ? 5 : 3;
    if(this.timer<=0 && active<want){ this.spawn(); this.timer = rnd(0.5,1.3); }
    for(const p of this.pool){
      if(!p.on) continue;
      p.age+=dt; p.born=Math.min(1,p.born+dt*4); p.life-=dt;
      if(p.life<=0){ p.on=false; Parts.spawn(p.x,p.y,5,{c:"#3DC96B",smin:20,smax:80}); }
    }
  },
  draw(){
    for(const p of this.pool){
      if(!p.on) continue;
      const pulse = 1+Math.sin(p.age*6)*0.12;
      const fade  = p.life<1.6 ? (Math.floor(p.life*10)%2?0.3:1) : 1;
      const rr = p.r*pulse*p.born;
      ctx.globalAlpha = fade;

      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,rr*3.2);
      g.addColorStop(0,"rgba(61,201,107,.40)"); g.addColorStop(1,"rgba(61,201,107,0)");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,rr*3.2,0,TAU); ctx.fill();

      // candlestick shape — wide body, thin wicks top and bottom, matching
      // the real trading-chart reference exactly (this is a Cade Market
      // game, "green candle" is the actual on-brand pump icon now)
      const bodyW = rr*1.15, bodyH = rr*1.9;
      const wickW = bodyW*0.16, wickLen = rr*0.55;
      ctx.fillStyle = "#3DC96B";
      ctx.shadowColor = "#3DC96B"; ctx.shadowBlur = 10;
      // top wick
      ctx.fillRect(p.x-wickW/2, p.y-bodyH/2-wickLen, wickW, wickLen);
      // bottom wick
      ctx.fillRect(p.x-wickW/2, p.y+bodyH/2, wickW, wickLen);
      // body
      ctx.fillRect(p.x-bodyW/2, p.y-bodyH/2, bodyW, bodyH);
      ctx.shadowBlur = 0;

      ctx.globalAlpha=1;
    }
  }
};
