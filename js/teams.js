/* ============================================================
   CADE OPS — teams.js
   The core new system. Six AI-controlled "team leader" characters roam
   the arena; the player's job is to nerf as many as possible in 60s.

   HOW TO ADD/EDIT A CHARACTER: everything about a character lives in
   one entry in TEAM_ROSTER below — id, display name, colors, a
   personality line shown when they're nerfed, and a draw(g, t, s)
   function that renders their silhouette at the team's current
   position/rotation. Nothing else in this file, or anywhere else in
   the project, needs to change to add a 7th character. Keep every
   silhouette to a handful of shape primitives — the brief specifically
   calls for "readable at small size," and that's a constraint that
   gets violated by piling on detail, not honored by it.

   AI STATE MACHINE (per team member):
     roam       → wanders gently, occasionally re-picks a direction
     seekPump   → beelines for the nearest live pump if one's closer
                  than roaming distance (mild aggression toward resources,
                  not toward the player directly — keeps early game fair)
     chase      → once the player's Degen Multiplier gets hot (>=4), a
                  team member within range will close in — this is the
                  "mild aggression" the brief asks for, gated so it only
                  turns on once the player is already playing well
     nerfed     → disabled: no movement AI, plays a panic/scatter drift,
                  shows the personality line, waits out TEAM_DISABLE_TIME
                  then TEAM_RESPAWN_DELAY before re-entering as `roam`

   Nerf is triggered from Game.collisions() in main.js the same way
   Rugs.destroy(byDash) already works — dash through a team member (or
   land within nerf range) to disable them.
   ============================================================ */
import { CFG, rnd, rint, lerp, clamp, TAU, shadeColor } from "./config.js";
import { ctx, W, H, S, Theme, pausableNow } from "./main.js";
import { Game } from "./main.js";
import { Player } from "./player.js";
import { Pumps } from "./pumps.js";
import { FX, Parts, Rings, Floaters } from "./particles.js";
import { SFX, Haptics } from "./audio.js";
import { Telemetry } from "./telemetry.js";

/* ============================================================
   ROSTER — the 6 team leaders. This IS the full cast; Teams never
   spawns anyone not listed here.
   ============================================================ */
export const TEAM_ROSTER = [
  {
    id: "steve",
    name: "Steve",
    accent: "#FC8400",         // Cade orange
    accent2: "#D4B896",        // warm beige (corduroy jacket)
    lines: ["Wasn't ready for that.", "C'mon man.", "That's not fair."],
    draw(g, t, s){
      const r = t.r;
      // black tee sliver behind the jacket
      g.fillStyle = "#1A1A1A";
      g.beginPath(); g.roundRect(-r*0.45, -r*0.1, r*0.9, r*1.3, r*0.2); g.fill();
      // corduroy jacket body
      g.fillStyle = t.disabled ? shadeColor(this.accent2,-0.3) : this.accent2;
      g.beginPath(); g.roundRect(-r*0.72, -r*0.25, r*1.44, r*1.45, r*0.35); g.fill();
      g.strokeStyle = shadeColor(this.accent2,-0.35); g.lineWidth = Math.max(1,r*0.06);
      g.stroke();
      // head
      g.fillStyle = "#E8B98C";
      g.beginPath(); g.arc(0,-r*0.75, r*0.5, 0, TAU); g.fill();
      // short dark hair
      g.fillStyle = "#241C16";
      g.beginPath(); g.arc(0,-r*0.95, r*0.5, Math.PI, 0); g.fill();
      // orange accent trim on collar
      g.strokeStyle = t.disabled ? "rgba(252,132,0,.3)" : this.accent;
      g.lineWidth = Math.max(1, r*0.1);
      g.beginPath(); g.moveTo(-r*0.3,-r*0.15); g.lineTo(0,r*0.05); g.lineTo(r*0.3,-r*0.15); g.stroke();
    }
  },
  {
    id: "gnar",
    name: "gnar",
    accent: "#00C2FF",
    accent2: "#0A6E96",
    lines: ["glub.", "dripping different rn", "gnar down bad"],
    draw(g, t, s){
      const r = t.r, drip = Math.sin(t.age*3)*r*0.08;
      // liquid/goo blob body with drip points along the bottom
      g.fillStyle = t.disabled ? shadeColor(this.accent,-0.35) : this.accent;
      g.beginPath();
      g.moveTo(-r*0.9, -r*0.4);
      g.quadraticCurveTo(-r*1.05, r*0.5, -r*0.5, r*0.85+drip);
      g.quadraticCurveTo(-r*0.15, r*1.05, 0, r*0.8);
      g.quadraticCurveTo(r*0.15, r*1.1, r*0.5, r*0.85-drip);
      g.quadraticCurveTo(r*1.05, r*0.5, r*0.9, -r*0.4);
      g.quadraticCurveTo(r*0.6, -r*1.05, 0, -r*1.05);
      g.quadraticCurveTo(-r*0.6, -r*1.05, -r*0.9, -r*0.4);
      g.closePath(); g.fill();
      g.fillStyle = shadeColor(this.accent, 0.3);
      g.globalAlpha = 0.5;
      g.beginPath(); g.ellipse(-r*0.25,-r*0.5,r*0.3,r*0.18,0.4,0,TAU); g.fill();
      g.globalAlpha = 1;
      // black rectangular sunglasses
      g.fillStyle = "#0A0A0A";
      g.beginPath(); g.roundRect(-r*0.62,-r*0.35,r*1.24,r*0.36,r*0.08); g.fill();
    }
  },
  {
    id: "kosgood",
    name: "Kosgood",
    accent: "#FF2D9E",
    accent2: "#0A0A0A",
    lines: ["Unbelievable.", "Do you know who I am?", "Cute. Won't work twice."],
    draw(g, t, s){
      const r = t.r;
      // black turtleneck body
      g.fillStyle = t.disabled ? "#2A2A2A" : this.accent2;
      g.beginPath(); g.roundRect(-r*0.6,-r*0.15,r*1.2,r*1.35,r*0.3); g.fill();
      // magenta accent stripe
      g.fillStyle = t.disabled ? "rgba(255,45,158,.3)" : this.accent;
      g.beginPath(); g.roundRect(-r*0.6,-r*0.15,r*1.2,r*0.22,r*0.1); g.fill();
      // head + blonde bob
      g.fillStyle = "#F0D8A8";
      g.beginPath(); g.arc(0,-r*0.72,r*0.48,0,TAU); g.fill();
      g.fillStyle = "#E8C858";
      g.beginPath();
      g.arc(0,-r*0.78,r*0.55,Math.PI*0.95,Math.PI*2.05); g.fill();
      g.beginPath(); g.ellipse(-r*0.48,-r*0.55,r*0.14,r*0.32,0.3,0,TAU); g.fill();
      g.beginPath(); g.ellipse(r*0.48,-r*0.55,r*0.14,r*0.32,-0.3,0,TAU); g.fill();
      // red lipstick
      g.fillStyle = "#D6002A";
      g.beginPath(); g.ellipse(0,-r*0.6,r*0.12,r*0.05,0,0,TAU); g.fill();
    }
  },
  {
    id: "scotty",
    name: "Scotty",
    accent: "#8A8F98",
    accent2: "#FFB877",
    lines: ["Aw, come on.", "Rude.", "*grumbles*"],
    draw(g, t, s){
      const r = t.r;
      // black hoodie body
      g.fillStyle = t.disabled ? "#2A2A2A" : "#161616";
      g.beginPath(); g.roundRect(-r*0.68,-r*0.2,r*1.36,r*1.4,r*0.4); g.fill();
      // hood collar
      g.strokeStyle = this.accent2; g.lineWidth = Math.max(1,r*0.07);
      g.beginPath(); g.arc(0,-r*0.05,r*0.5,Math.PI*0.15,Math.PI*0.85); g.stroke();
      // gray bear head
      g.fillStyle = t.disabled ? shadeColor(this.accent,-0.3) : this.accent;
      g.beginPath(); g.arc(0,-r*0.78,r*0.52,0,TAU); g.fill();
      // ears
      g.beginPath(); g.arc(-r*0.4,-r*1.15,r*0.18,0,TAU); g.fill();
      g.beginPath(); g.arc(r*0.4,-r*1.15,r*0.18,0,TAU); g.fill();
      // backwards cap — a small dark arc at the back of the head
      g.fillStyle = "#0A0A0A";
      g.beginPath(); g.arc(0,-r*0.95,r*0.5,Math.PI*1.1,Math.PI*1.9); g.fill();
      // muzzle
      g.fillStyle = shadeColor(this.accent, 0.25);
      g.beginPath(); g.ellipse(0,-r*0.62,r*0.24,r*0.16,0,0,TAU); g.fill();
    }
  },
  {
    id: "rookmate",
    name: "Rookmate",
    accent: "#F0F024",
    accent2: "#FFFFFF",
    lines: ["*whimper*", "Ruff. (offended)", "Good boy energy: gone."],
    draw(g, t, s){
      const r = t.r;
      // black dog body
      g.fillStyle = t.disabled ? "#2A2A2A" : "#0E0E0E";
      g.beginPath(); g.roundRect(-r*0.62,-r*0.15,r*1.24,r*1.3,r*0.35); g.fill();
      // white chest patch
      g.fillStyle = this.accent2;
      g.beginPath(); g.moveTo(0,-r*0.1); g.lineTo(-r*0.22,r*0.5); g.lineTo(r*0.22,r*0.5); g.closePath(); g.fill();
      // head
      g.fillStyle = t.disabled ? "#2A2A2A" : "#0E0E0E";
      g.beginPath(); g.arc(0,-r*0.75,r*0.48,0,TAU); g.fill();
      // white facial blaze
      g.fillStyle = this.accent2;
      g.beginPath(); g.moveTo(0,-r*1.05); g.lineTo(-r*0.1,-r*0.45); g.lineTo(r*0.1,-r*0.45); g.closePath(); g.fill();
      // alert upright ears
      g.fillStyle = t.disabled ? "#2A2A2A" : "#0E0E0E";
      g.beginPath(); g.moveTo(-r*0.32,-r*1.05); g.lineTo(-r*0.5,-r*1.5); g.lineTo(-r*0.1,-r*1.15); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(r*0.32,-r*1.05); g.lineTo(r*0.5,-r*1.5); g.lineTo(r*0.1,-r*1.15); g.closePath(); g.fill();
      // yellow collar accent
      g.strokeStyle = t.disabled ? "rgba(240,240,36,.3)" : this.accent;
      g.lineWidth = Math.max(1,r*0.1);
      g.beginPath(); g.arc(0,-r*0.28,r*0.4,Math.PI*0.1,Math.PI*0.9); g.stroke();
    }
  },
  {
    id: "poppunk",
    name: "Pop Punk",
    accent: "#7DE8FF",
    accent2: "#FFFFFF",
    lines: ["yare yare.", "sliced. diced. still here tho.", "chaos undefeated"],
    draw(g, t, s){
      const r = t.r;
      // x-ray blue penguin body
      g.fillStyle = t.disabled ? shadeColor(this.accent,-0.4) : this.accent;
      g.globalAlpha = 0.82;
      g.beginPath(); g.ellipse(0,-r*0.1,r*0.62,r*0.95,0,0,TAU); g.fill();
      g.globalAlpha = 1;
      // visible "rib" x-ray lines
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = Math.max(1,r*0.04);
      for(let i=-2;i<=2;i++){
        g.beginPath(); g.moveTo(-r*0.35, -r*0.5+i*r*0.22); g.lineTo(r*0.35,-r*0.5+i*r*0.22); g.stroke();
      }
      // flipper wings
      g.fillStyle = shadeColor(this.accent,-0.15);
      g.beginPath(); g.ellipse(-r*0.68,-r*0.05,r*0.18,r*0.5,0.3,0,TAU); g.fill();
      g.beginPath(); g.ellipse(r*0.68,-r*0.05,r*0.18,r*0.5,-0.3,0,TAU); g.fill();
      // head
      g.fillStyle = t.disabled ? shadeColor(this.accent,-0.4) : this.accent;
      g.globalAlpha = 0.9;
      g.beginPath(); g.arc(0,-r*0.9,r*0.4,0,TAU); g.fill();
      g.globalAlpha = 1;
      // white star chest badge
      drawStar(g, 0, r*0.05, r*0.16);
      // katana prop — a thin diagonal line beside the body
      g.strokeStyle = "#D8D8D8"; g.lineWidth = Math.max(1.5,r*0.09);
      g.beginPath(); g.moveTo(r*0.55,r*0.7); g.lineTo(r*1.15,-r*0.55); g.stroke();
      g.strokeStyle = "#8A8A8A"; g.lineWidth = Math.max(1,r*0.05);
      g.beginPath(); g.moveTo(r*0.55,r*0.7); g.lineTo(r*0.68,r*0.55); g.stroke();
    }
  },
];

function drawStar(g, cx, cy, r){
  g.fillStyle = "#FFFFFF";
  g.beginPath();
  for(let i=0;i<5;i++){
    const a1 = -Math.PI/2 + i*(TAU/5), a2 = a1 + TAU/10;
    g.lineTo(cx+Math.cos(a1)*r, cy+Math.sin(a1)*r);
    g.lineTo(cx+Math.cos(a2)*r, cy+Math.sin(a2)*r*0.42);
  }
  g.closePath(); g.fill();
}

/* ============================================================
   TEAMS — pooled, mirrors the exact pattern Rugs/Pumps already use.
   ============================================================ */
export const Teams = {
  pool: Array.from({length:CFG.MAX_TEAMS},()=>({on:false})),

  clear(){ for(const t of this.pool) t.on=false; },

  activeCount(){ return this.pool.filter(t=>t.on && !t.disabled).length; },

  spawn(rosterId){
    const t = this.pool.find(q=>!q.on); if(!t) return null;
    const def = rosterId ? TEAM_ROSTER.find(r=>r.id===rosterId) : TEAM_ROSTER[rint(0,TEAM_ROSTER.length-1)];
    const pad = 80*S;
    t.on = true;
    t.roster = def;
    t.x = rnd(pad, W-pad); t.y = rnd(pad, H-pad);
    t.vx = 0; t.vy = 0;
    t.r = CFG.TEAM_R*S;
    t.age = rnd(0,10);
    t.state = "roam";
    t.disabled = false;
    t.disableT = 0;
    t.respawnT = 0;
    t.roamAngle = rnd(0,TAU);
    t.roamTimer = rnd(1,2.5);
    t.speed = rnd(CFG.TEAM_SPEED[0], CFG.TEAM_SPEED[1]);
    t.grazed = false; t.grazeCooldown = 0;
    t.spawnedAtElapsed = CFG.RUN_SECONDS - Game.time; // for the team-lifetime telemetry metric
    // exposed-state cycle — the depth addition from the polish synthesis:
    // not a new system, a readable value-state on something that already
    // exists. No requirement to wait for it — nerfing is always valid —
    // but a nerf landed while exposed pays a real bonus, so the player
    // gets a genuine "take the safe nerf now, or wait for the big one" choice.
    t.exposed = false;
    t.exposedTimer = rnd(3, 6); // staggered per-instance on purpose
    return t;
  },

  spawnWave(count){
    for(let i=0;i<count;i++) this.spawn();
  },

  update(dt){
    const aggroOn = Game.multi >= 4; // "mild aggression" gates on player already playing well
    for(const t of this.pool){
      if(!t.on) continue;
      t.age += dt;

      if(t.grazeCooldown>0) t.grazeCooldown -= dt;
      else t.grazed = false;

      if(!t.disabled){
        t.exposedTimer -= dt;
        if(t.exposedTimer<=0){
          if(t.exposed){ t.exposed=false; t.exposedTimer = rnd(3.5,6.5); }
          else{ t.exposed=true; t.exposedTimer = 1.5; }
        }
      } else if(t.exposed){ t.exposed=false; }

      if(t.disabled){
        // panic/scatter drift while disabled — no directed AI, just decaying jitter
        t.vx += rnd(-1,1)*40*dt; t.vy += rnd(-1,1)*40*dt;
        t.vx *= 0.94; t.vy *= 0.94;
        t.x += t.vx*dt; t.y += t.vy*dt;
        t.x = clamp(t.x, t.r, W-t.r); t.y = clamp(t.y, t.r, H-t.r);

        t.disableT -= dt;
        if(t.disableT <= 0 && t.respawnT<=0){ t.respawnT = CFG.TEAM_RESPAWN_DELAY; }
        if(t.respawnT>0){
          t.respawnT -= dt;
          if(t.respawnT<=0){
            t.disabled = false; t.state="roam"; t.roamAngle=rnd(0,TAU); t.roamTimer=rnd(1,2.5);
          }
        }
        continue;
      }

      // pick a behavior state
      let targetX=null, targetY=null;
      if(aggroOn && Math.hypot(Player.x-t.x, Player.y-t.y) < 260*S){
        if(t.state !== "chase") Telemetry.chaseActivation();
        t.state = "chase";
        targetX = Player.x; targetY = Player.y;
      } else {
        const nearPump = Pumps.pool.filter(p=>p.on).sort((a,b)=>
          Math.hypot(t.x-a.x,t.y-a.y) - Math.hypot(t.x-b.x,t.y-b.y))[0];
        if(nearPump && Math.hypot(t.x-nearPump.x,t.y-nearPump.y) < 300*S){
          t.state = "seekPump";
          targetX = nearPump.x; targetY = nearPump.y;
        } else {
          t.state = "roam";
          t.roamTimer -= dt;
          if(t.roamTimer<=0){ t.roamAngle = rnd(0,TAU); t.roamTimer = rnd(1,2.5); }
          targetX = t.x + Math.cos(t.roamAngle)*100;
          targetY = t.y + Math.sin(t.roamAngle)*100;
        }
      }

      const dx = targetX-t.x, dy = targetY-t.y, d = Math.hypot(dx,dy)||1;
      const sp = t.speed * (t.state==="chase"?1.3:1) * S;
      t.vx = lerp(t.vx, (dx/d)*sp, dt*3);
      t.vy = lerp(t.vy, (dy/d)*sp, dt*3);
      t.x += t.vx*dt; t.y += t.vy*dt;
      t.x = clamp(t.x, t.r, W-t.r); t.y = clamp(t.y, t.r, H-t.r);
    }
  },

  // called from Game.collisions() in main.js — dash-through (or close-range
  // pulse) nerf. Mirrors Rugs.destroy(byDash)'s role exactly.
  nerf(t){
    if(!t.on || t.disabled) return;
    const wasExposed = t.exposed;
    t.disabled = true; t.state = "nerfed"; t.exposed = false;
    t.disableT = CFG.TEAM_DISABLE_TIME;
    t.respawnT = 0;
    t.vx = rnd(-80,80); t.vy = rnd(-80,80);

    Game.stats.nerfs = (Game.stats.nerfs||0)+1;
    const scoreMult = wasExposed ? 2 : 1;
    Game.addScore(CFG.TEAM_NERF_SCORE*Game.multi*scoreMult, t.x, t.y, wasExposed?"EXPOSED NERF":"NERFED");
    Game.multi = Math.min(CFG.MULTI_MAX, Game.multi + CFG.TEAM_NERF_MULTI_BONUS*(wasExposed?1.6:1));
    Game.bestMulti = Math.max(Game.bestMulti, Game.multi);
    Game.hitstop = Math.max(Game.hitstop, CFG.HITSTOP_DASHKILL*(wasExposed?1.3:1));

    const elapsed = CFG.RUN_SECONDS - Game.time;
    const lifetime = elapsed - (t.spawnedAtElapsed||elapsed);
    Telemetry.nerfEvent(t.roster.id, Game.multi, elapsed, lifetime);

    const c = t.roster.accent;
    FX.kick(wasExposed?18:13); FX.invertHit(wasExposed?0.55:0.4); FX.glitchHit(0.55); FX.vignette(wasExposed?0.65:0.5, wasExposed?Theme.colors().yellow:c);
    Parts.spawn(t.x,t.y,wasExposed?36:24,{c, smin:110,smax:wasExposed?520:400,rmin:2,rmax:5,spark:true});
    Rings.spawn(t.x,t.y,{r0:t.r*0.6, max:t.r*(wasExposed?5.5:4), dur:0.42, c, w:3.5});
    const line = t.roster.lines[rint(0,t.roster.lines.length-1)];
    Floaters.add(t.x, t.y-t.r-14*S, line, c, 14);
    Floaters.add(t.x, t.y-t.r-32*S, `${wasExposed?"EXPOSED — ":""}NERFED: ${t.roster.name.toUpperCase()}`, wasExposed?Theme.colors().yellow:"#FFFFFF", 12);
    SFX.bigPump(); Haptics.boost();
  },

  draw(){
    const tc = Theme.colors();
    for(const t of this.pool){
      if(!t.on) continue;

      // exposed telegraph — a bright ring outside the character, pulsing
      // faster as the window is about to close, so "take it now" reads clearly
      if(t.exposed){
        const pulse = 0.6+Math.sin(pausableNow()/85)*0.4;
        ctx.save();
        ctx.strokeStyle = tc.yellow; ctx.lineWidth = 2.2*S;
        ctx.globalAlpha = pulse;
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r+8*S, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      ctx.save();
      ctx.translate(t.x, t.y);
      if(t.disabled) ctx.globalAlpha = 0.55 + Math.sin(t.age*10)*0.15;
      t.roster.draw(ctx, t, S);
      ctx.restore();

      // nametag — small, only when not disabled, so a busy arena stays readable
      if(!t.disabled){
        ctx.save();
        ctx.font = `700 ${10*S}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = t.exposed ? tc.yellow : "rgba(255,255,255,.55)";
        ctx.fillText(t.exposed ? `${t.roster.name} ⚡` : t.roster.name, t.x, t.y - t.r - 8*S);
        ctx.restore();
      }
    }
  }
};
