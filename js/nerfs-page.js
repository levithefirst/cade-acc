/* CADE OPS — THE 6 NERFS
   Roster presentation only. Gameplay character rendering remains in teams.js.
   The roster uses local PFP artwork so a gameplay-canvas failure cannot blank
   the character cards.
*/
import { startRun } from "./ui.js";

const screen = document.getElementById("scNerfs");
const grid = document.getElementById("nerfsGrid");
const how = document.getElementById("scHowToPlay");

if (!screen || !grid) throw new Error("CADE OPS: The 6 Nerfs screen is missing.");

const ROSTER = [
  { id:"steve",    name:"Steve",    handle:"steoniy",         weapon:"BAT",     accent:"#FFA800", sprite:"0%" },
  { id:"gnar",     name:"gnar",     handle:"gnarzilla",       weapon:"BLASTER", accent:"#FFB514", sprite:"20%" },
  { id:"kosgood",  name:"Kosgood",  handle:"kosgooood",       weapon:"BOW",     accent:"#FFB514", sprite:"40%" },
  { id:"scotty",   name:"Scotty",   handle:"scottybmitchell", weapon:"HAMMER",  accent:"#FFA800", sprite:"60%" },
  { id:"rookmate", name:"Rookmate", handle:"0xRookmate",      weapon:"RAILGUN", accent:"#FFB514", sprite:"80%" },
  { id:"poppunk",  name:"Pop Punk", handle:"PopPunkOnChain",  weapon:"KATANA",  accent:"#FFA800", sprite:"100%" }
];

function injectRosterStyles(){
  if(document.getElementById("cade-nerfs-roster-style")) return;
  const style=document.createElement("style");
  style.id="cade-nerfs-roster-style";
  style.textContent=`
#scNerfs{background:#101114;justify-content:flex-start;gap:8px;padding:clamp(22px,4vh,38px) max(14px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));overflow-x:hidden;overflow-y:auto}
#scNerfs .nerfs-heading{font-size:clamp(30px,5vw,48px)}
#scNerfs .nerfs-subtitle{text-transform:uppercase;letter-spacing:.16em;font-size:9px;color:rgba(255,255,255,.48)}
#scNerfs .nerfs-grid{width:min(100%,1380px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:8px auto 4px}
#scNerfs .nerf-card{--rx:0deg;--ry:0deg;position:relative;min-width:0;min-height:270px;display:grid;grid-template-rows:minmax(170px,1fr) auto auto;overflow:hidden;background:linear-gradient(150deg,#2F2F2F 0%,#1b1b1b 58%,#141414 100%);border:1px solid rgba(255,255,255,.12);border-top-color:color-mix(in srgb,var(--accent) 55%,rgba(255,255,255,.12));border-radius:16px;box-shadow:0 18px 36px rgba(0,0,0,.36);transform:perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)) translateY(0);transition:transform .22s cubic-bezier(.16,1,.3,1),box-shadow .22s,border-color .22s;animation:cadeNerfIn .5s cubic-bezier(.16,1,.3,1) both;animation-delay:var(--delay);isolation:isolate}
#scNerfs .nerf-card::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(circle at 50% 18%,color-mix(in srgb,var(--accent) 18%,transparent),transparent 48%);pointer-events:none}
#scNerfs .nerf-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--accent);opacity:.85;box-shadow:0 0 18px color-mix(in srgb,var(--accent) 35%,transparent)}
#scNerfs .nerf-card:hover{box-shadow:0 26px 50px rgba(0,0,0,.48),0 0 28px color-mix(in srgb,var(--accent) 12%,transparent)}
#scNerfs .nerf-portrait{width:100%;height:100%;min-height:170px;display:block;background-image:url("../assets/nerfs-sprite.jpg");background-repeat:no-repeat;background-size:600% 100%;background-position:var(--sprite-x) center;background-color:#141414;position:relative;overflow:hidden;transform:translateZ(12px) scale(.98);filter:saturate(.96) contrast(1.03);animation:cadeNerfFloat 4.8s ease-in-out infinite}
#scNerfs .nerf-portrait::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(20,20,20,.74) 100%);pointer-events:none}
#scNerfs .nerf-meta{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding:11px 14px 12px}
#scNerfs .nerf-copy{min-width:0}
#scNerfs .nerf-name{margin:0;font:900 clamp(19px,2vw,27px)/1 var(--display);letter-spacing:.01em;color:#fff}
#scNerfs .nerf-handle{margin-top:5px;font:800 9px/1 var(--mono);letter-spacing:.12em;color:rgba(255,255,255,.5)}
#scNerfs .nerf-weapon{flex:0 0 auto;margin:0;padding:7px 8px;border:1px solid color-mix(in srgb,var(--accent) 36%,rgba(255,255,255,.12));border-radius:999px;font:800 7px/1 var(--mono);letter-spacing:.14em;color:var(--accent);background:rgba(20,20,20,.55)}
#scNerfs .nerf-x{width:36px;height:36px;flex:0 0 36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.14);border-radius:50%;background:#141414;color:#fff;transition:transform .18s,background .18s,border-color .18s;touch-action:manipulation}
#scNerfs .nerf-x:hover,#scNerfs .nerf-x:focus-visible{transform:translateY(-2px) scale(1.06);background:var(--cade-orange);border-color:var(--cade-orange);outline:none}
#scNerfs .nerf-x:active{transform:scale(.94)}
#scNerfs .x-icon-svg{width:15px;height:15px;fill:currentColor}
#scNerfs .nerf-label{padding:0 14px 12px;font:800 7px/1 var(--mono);letter-spacing:.16em;color:rgba(255,255,255,.34)}
#scNerfs .nerfs-actions{width:min(100%,1380px);justify-content:center;gap:8px;margin:4px auto 0}
@media(min-width:1200px){
  #scNerfs .nerfs-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
  #scNerfs .nerf-card{min-height:360px;grid-template-rows:minmax(230px,1fr) auto auto}
  #scNerfs .nerf-portrait{min-height:230px}
  #scNerfs .nerf-meta{display:block;padding:12px 12px 9px}
  #scNerfs .nerf-weapon{display:inline-flex;margin-top:9px}
  #scNerfs .nerf-x{position:absolute;right:10px;bottom:38px}
  #scNerfs .nerf-label{padding:0 12px 11px}
}
@media(max-width:760px){
  #scNerfs{padding-left:12px;padding-right:12px}
  #scNerfs .nerfs-grid{width:100%;display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;padding:5px 3px 14px;margin-left:0;margin-right:0;scrollbar-width:none}
  #scNerfs .nerfs-grid::-webkit-scrollbar{display:none}
  #scNerfs .nerf-card{flex:0 0 min(82vw,330px);min-height:300px;scroll-snap-align:center;scroll-snap-stop:always}
  #scNerfs .nerf-portrait{min-height:205px}
  #scNerfs .nerf-name{font-size:21px}
  #scNerfs .nerf-x{width:34px;height:34px;flex-basis:34px}
}
@media(max-width:430px){
  #scNerfs .nerf-card{flex-basis:84vw;min-height:285px}
  #scNerfs .nerf-portrait{min-height:190px}
  #scNerfs .nerf-name{font-size:19px}
}
@media(prefers-reduced-motion:reduce){
  #scNerfs .nerf-card{animation:none;transition:none;transform:none}
  #scNerfs .nerf-portrait{animation:none}
}
@keyframes cadeNerfIn{from{opacity:0;transform:perspective(900px) translateY(16px) scale(.985)}to{opacity:1;transform:perspective(900px) translateY(0) scale(1)}}
@keyframes cadeNerfFloat{0%,100%{transform:translateZ(12px) scale(.98) translateY(0)}50%{transform:translateZ(18px) scale(1) translateY(-5px)}}
`;
  document.head.appendChild(style);
}

function switchScreen(target){
  if(!target) return;
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("on","first-in"));
  target.classList.add("on","first-in");
  target.scrollTop=0;
}

function xIcon(){
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox","0 0 24 24");
  svg.setAttribute("aria-hidden","true");
  svg.classList.add("x-icon-svg");
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d","M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.88-6.38L6.5 22H3.4l7.24-8.28L3 2h6.4l4.4 5.82L18.9 2Zm-1.1 17.8h1.73L8.46 4.08H6.6L17.8 19.8Z");
  svg.appendChild(path);
  return svg;
}

function makeCard(def,i){
  const card=document.createElement("article");
  card.className="nerf-card";
  card.style.setProperty("--accent",def.accent);
  card.style.setProperty("--sprite-x",def.sprite);
  card.style.setProperty("--delay",`${i*55}ms`);

  const portrait=document.createElement("div");
  portrait.className="nerf-portrait";
  portrait.setAttribute("role","img");
  portrait.setAttribute("aria-label",`${def.name}, ${def.handle}, ${def.weapon}`);

  const meta=document.createElement("div");
  meta.className="nerf-meta";
  const copy=document.createElement("div");
  copy.className="nerf-copy";

  const name=document.createElement("div");
  name.className="nerf-name";
  name.textContent=def.name;

  const handle=document.createElement("div");
  handle.className="nerf-handle";
  handle.textContent=`@${def.handle}`;

  const weapon=document.createElement("span");
  weapon.className="nerf-weapon";
  weapon.textContent=`◆ ${def.weapon}`;

  const social=document.createElement("a");
  social.className="nerf-x";
  social.href=`https://x.com/${def.handle}`;
  social.target="_blank";
  social.rel="noopener noreferrer";
  social.setAttribute("aria-label",`Open ${def.name}'s X profile`);
  social.title=`${def.name} on X`;
  social.appendChild(xIcon());

  const label=document.createElement("div");
  label.className="nerf-label";
  label.textContent=`NERF TARGET · ${String(i+1).padStart(2,"0")}`;

  copy.append(name,handle);
  meta.append(copy,weapon,social);
  card.append(portrait,meta,label);

  card.addEventListener("pointermove",e=>{
    if(window.matchMedia("(pointer:fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      const r=card.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      card.style.setProperty("--ry",`${x*5}deg`);
      card.style.setProperty("--rx",`${-y*4}deg`);
    }
  });
  card.addEventListener("pointerleave",()=>{
    card.style.setProperty("--rx","0deg");
    card.style.setProperty("--ry","0deg");
  });
  return card;
}

function render(){
  grid.replaceChildren();
  ROSTER.forEach((def,i)=>{
    try{ grid.appendChild(makeCard(def,i)); }
    catch(err){
      const fallback=document.createElement("article");
      fallback.className="nerf-card";
      fallback.style.setProperty("--accent",def.accent);
      fallback.textContent=def.name;
      grid.appendChild(fallback);
    }
  });
}

injectRosterStyles();
render();

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
