/* CADE OPS — THE 6 NERFS
   Roster UI + fair hunter AI. Character art is procedural canvas art, so
   the page has no external PFP dependency or broken image path to fail on Vercel.
*/
import { Game } from "./main.js";
import { Teams, TEAM_ROSTER } from "./teams.js";
import { Player } from "./player.js";
import { CFG, clamp, TAU } from "./config.js";
import { startRun, show } from "./ui.js";

const screen = document.getElementById("scNerfs");
const grid = document.getElementById("nerfsGrid");
const how = document.getElementById("scHowToPlay");
if (!screen || !grid) throw new Error("CADE OPS: The 6 Nerfs screen is missing.");

const X = {
  steve: "steoniy",
  gnar: "gnarzilla",
  kosgood: "kosgoood",
  scotty: "scottybmitchell",
  rookmate: "0xRookmate",
  poppunk: "PopPunkOnChain"
};

const PROFILE = {
  steve:    { weapon:"BAT",      color:"#FC8400", style:"melee",    speed:1.08, ideal:78,  wiggle:0.15 },
  gnar:     { weapon:"BLASTER",  color:"#00C2FF", style:"ranged",   speed:0.82, ideal:205, wiggle:0.55 },
  kosgood:  { weapon:"BOW",      color:"#FF2D9E", style:"ranged",   speed:0.94, ideal:165, wiggle:0.80 },
  scotty:   { weapon:"HAMMER",   color:"#8A8F98", style:"melee",    speed:0.76, ideal:95,  wiggle:0.10 },
  rookmate: { weapon:"RAILGUN",  color:"#F0F024", style:"sniper",   speed:0.70, ideal:275, wiggle:0.25 },
  poppunk:  { weapon:"KATANA",   color:"#7DE8FF", style:"hybrid",   speed:1.00, ideal:125, wiggle:1.05 }
};

function css(){
  const s=document.createElement("style");
  s.textContent=`
    #scNerfs{position:fixed;inset:0;z-index:20;box-sizing:border-box;padding:calc(20px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom));overflow-y:auto;overflow-x:hidden;align-items:center;justify-content:flex-start;background:radial-gradient(circle at 50% 14%,rgba(255,168,0,.16),transparent 42%),linear-gradient(180deg,rgba(9,9,10,.98),rgba(17,17,18,.99));}
    #scNerfs .eyebrow{margin-top:2px}.nerfs-heading{text-shadow:0 0 18px rgba(255,168,0,.28)}.nerfs-subtitle{margin:4px 0 16px;text-align:center}
    .nerfs-grid{width:min(100%,820px);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .nerf-card{position:relative;min-width:0;padding:8px;border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.11);box-shadow:0 14px 34px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.08);overflow:hidden;text-align:center;transition:transform .16s ease,border-color .16s ease}
    .nerf-card:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:var(--accent);box-shadow:0 0 18px var(--accent)}
    .nerf-card:active{transform:scale(.975)}
    .nerf-portrait{display:block;width:100%;height:132px;border-radius:13px;background:radial-gradient(circle at 50% 42%,rgba(255,168,0,.14),rgba(0,0,0,.22) 72%)}
    .nerf-name{display:block;margin-top:8px;color:#fff;font-family:Bungee,Arial Black,Impact,sans-serif;font-size:14px;line-height:1.12;text-decoration:none}.nerf-name:hover,.nerf-name:focus{color:var(--accent)}
    .nerf-x{display:block;margin-top:4px;color:rgba(255,255,255,.48);font:700 8px ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none;overflow-wrap:anywhere}.nerf-x:hover,.nerf-x:focus{color:var(--accent)}
    .nerf-weapon{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:4px 7px;border-radius:999px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--accent);font:900 7px Bungee,Arial Black,Impact,sans-serif;letter-spacing:.04em}
    .nerf-label{margin-top:6px;color:rgba(255,255,255,.28);font:700 7px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}
    .nerfs-actions{margin-top:15px;padding-bottom:4px}
    @media(min-width:700px){.nerfs-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.nerf-portrait{height:166px}}
    @media(max-height:700px){#scNerfs{padding-top:12px}.nerfs-subtitle{margin-bottom:8px}.nerf-portrait{height:96px}.nerf-card{padding:6px}.nerfs-actions{margin-top:9px}}
  `;document.head.appendChild(s);
}
css();

function switchScreen(target){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("on","first-in"));
  target.classList.add("on","first-in");
  target.scrollTop=0;
}

function weapon(g,p,r,phase=0){
  g.save();g.lineCap="round";g.lineJoin="round";g.shadowColor=p.color;g.shadowBlur=r*.18;
  const a=phase;
  if(p.weapon==="BAT"){
    g.rotate(-.55+a*.05);g.strokeStyle="#6E4228";g.lineWidth=r*.18;g.beginPath();g.moveTo(r*.45,r*.55);g.lineTo(r*1.15,-r*.75);g.stroke();g.strokeStyle=p.color;g.lineWidth=r*.34;g.beginPath();g.moveTo(r*.98,-r*.9);g.lineTo(r*1.25,-r*1.05);g.stroke();
  }else if(p.weapon==="BLASTER"){
    g.fillStyle="#111";g.strokeStyle=p.color;g.lineWidth=r*.07;g.beginPath();g.roundRect(r*.35,-r*.1,r*.92,r*.35,r*.08);g.fill();g.stroke();g.fillStyle=p.color;g.fillRect(r*1.15,-r*.03,r*.24,r*.16);g.beginPath();g.arc(r*.68,-r*.25,r*.11,0,TAU);g.fill();
  }else if(p.weapon==="BOW"){
    g.strokeStyle=p.color;g.lineWidth=r*.07;g.beginPath();g.arc(r*.55,0,r*.68,-1.15,1.15);g.stroke();g.strokeStyle="#FFF";g.lineWidth=r*.035;g.beginPath();g.moveTo(r*.1,-r*.62);g.lineTo(r*.1,r*.62);g.stroke();g.strokeStyle=p.color;g.lineWidth=r*.06;g.beginPath();g.moveTo(r*.1,-r*.62);g.lineTo(r*.85,-r*.62);g.stroke();
  }else if(p.weapon==="HAMMER"){
    g.rotate(.45);g.strokeStyle="#555";g.lineWidth=r*.14;g.beginPath();g.moveTo(r*.4,r*.65);g.lineTo(r*1.15,-r*.75);g.stroke();g.fillStyle="#B9BEC7";g.beginPath();g.roundRect(r*.75,-r*.98,r*.72,r*.32,r*.08);g.fill();g.strokeStyle=p.color;g.lineWidth=r*.06;g.stroke();
  }else if(p.weapon==="RAILGUN"){
    g.strokeStyle="#D8D8D8";g.lineWidth=r*.12;g.beginPath();g.moveTo(r*.15,r*.2);g.lineTo(r*1.42,-r*.35);g.stroke();g.strokeStyle=p.color;g.lineWidth=r*.05;g.beginPath();g.moveTo(r*.4,r*.1);g.lineTo(r*1.25,-r*.27);g.stroke();g.fillStyle=p.color;g.beginPath();g.arc(r*1.48,-r*.38,r*.09,0,TAU);g.fill();
  }else{
    g.rotate(.35+Math.sin(performance.now()/170)*.06);g.strokeStyle="#E7E7E7";g.lineWidth=r*.11;g.beginPath();g.moveTo(r*.3,r*.7);g.lineTo(r*1.22,-r*.75);g.stroke();g.strokeStyle=p.color;g.lineWidth=r*.045;g.beginPath();g.moveTo(r*.3,r*.7);g.lineTo(r*.53,r*.47);g.stroke();
  }
  g.shadowBlur=0;g.restore();
}

function portrait(canvas,def,i){
  const p=PROFILE[def.id]||PROFILE.steve, dpr=Math.min(devicePixelRatio||1,2), w=canvas.clientWidth||260,h=canvas.clientHeight||132;
  canvas.width=w*dpr;canvas.height=h*dpr;const g=canvas.getContext("2d");g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const glow=g.createRadialGradient(w*.5,h*.46,0,w*.5,h*.46,h*.75);glow.addColorStop(0,`${p.color}35`);glow.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=glow;g.fillRect(0,0,w,h);
  const r=Math.min(w,h)*.29;g.save();g.translate(w*.48,h*.68);g.rotate(Math.sin(performance.now()/900+i)*.035);def.draw(g,{r,disabled:false,age:performance.now()/1000+i},1);weapon(g,p,r,performance.now()/1000+i);g.restore();
  g.fillStyle="rgba(255,255,255,.035)";g.fillRect(0,h*.82,w,h*.18);g.fillStyle=p.color;g.globalAlpha=.65;g.fillRect(w*.08,h*.91,w*.84,2);g.globalAlpha=1;
}

function render(){
  grid.innerHTML="";
  TEAM_ROSTER.slice(0,6).forEach((def,i)=>{
    const p=PROFILE[def.id]||PROFILE.steve, card=document.createElement("article");card.className="nerf-card";card.style.setProperty("--accent",p.color);
    const c=document.createElement("canvas");c.className="nerf-portrait";c.setAttribute("aria-label",`${def.name} ${p.weapon}`);
    const name=document.createElement("a");name.className="nerf-name";name.textContent=def.name;name.href=`https://x.com/${X[def.id]}`;name.target="_blank";name.rel="noopener noreferrer";
    const x=document.createElement("a");x.className="nerf-x";x.textContent=`x.com/${X[def.id]}`;x.href=name.href;x.target="_blank";x.rel="noopener noreferrer";
    const w=document.createElement("div");w.className="nerf-weapon";w.textContent=`◆ ${p.weapon}`;
    const label=document.createElement("div");label.className="nerf-label";label.textContent=`NERF TARGET · ${String(i+1).padStart(2,"0")}`;
    card.append(c,name,x,w,label);grid.appendChild(card);portrait(c,def,i);
  });
}
render();

/* HOW TO PLAY -> ROSTER. Capture phase prevents ui.js's old handler from
   jumping straight into a run. */
document.getElementById("btnHowToPlayBack")?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();switchScreen(screen)},true);
document.getElementById("btnNerfsBack")?.addEventListener("click",e=>{e.preventDefault();switchScreen(how)},false);
document.getElementById("btnNerfsStart")?.addEventListener("click",e=>{e.preventDefault();startRun();},false);

/* HUNTER AI. The core Teams system already owns spawn/collision/nerf/respawn.
   We add a bounded steering layer after its normal movement. All six hunt
   immediately, but each archetype has a readable preferred distance. */
const originalUpdate=Teams.update.bind(Teams);
Teams.update=function(dt){
  originalUpdate(dt);
  if(Game.scene!=="play")return;
  const scale=Math.max(.62,Math.min(1.25,Math.min(innerWidth,innerHeight)/760));
  for(const t of this.pool){
    if(!t.on||t.disabled||!t.roster)continue;
    const p=PROFILE[t.roster.id]||PROFILE.steve;
    const dx=Player.x-t.x,dy=Player.y-t.y,d=Math.hypot(dx,dy)||1;
    const nx=dx/d,ny=dy/d;
    let tx=nx,ty=ny;
    const orbit=Math.sin(t.age*1.8+(t.roster.id.length*1.7))*p.wiggle;
    const ox=-ny*orbit,oy=nx*orbit;
    if(d>p.ideal+45){tx=nx+ox*.38;ty=ny+oy*.38}
    else if(d<p.ideal-45){tx=-nx+ox*.20;ty=-ny+oy*.20}
    else {tx=ox;ty=oy}
    const mag=Math.hypot(tx,ty)||1;tx/=mag;ty/=mag;
    const speed=CFG.TEAM_SPEED[1]*p.speed*scale;
    const blend=clamp(dt*2.4,0,1);
    t.vx += (tx*speed-t.vx)*blend;t.vy += (ty*speed-t.vy)*blend;
    t.x=clamp(t.x+t.vx*dt,t.r,innerWidth-t.r);t.y=clamp(t.y+t.vy*dt,t.r,innerHeight-t.r);
  }
};

/* Draw weapon props over the existing character silhouettes. The original
   draw routine remains responsible for all character rendering. */
const originalDraw=Teams.draw.bind(Teams);
Teams.draw=function(){
  originalDraw();
  for(const t of this.pool){
    if(!t.on||t.disabled||!t.roster)continue;
    const p=PROFILE[t.roster.id]||PROFILE.steve;
    const g=document.getElementById("cv")?.getContext("2d");if(!g)continue;
    g.save();g.translate(t.x,t.y);weapon(g,p,t.r,t.age);g.restore();
  }
};

/* Keep the six roster portraits subtly alive while the screen is open. */
let raf=0;function animateRoster(){if(screen.classList.contains("on")){grid.querySelectorAll(".nerf-portrait").forEach((c,i)=>{const d=TEAM_ROSTER[i];if(d)portrait(c,d,i)});}raf=requestAnimationFrame(animateRoster)}animateRoster();
window.addEventListener("resize",()=>{if(screen.classList.contains("on"))render()},{passive:true});
