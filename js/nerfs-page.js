import "./visual-fix.js";
import { startRun } from "./ui.js";

const screen = document.getElementById("scNerfs");
const grid = document.getElementById("nerfsGrid");
const IMAGE = "/assets/nerfs-sprite.jpg?v=2";

const ROSTER = [
  { id:"steve", name:"Steve", handle:"steoniy", weapon:"BAT", accent:"#FFA800", index:0 },
  { id:"gnar", name:"gnar", handle:"gnarzilla", weapon:"BLASTER", accent:"#FFB514", index:1 },
  { id:"kosgood", name:"Kosgood", handle:"kosgooood", weapon:"BOW", accent:"#FFB514", index:2 },
  { id:"scotty", name:"Scotty", handle:"scottybmitchell", weapon:"HAMMER", accent:"#FFA800", index:3 },
  { id:"rookmate", name:"Rookmate", handle:"0xRookmate", weapon:"RAILGUN", accent:"#FFB514", index:4 },
  { id:"poppunk", name:"Pop Punk", handle:"PopPunkOnChain", weapon:"KATANA", accent:"#FFA800", index:5 }
];

if (!screen || !grid) throw new Error("CADE OPS: NERFS screen markup is missing.");

function injectStyles(){
  if(document.getElementById("cade-nerfs-roster-style")) return;
  const style=document.createElement("style");
  style.id="cade-nerfs-roster-style";
  style.textContent=`
#scNerfs{background:#101114;justify-content:flex-start;gap:8px;padding:clamp(22px,4vh,38px) max(14px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));overflow-x:hidden;overflow-y:auto}
#scNerfs .nerfs-heading{font-size:clamp(30px,5vw,48px)}
#scNerfs .nerfs-subtitle{text-transform:uppercase;letter-spacing:.16em;font-size:9px;color:rgba(255,255,255,.48)}
#scNerfs .nerfs-grid{width:min(100%,1380px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:8px auto 4px}
#scNerfs .nerf-card{--rx:0deg;--ry:0deg;position:relative;min-width:0;min-height:270px;display:grid;grid-template-rows:minmax(170px,1fr) auto auto;overflow:hidden;background:linear-gradient(150deg,#2F2F2F 0%,#1b1b1b 58%,#141414 100%);border:1px solid rgba(255,255,255,.12);border-top-color:color-mix(in srgb,var(--accent) 55%,rgba(255,255,255,.12));border-radius:16px;box-shadow:0 18px 36px rgba(0,0,0,.36);transform:perspective(900px) rotateX(var(--rx)) rotateY(var(--ry));transition:transform .22s cubic-bezier(.16,1,.3,1),box-shadow .22s,border-color .22s;animation:cadeNerfIn .5s cubic-bezier(.16,1,.3,1) both;animation-delay:var(--delay);isolation:isolate}
#scNerfs .nerf-card::before{content:"";position:absolute;inset:0;z-index:0;background:radial-gradient(circle at 50% 18%,color-mix(in srgb,var(--accent) 18%,transparent),transparent 48%);pointer-events:none}
#scNerfs .nerf-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--accent);opacity:.85;box-shadow:0 0 18px color-mix(in srgb,var(--accent) 35%,transparent);z-index:5}
#scNerfs .nerf-portrait{grid-row:1;position:relative;width:100%;height:100%;min-height:170px;overflow:hidden;background:#141414;z-index:1;transform:translateZ(12px);isolation:isolate}
#scNerfs .nerf-portrait img{position:absolute;top:0;left:calc(var(--sprite-index) * -100%);width:600%;height:100%;max-width:none;display:block;object-fit:fill;object-position:left top;user-select:none;-webkit-user-drag:none;transform:translateZ(0) scale(1.01);filter:saturate(.96) contrast(1.03);animation:cadeNerfFloat 4.8s ease-in-out infinite}
#scNerfs .nerf-portrait::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(20,20,20,.68) 100%);pointer-events:none;z-index:2}
#scNerfs .nerf-meta{position:relative;z-index:3;display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding:11px 14px 12px}
#scNerfs .nerf-copy{min-width:0}
#scNerfs .nerf-name{margin:0;font:900 clamp(19px,2vw,27px)/1 var(--display);letter-spacing:.01em;color:#fff}
#scNerfs .nerf-handle{margin-top:5px;font:800 9px/1 var(--mono);letter-spacing:.12em;color:rgba(255,255,255,.5)}
#scNerfs .nerf-weapon{flex:0 0 auto;margin:0;padding:7px 8px;border:1px solid color-mix(in srgb,var(--accent) 36%,rgba(255,255,255,.12));border-radius:999px;font:800 7px/1 var(--mono);letter-spacing:.14em;color:var(--accent);background:rgba(20,20,20,.55)}
#scNerfs .nerf-x{width:36px;height:36px;flex:0 0 36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.14);border-radius:50%;background:#141414;color:#fff;transition:transform .18s,background .18s,border-color .18s;touch-action:manipulation;position:relative;z-index:4}
#scNerfs .nerf-x:hover,#scNerfs .nerf-x:focus-visible{transform:translateY(-2px) scale(1.06);background:#FFA800;border-color:#FFA800;outline:none}
#scNerfs .nerf-x:active{transform:scale(.94)}
#scNerfs .x-icon-svg{width:15px;height:15px;fill:currentColor}
#scNerfs .nerf-label{position:relative;z-index:3;padding:0 14px 12px;font:800 7px/1 var(--mono);letter-spacing:.16em;color:rgba(255,255,255,.34)}
#scNerfs .nerfs-actions{width:min(100%,1380px);justify-content:center;gap:8px;margin:4px auto 0}
@media(min-width:1200px){#scNerfs .nerfs-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}#scNerfs .nerf-card{min-height:360px;grid-template-rows:minmax(230px,1fr) auto auto}#scNerfs .nerf-portrait{min-height:230px}#scNerfs .nerf-meta{display:block;padding:12px 12px 9px}#scNerfs .nerf-weapon{display:inline-flex;margin-top:9px}#scNerfs .nerf-x{position:absolute;right:10px;bottom:38px}#scNerfs .nerf-label{padding:0 12px 11px}}
@media(max-width:760px){#scNerfs{padding-left:12px;padding-right:12px}#scNerfs .nerfs-grid{width:100%;display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;padding:5px 3px 14px;margin-left:0;margin-right:0;scrollbar-width:none}#scNerfs .nerfs-grid::-webkit-scrollbar{display:none}#scNerfs .nerf-card{flex:0 0 min(82vw,330px);min-height:300px;scroll-snap-align:center;scroll-snap-stop:always}#scNerfs .nerf-portrait{min-height:205px}#scNerfs .nerf-name{font-size:21px}#scNerfs .nerf-x{width:34px;height:34px;flex-basis:34px}}
@media(max-width:430px){#scNerfs .nerf-card{flex-basis:84vw;min-height:285px}#scNerfs .nerf-portrait{min-height:190px}#scNerfs .nerf-name{font-size:19px}}
@media(prefers-reduced-motion:reduce){#scNerfs .nerf-card{animation:none;transition:none;transform:none}#scNerfs .nerf-portrait img{animation:none}}
@keyframes cadeNerfIn{from{opacity:0;transform:perspective(900px) translateY(16px) scale(.985)}to{opacity:1;transform:perspective(900px) translateY(0) scale(1)}}
@keyframes cadeNerfFloat{0%,100%{transform:translateZ(0) scale(1.01) translateY(0)}50%{transform:translateZ(8px) scale(1.03) translateY(-5px)}}`;
  document.head.appendChild(style);
}

function showScreen(target){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("show"));
  target.classList.add("show");
  target.scrollTop=0;
}

function renderRoster(){
  grid.innerHTML="";
  ROSTER.forEach((p,i)=>{
    const card=document.createElement("article");
    card.className="nerf-card";
    card.style.setProperty("--accent",p.accent);
    card.style.setProperty("--sprite-index",p.index);
    card.style.setProperty("--delay",`${i*55}ms`);
    card.innerHTML=`
      <div class="nerf-portrait" aria-label="${p.name} character artwork">
        <img src="${IMAGE}" alt="${p.name} PFP" width="128" height="128" loading="eager" decoding="async" draggable="false">
      </div>
      <div class="nerf-meta">
        <div class="nerf-copy"><h2 class="nerf-name">${p.name}</h2><div class="nerf-handle">@${p.handle}</div></div>
        <span class="nerf-weapon">${p.weapon}</span>
        <a class="nerf-x" href="https://x.com/${encodeURIComponent(p.handle)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${p.name} on X"><svg class="x-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.965 6.817H1.68l7.73-8.835L1.254 2.25h6.824l4.713 6.231 5.453-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg></a>
      </div>
      <div class="nerf-label">NERF TARGET · ${String(i+1).padStart(2,"0")}</div>`;
    grid.appendChild(card);
    card.addEventListener("pointermove",e=>{
      if(e.pointerType==="touch") return;
      const r=card.getBoundingClientRect();
      card.style.setProperty("--rx",`${((e.clientY-r.top)/r.height-.5)*-4}deg`);
      card.style.setProperty("--ry",`${((e.clientX-r.left)/r.width-.5)*5}deg`);
    });
    card.addEventListener("pointerleave",()=>{card.style.setProperty("--rx","0deg");card.style.setProperty("--ry","0deg")});
  });
}

injectStyles();
renderRoster();

document.getElementById("btnNerfsBack")?.addEventListener("click",()=>showScreen(document.getElementById("scTitle")));
document.getElementById("btnNerfsStart")?.addEventListener("click",()=>startRun());
