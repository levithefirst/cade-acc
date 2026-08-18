/* CADE OPS — THE 6 NERFS
   Roster UI + character presentation.
   This module owns only the roster screen. Navigation into gameplay remains
   delegated to the existing UI/game systems. */
import { Game, ctx } from "./main.js";
import { Teams, TEAM_ROSTER } from "./teams.js";
import { startRun } from "./ui.js";
import { TAU } from "./config.js";

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
  steve:    { weapon:"BAT",      color:"#FFA800" },
  gnar:     { weapon:"BLASTER",  color:"#2F2F2F" },
  kosgood:  { weapon:"BOW",      color:"#FFB514" },
  scotty:   { weapon:"HAMMER",   color:"#FFFFFF" },
  rookmate: { weapon:"RAILGUN",  color:"#FFB514" },
  poppunk:  { weapon:"KATANA",   color:"#FFA800" }
};

function addPolishStylesheet(){
  if(document.querySelector('link[data-cade-polish="1"]')) return;
  const link=document.createElement("link");
  link.rel="stylesheet";
  link.href="css/polish.css";
  link.dataset.cadePolish="1";
  document.head.appendChild(link);
}
addPolishStylesheet();

function switchScreen(target){
  if(!target) return;
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("on","first-in"));
  target.classList.add("on","first-in");
  target.scrollTop=0;
}

function weapon(g,p,r,phase=0,aim=0){
  g.save();
  g.lineCap="round";g.lineJoin="round";g.shadowColor=p.color;g.shadowBlur=r*.18;
  if(aim!==0)g.rotate(aim);
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

function fallbackPortrait(canvas,p){
  const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth||260,h=canvas.clientHeight||150;
  canvas.width=w*dpr;canvas.height=h*dpr;
  const g=canvas.getContext("2d");
  if(!g) return;
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  g.fillStyle="rgba(20,20,20,.75)";g.fillRect(0,0,w,h);
  g.strokeStyle=p.color;g.lineWidth=3;g.beginPath();g.arc(w*.48,h*.55,Math.min(w,h)*.22,0,TAU);g.stroke();
  g.fillStyle=p.color;g.font="900 11px Bungee,Arial Black,sans-serif";g.textAlign="center";g.fillText("CADE NERF",w*.48,h*.57);
}

function portrait(canvas,def,i){
  const p=PROFILE[def?.id]||PROFILE.steve;
  try{
    const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth||260,h=canvas.clientHeight||150;
    canvas.width=w*dpr;canvas.height=h*dpr;
    const g=canvas.getContext("2d");
    if(!g) return;
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    const glow=g.createRadialGradient(w*.5,h*.46,0,w*.5,h*.46,h*.75);
    glow.addColorStop(0,`${p.color}35`);glow.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=glow;g.fillRect(0,0,w,h);
    const r=Math.min(w,h)*.27;
    g.save();g.translate(w*.48,h*.66);g.rotate(Math.sin(performance.now()/900+i)*.035);
    if(typeof def?.draw === "function") def.draw(g,{r,disabled:false,age:performance.now()/1000+i},1);
    else throw new Error("Missing Nerf draw function");
    weapon(g,p,r,performance.now()/1000+i,0);
    g.restore();
    g.fillStyle="rgba(255,255,255,.035)";g.fillRect(0,h*.83,w,h*.17);
    g.fillStyle=p.color;g.globalAlpha=.65;g.fillRect(w*.08,h*.92,w*.84,2);g.globalAlpha=1;
  }catch(err){
    fallbackPortrait(canvas,p);
  }
}

function xIcon(){
  const svg=document.createElementNS("http://www.w3.org/2000/svg","http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");svg.classList.add("x-icon-svg");
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d","M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.88-6.38L6.5 22H3.4l7.24-8.28L3 2h6.4l4.4 5.82L18.9 2Zm-1.1 17.8h1.73L8.46 4.08H6.6L17.8 19.8Z");
  svg.appendChild(path);return svg;
}

function render(){
  grid.replaceChildren();
  TEAM_ROSTER.slice(0,6).forEach((def,i)=>{
    try{
      const id=def?.id;
      const p=PROFILE[id]||PROFILE.steve;
      const card=document.createElement("article");
      card.className="nerf-card";card.style.setProperty("--accent",p.color);card.style.setProperty("--delay",`${i*55}ms`);

      const c=document.createElement("canvas");
      c.className="nerf-portrait";
      c.setAttribute("aria-label",`${def?.name||"Nerf"} ${p.weapon}`);

      const name=document.createElement("div");
      name.className="nerf-name";name.textContent=def?.name||"Nerf";

      const x=document.createElement("a");
      x.className="nerf-x";
      const handle=X[id];
      if(handle){
        x.href=`https://x.com/${handle}`;
        x.target="_blank";
        x.rel="noopener noreferrer";
        x.setAttribute("aria-label",`Open ${def.name}'s X profile`);
        x.title=`${def.name} on X`;
      }else{
        x.href="#";
        x.setAttribute("aria-label",`${def?.name||"Nerf"} social profile unavailable`);
        x.setAttribute("aria-disabled","true");
        x.addEventListener("click",e=>e.preventDefault());
      }
      x.appendChild(xIcon());

      const w=document.createElement("div");w.className="nerf-weapon";w.textContent=`◆ ${p.weapon}`;
      const label=document.createElement("div");label.className="nerf-label";label.textContent=`NERF TARGET · ${String(i+1).padStart(2,"0")}`;
      card.append(c,name,x,w,label);grid.appendChild(card);portrait(c,def,i);
    }catch(err){
      const card=document.createElement("article");
      card.className="nerf-card";
      card.innerHTML=`<div class="nerf-name">NERF ${String(i+1).padStart(2,"0")}</div>`;
      grid.appendChild(card);
    }
  });
}

render();

/* The UI module historically attached a competing click handler to this
   button. Capture-phase ownership here prevents the gameplay start handler
   from running when the player's intention is to open the roster. */
document.getElementById("btnHowToPlayBack")?.addEventListener("click",e=>{
  e.preventDefault();
  e.stopImmediatePropagation();
  switchScreen(screen);
},true);

document.getElementById("btnNerfsBack")?.addEventListener("click",e=>{
  e.preventDefault();
  e.stopImmediatePropagation();
  switchScreen(how);
},true);

document.getElementById("btnNerfsStart")?.addEventListener("click",e=>{
  e.preventDefault();
  e.stopImmediatePropagation();
  screen.classList.remove("on","first-in");
  startRun();
},true);

const originalTeamDraw=Teams.draw.bind(Teams);
Teams.draw=function(){
  originalTeamDraw();
  for(const t of this.pool){
    if(!t.on||t.disabled||!t.roster)continue;
    const p=PROFILE[t.roster.id]||PROFILE.steve;
    try{
      ctx.save();ctx.translate(t.x,t.y);
      const aim=t.aimAngle||0;
      weapon(ctx,p,t.r,t.age,aim);
      if(t.attackT>0){
        ctx.globalAlpha=.7;ctx.strokeStyle=p.color;ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(aim)*t.r*2.2,Math.sin(aim)*t.r*2.2);ctx.stroke();ctx.globalAlpha=1;
      }
      ctx.restore();
    }catch(err){
      try{ctx.restore();}catch{}
    }
  }
};

function animateRoster(){
  if(screen.classList.contains("on")){
    grid.querySelectorAll(".nerf-portrait").forEach((c,i)=>{
      const d=TEAM_ROSTER[i];
      if(d) portrait(c,d,i);
    });
  }
  requestAnimationFrame(animateRoster);
}
animateRoster();
window.addEventListener("resize",()=>{if(screen.classList.contains("on"))render()},{passive:true});
