import { startRun, show, scTitle } from "./ui.js";

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

// Per-character idle-fx personality: relative pacing only, keeps all six on one shared system.
const FX = {
  steve:    { float:"5.6s", amt:"5px", glitch:"11s", gAmt:"2px",   scan:"8s",   sweep:"9s",   glow:"6.5s" },
  gnar:     { float:"4.2s", amt:"6px", glitch:"6.5s", gAmt:"3px",   scan:"6s",   sweep:"8s",   glow:"4.5s" },
  kosgood:  { float:"5.8s", amt:"5px", glitch:"10s",  gAmt:"3.5px", scan:"7s",   sweep:"6.5s", glow:"7s"   },
  scotty:   { float:"6.4s", amt:"8px", glitch:"9s",   gAmt:"2.5px", scan:"7.5s", sweep:"10s",  glow:"8s"   },
  rookmate: { float:"4.4s", amt:"6px", glitch:"6s",   gAmt:"3.5px", scan:"6.5s", sweep:"8.5s", glow:"5s"   },
  poppunk:  { float:"4s",   amt:"6px", glitch:"5s",   gAmt:"3px",   scan:"4.5s", sweep:"7s",   glow:"4s"   }
};

function injectStyles(){
  if(document.getElementById("cade-nerfs-roster-style")) return;
  const style=document.createElement("style");
  style.id="cade-nerfs-roster-style";
  style.textContent=`
#scNerfs{min-height:100svh;height:100dvh;box-sizing:border-box;background:#101114;justify-content:safe center;gap:8px;padding:clamp(22px,4vh,38px) max(14px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));overflow-x:hidden;overflow-y:auto}
#scNerfs .nerfs-heading{font-size:clamp(30px,5vw,48px)}
#scNerfs .nerfs-subtitle{text-transform:uppercase;letter-spacing:.16em;font-size:9px;color:rgba(255,255,255,.48)}
#scNerfs .nerfs-grid{width:min(100%,1380px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:8px auto 4px}
#scNerfs .nerf-card{--rx:0deg;--ry:0deg;position:relative;min-width:0;min-height:270px;display:grid;grid-template-rows:minmax(170px,1fr) auto auto;overflow:hidden;background:linear-gradient(150deg,#2F2F2F 0%,#1b1b1b 58%,#141414 100%);border:1px solid rgba(255,255,255,.12);border-top-color:color-mix(in srgb,var(--accent) 55%,rgba(255,255,255,.12));border-radius:16px;transform:perspective(900px) rotateX(var(--rx)) rotateY(var(--ry));transition:transform .22s cubic-bezier(.16,1,.3,1),border-color .22s;animation:cadeNerfIn .5s cubic-bezier(.16,1,.3,1) var(--delay) both,cadeNerfCardGlow var(--glow-dur,6s) ease-in-out var(--float-delay,0s) infinite;isolation:isolate}
#scNerfs .nerf-card::before{content:"";position:absolute;inset:0;z-index:0;background:radial-gradient(circle at 50% 18%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 48%);pointer-events:none}
#scNerfs .nerf-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--accent);opacity:.85;box-shadow:0 0 18px color-mix(in srgb,var(--accent) 35%,transparent);z-index:5}
#scNerfs .nerf-portrait{grid-row:1;position:relative;width:100%;height:100%;min-height:170px;overflow:hidden;background:#141414;z-index:1;transform:translateZ(12px);isolation:isolate}
#scNerfs .nerf-portrait-motion{position:absolute;inset:0;animation:cadeNerfFloat var(--float-dur,4.8s) ease-in-out infinite;animation-delay:var(--float-delay,0s)}
#scNerfs .nerf-portrait-motion img{position:absolute;top:0;left:calc(var(--sprite-index) * -100%);width:600%;height:100%;max-width:none;display:block;object-fit:cover;object-position:left center;user-select:none;-webkit-user-drag:none;filter:saturate(.96) contrast(1.03);animation:cadeNerfImgGlitch var(--glitch-dur,9s) steps(1) infinite;animation-delay:var(--glitch-delay,0s)}
#scNerfs .nerf-glitch{position:absolute;top:0;left:calc(var(--sprite-index) * -100%);width:600%;height:100%;background-image:url(${IMAGE});background-size:cover;background-position:center;pointer-events:none;mix-blend-mode:screen;opacity:0}
#scNerfs .nerf-glitch-r{filter:sepia(1) saturate(6) hue-rotate(-50deg) brightness(1.15);animation:cadeNerfGlitchR var(--glitch-dur,9s) steps(1) infinite;animation-delay:var(--glitch-delay,0s)}
#scNerfs .nerf-glitch-b{filter:sepia(1) saturate(6) hue-rotate(150deg) brightness(1.15);animation:cadeNerfGlitchB var(--glitch-dur,9s) steps(1) infinite;animation-delay:var(--glitch-delay,0s)}
#scNerfs .nerf-scan{position:absolute;inset:0;z-index:2;pointer-events:none;mix-blend-mode:screen;opacity:.4;background:repeating-linear-gradient(to bottom,rgba(255,255,255,.16) 0 1px,transparent 1px 3px);background-size:100% 6px;animation:cadeNerfScan var(--scan-dur,7s) linear infinite}
#scNerfs .nerf-sweep{position:absolute;inset:-20% -60%;z-index:3;pointer-events:none;mix-blend-mode:screen;background:linear-gradient(115deg,transparent 40%,color-mix(in srgb,var(--accent) 65%,white) 50%,transparent 60%);background-size:250% 250%;background-position:-60% -60%;opacity:.55;animation:cadeNerfSweep var(--sweep-dur,9s) ease-in-out infinite}
#scNerfs .nerf-noise{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:.05;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='60' height='60' filter='url(%23n)'/></svg>");animation:cadeNerfNoiseFlicker 3.4s steps(2) infinite}
#scNerfs .nerf-portrait::after{content:"";position:absolute;inset:0;z-index:5;background:linear-gradient(180deg,transparent 55%,rgba(20,20,20,.68) 100%);pointer-events:none}
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
@media(max-width:760px){#scNerfs{padding-left:12px;padding-right:12px}#scNerfs .nerfs-grid{width:100%;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:6px auto 4px}#scNerfs .nerf-card{min-height:225px;grid-template-rows:minmax(130px,1fr) auto auto}#scNerfs .nerf-portrait{min-height:130px}#scNerfs .nerf-name{font-size:15px}#scNerfs .nerf-handle{font-size:8px}#scNerfs .nerf-meta{padding:8px 10px 9px}#scNerfs .nerf-weapon{padding:5px 6px;font-size:6px}#scNerfs .nerf-x{width:28px;height:28px;flex-basis:28px}#scNerfs .nerf-label{padding:0 10px 9px;font-size:6px}}
@media(max-width:430px){#scNerfs .nerf-card{min-height:210px}#scNerfs .nerf-portrait{min-height:118px}#scNerfs .nerf-name{font-size:14px}}
@media(max-height:740px){#scNerfs{padding-top:14px;padding-bottom:14px;gap:5px}#scNerfs .nerfs-heading{font-size:clamp(24px,5vw,34px)}}
@media(prefers-reduced-motion:reduce){
#scNerfs .nerf-card{animation:none;transition:none;transform:none;box-shadow:0 18px 36px rgba(0,0,0,.36),0 0 0 1px color-mix(in srgb,var(--accent) 26%,transparent)}
#scNerfs .nerf-portrait-motion{animation:none}
#scNerfs .nerf-portrait-motion img{animation:none;transform:translateZ(0) scale(1.01)}
#scNerfs .nerf-glitch{animation:none}
#scNerfs .nerf-scan,#scNerfs .nerf-sweep,#scNerfs .nerf-noise{animation:none}
}
@keyframes cadeNerfIn{from{opacity:0;transform:perspective(900px) translateY(16px) scale(.985)}to{opacity:1;transform:perspective(900px) translateY(0) scale(1)}}
@keyframes cadeNerfCardGlow{
0%,100%{box-shadow:0 18px 36px rgba(0,0,0,.36),0 0 0 1px color-mix(in srgb,var(--accent) 26%,transparent),0 0 7px 0 color-mix(in srgb,var(--accent) 12%,transparent)}
50%{box-shadow:0 18px 36px rgba(0,0,0,.36),0 0 0 1px color-mix(in srgb,var(--accent) 46%,transparent),0 0 14px 1px color-mix(in srgb,var(--accent) 24%,transparent)}
}
@keyframes cadeNerfFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(calc(var(--float-amt,5px) * -1)) scale(1.018)}}
@keyframes cadeNerfImgGlitch{
0%,90%{transform:translateZ(0) scale(1.01) translateX(0)}
91%,92.5%{transform:translateZ(0) scale(1.01) translateX(calc(var(--glitch-amt,2.5px) * 1.4))}
93.5%{transform:translateZ(0) scale(1.01) translateX(0)}
95%,96.5%{transform:translateZ(0) scale(1.01) translateX(calc(var(--glitch-amt,2.5px) * -1.4))}
97.5%,100%{transform:translateZ(0) scale(1.01) translateX(0)}
}
@keyframes cadeNerfGlitchR{
0%,90%{opacity:0;transform:translateX(0)}
91%,92.5%{opacity:.4;transform:translateX(calc(var(--glitch-amt,2.5px) * -1))}
93.5%{opacity:0;transform:translateX(0)}
95%,96.5%{opacity:.36;transform:translateX(calc(var(--glitch-amt,2.5px) * -1.6))}
97.5%,100%{opacity:0;transform:translateX(0)}
}
@keyframes cadeNerfGlitchB{
0%,90%{opacity:0;transform:translateX(0)}
91%,92.5%{opacity:.4;transform:translateX(var(--glitch-amt,2.5px))}
93.5%{opacity:0;transform:translateX(0)}
95%,96.5%{opacity:.36;transform:translateX(calc(var(--glitch-amt,2.5px) * 1.6))}
97.5%,100%{opacity:0;transform:translateX(0)}
}
@keyframes cadeNerfScan{0%{background-position-y:0}100%{background-position-y:120px}}
@keyframes cadeNerfSweep{0%,68%{background-position:-60% -60%}82%{background-position:140% 140%}100%{background-position:140% 140%}}
@keyframes cadeNerfNoiseFlicker{0%,100%{opacity:.045}50%{opacity:.09}}`;
  document.head.appendChild(style);
}

function renderRoster(){
  grid.innerHTML="";
  ROSTER.forEach((p,i)=>{
    const card=document.createElement("article");
    card.className="nerf-card";
    card.style.setProperty("--accent",p.accent);
    card.style.setProperty("--sprite-index",p.index);
    card.style.setProperty("--delay",`${i*55}ms`);
    const fx=FX[p.id]||{};
    card.style.setProperty("--float-dur",fx.float||"4.8s");
    card.style.setProperty("--float-amt",fx.amt||"4px");
    card.style.setProperty("--glitch-dur",fx.glitch||"9s");
    card.style.setProperty("--glitch-amt",fx.gAmt||"2.5px");
    card.style.setProperty("--scan-dur",fx.scan||"7s");
    card.style.setProperty("--sweep-dur",fx.sweep||"9s");
    card.style.setProperty("--glow-dur",fx.glow||"6s");
    card.style.setProperty("--float-delay",`${-i*0.7}s`);
    card.style.setProperty("--glitch-delay",`${-i*1.3}s`);
    card.innerHTML=`
      <div class="nerf-portrait" aria-label="${p.name} character artwork">
        <div class="nerf-portrait-motion">
          <img src="${IMAGE}" alt="${p.name} PFP" width="128" height="128" loading="eager" decoding="async" draggable="false">
          <div class="nerf-glitch nerf-glitch-r" aria-hidden="true"></div>
          <div class="nerf-glitch nerf-glitch-b" aria-hidden="true"></div>
        </div>
        <div class="nerf-scan" aria-hidden="true"></div>
        <div class="nerf-sweep" aria-hidden="true"></div>
        <div class="nerf-noise" aria-hidden="true"></div>
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

document.getElementById("btnNerfsBack")?.addEventListener("click",()=>{ show(scTitle); scTitle.scrollTop=0; });
document.getElementById("btnNerfsStart")?.addEventListener("click",()=>startRun());
