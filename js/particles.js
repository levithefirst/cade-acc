/* ============================================================
   CADE OPS — particles.js
   Every pooled, zero-per-frame-allocation visual system: the FX
   feedback bus (shake/glitch/flash/invert/chroma/vignette), particles,
   shockwave rings, floating score text, and the title-screen ambient
   drift. Straight port from CADE RUSH — none of this changed.

   NOTE ON THE IMPORT FROM './main.js' BELOW: this project has a
   deliberate circular-import pattern. main.js owns the canvas/viewport
   (ctx, W, H, S) as live `let` exports, and every rendering module
   (this one included) imports them from there. main.js in turn imports
   the systems below to call their update()/draw() in the game loop.
   This works safely in ES modules because nothing here touches those
   bindings until a method actually runs — never at module-evaluation
   time — but if you're not expecting it, a circular import graph can
   look like a mistake. It isn't. See main.js's header comment too.
   ============================================================ */
import { CFG, rnd, rint, lerp, TAU } from "./config.js";
import { ctx, W, H, S } from "./main.js";

export const FX = {
  shake:0, shakeMax:0, glitch:0, flash:0, invert:0, chroma:0,
  vig:0, vigColor:"#FF2A2A",
  kick(mag){ this.shake = Math.max(this.shake, mag); },
  glitchHit(v){ this.glitch = Math.max(this.glitch, v); },
  flashHit(v){ this.flash = Math.max(this.flash, v); },
  invertHit(v){ this.invert = Math.max(this.invert, v); },
  // screen-edge vignette pulse — reads as "impact" without blinding the
  // whole screen the way flash/invert do. Newest pulse's color wins so
  // rapid different-colored events (graze then hit) don't blend into mud.
  vignette(v, color){ if(v>=this.vig){ this.vig=v; this.vigColor=color||"#FF2A2A"; } },
  update(dt){
    this.shake  = Math.max(0, this.shake  - dt*34);
    this.glitch = Math.max(0, this.glitch - dt*2.6);
    this.flash  = Math.max(0, this.flash  - dt*3.2);
    this.invert = Math.max(0, this.invert - dt*7.0);
    this.chroma = Math.max(0, this.chroma - dt*2.2);
    this.vig    = Math.max(0, this.vig    - dt*3.6);
  },
  reset(){ this.shake=this.glitch=this.flash=this.invert=this.chroma=this.vig=0; }
};

export const Parts = {
  pool: [],
  init(){
    this.pool.length=0;
    for(let i=0;i<CFG.MAX_PARTS;i++) this.pool.push({on:false,x:0,y:0,vx:0,vy:0,life:0,max:1,r:2,c:"#fff",g:0,spark:false});
  },
  spawn(x,y,n,opt={}){
    for(let i=0;i<n;i++){
      const p = this.pool.find(q=>!q.on); if(!p) return;
      const a = opt.angle!==undefined ? opt.angle + rnd(-(opt.spread||TAU)/2,(opt.spread||TAU)/2) : rnd(0,TAU);
      const sp = rnd(opt.smin||60, opt.smax||300)*S;
      p.on=true; p.x=x; p.y=y; p.vx=Math.cos(a)*sp; p.vy=Math.sin(a)*sp;
      p.max = rnd(opt.lmin||0.25, opt.lmax||0.7); p.life=p.max;
      p.r = rnd(opt.rmin||1.5, opt.rmax||3.6)*S;
      p.c = opt.c || "#fff"; p.g = opt.g||0; p.spark = !!opt.spark;
    }
  },
  update(dt){
    for(const p of this.pool){
      if(!p.on) continue;
      p.life -= dt; if(p.life<=0){ p.on=false; continue; }
      p.vy += p.g*dt; p.vx*=0.985; p.vy*=0.985;
      p.x += p.vx*dt; p.y += p.vy*dt;
    }
  },
  draw(){
    for(const p of this.pool){
      if(!p.on) continue;
      const t = p.life/p.max;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.c;
      if(p.spark){
        ctx.fillRect(p.x, p.y, p.r*2.4, p.r*0.7);
      }else{
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*t,0,TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
  clear(){ for(const p of this.pool) p.on=false; }
};
Parts.init();

export const Rings = {
  pool: Array.from({length:24},()=>({on:false,x:0,y:0,r:0,max:60,life:0,dur:1,c:"#fff",w:3})),
  spawn(x,y,opt={}){
    const r = this.pool.find(q=>!q.on); if(!r) return;
    r.on=true; r.x=x; r.y=y; r.r=opt.r0||4; r.max=opt.max||90;
    r.dur=opt.dur||0.4; r.life=r.dur; r.c=opt.c||"#FFA800"; r.w=opt.w||3;
  },
  update(dt){ for(const r of this.pool){ if(!r.on)continue; r.life-=dt; if(r.life<=0){r.on=false;continue;} } },
  draw(){
    for(const r of this.pool){
      if(!r.on) continue;
      const t = 1-r.life/r.dur;
      ctx.globalAlpha = (1-t)*0.9;
      ctx.strokeStyle = r.c; ctx.lineWidth = r.w*(1-t*0.6)*S;
      ctx.beginPath(); ctx.arc(r.x,r.y, lerp(r.r,r.max,t)*S, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha=1;
  },
  clear(){ for(const r of this.pool) r.on=false; }
};

export const Floaters = {
  pool: Array.from({length:40},()=>({on:false,x:0,y:0,vy:0,life:0,max:1,txt:"",c:"#fff",size:16})),
  add(x,y,txt,c,size=16){
    const f = this.pool.find(q=>!q.on); if(!f) return;
    f.on=true; f.x=x; f.y=y; f.vy=-70*S; f.max=0.85; f.life=f.max; f.txt=txt; f.c=c; f.size=size*S;
  },
  update(dt){ for(const f of this.pool){ if(!f.on)continue; f.life-=dt; if(f.life<=0){f.on=false;continue;} f.y+=f.vy*dt; f.vy*=0.94; } },
  draw(){
    ctx.textAlign="center"; ctx.textBaseline="middle";
    for(const f of this.pool){
      if(!f.on) continue;
      const t=f.life/f.max;
      ctx.globalAlpha = t;
      ctx.font = `900 ${f.size}px ${"Bungee, Arial Black, Impact, sans-serif"}`;
      ctx.fillStyle = f.c;
      ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha=1;
  },
  clear(){ for(const f of this.pool) f.on=false; }
};

export const Ambient = {
  pool: Array.from({length:9},()=>({on:false,type:"rug",x:0,y:0,vx:0,vy:0,r:8,rot:0,spin:0,alpha:0.2})),
  init(){ for(const p of this.pool){ p.on=false; } for(let i=0;i<this.pool.length;i++) this.spawn(true); },
  spawn(initial){
    const p = this.pool.find(q=>!q.on) || this.pool[0];
    p.type = Math.random()<0.4 ? "pump" : "rug";
    if(initial){ p.x = rnd(0,W); p.y = rnd(0,H); }
    else {
      const edge = rint(0,3);
      if(edge===0){ p.x=rnd(0,W); p.y=-40; }
      else if(edge===1){ p.x=W+40; p.y=rnd(0,H); }
      else if(edge===2){ p.x=rnd(0,W); p.y=H+40; }
      else { p.x=-40; p.y=rnd(0,H); }
    }
    const ang = rnd(0, TAU);
    const sp = rnd(12, 30);
    p.vx = Math.cos(ang)*sp; p.vy = Math.sin(ang)*sp*0.6 - 4;
    p.r = p.type==="pump" ? rnd(5,9) : rnd(11,20);
    p.rot = rnd(0,TAU); p.spin = rnd(-0.3,0.3);
    p.alpha = rnd(0.06,0.14);
    p.on = true;
  },
  update(dt){
    for(const p of this.pool){
      if(!p.on) continue;
      p.x += p.vx*dt; p.y += p.vy*dt; p.rot += p.spin*dt;
      if(p.x<-60||p.x>W+60||p.y<-60||p.y>H+60){ p.on=false; this.spawn(false); }
    }
  },
  draw(){
    for(const p of this.pool){
      if(!p.on) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      if(p.type==="pump"){
        ctx.fillStyle="#3DC96B";
        ctx.fillRect(-p.r*0.32, -p.r*0.9, p.r*0.64, p.r*1.8);
      } else {
        ctx.fillStyle="#FF2A2A";
        ctx.fillRect(-p.r, -p.r*0.34, p.r*2, p.r*0.68);
      }
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }
};
// NOTE: Ambient.init() is intentionally NOT called here. particles.js is
// imported early in main.js's circular import chain, before main.js's own
// body has reached its `let W,H,S` assignments — calling init() here would
// read those while still in their temporal dead zone. main.js calls
// Ambient.init() explicitly, later, once it's actually safe. See main.js's
// boot sequence at the bottom of the file.
