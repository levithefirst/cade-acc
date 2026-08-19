import { startRun, show, scTitle, goBack } from "./ui.js";
import { COMBAT } from "./combat-ai.js";
import { TEAM_ROSTER } from "./teams.js";

const screen = document.getElementById("scNerfs");
const grid = document.getElementById("nerfsGrid");

const ROSTER = [
  { id:"steve", name:"Steve", handle:"steoniy", weapon:"BAT", accent:"#FFA800", img:"/assets/nerfs/steve.jpg" },
  { id:"gnar", name:"gnar", handle:"gnarzilla", weapon:"BLASTER", accent:"#FFB514", img:"/assets/nerfs/gnar.jpg" },
  { id:"kosgood", name:"Kosgood", handle:"kosgooood", weapon:"BOW", accent:"#FFB514", img:"/assets/nerfs/kosgood.jpg" },
  { id:"scotty", name:"Scotty", handle:"scottybmitchell", weapon:"HAMMER", accent:"#FFA800", img:"/assets/nerfs/scotty.jpg" },
  { id:"rookmate", name:"Rookmate", handle:"0xRookmate", weapon:"RAILGUN", accent:"#FFB514", img:"/assets/nerfs/rookmate.jpg" },
  { id:"poppunk", name:"Pop Punk", handle:"PopPunkOnChain", weapon:"KATANA", accent:"#FFA800", img:"/assets/nerfs/poppunk.jpg" }
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
#scNerfs{min-height:100svh;height:100dvh;box-sizing:border-box;background:#101114;justify-content:safe center;gap:10px;padding:clamp(22px,4vh,38px) 0 max(22px,env(safe-area-inset-bottom));overflow-x:hidden;overflow-y:auto}
#scNerfs .nerfs-heading{font-size:clamp(30px,5vw,48px)}
#scNerfs .nerfs-subtitle{text-transform:uppercase;letter-spacing:.16em;font-size:9px;color:rgba(255,255,255,.48)}
#scNerfs .nerfs-carousel-shell{--card-w:min(74vw,300px);position:relative;width:100%;margin:8px 0 4px}
#scNerfs .nerfs-grid{display:flex;align-items:flex-start;gap:16px;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;padding:10px calc(50% - (var(--card-w) / 2)) 20px;scrollbar-width:none}
#scNerfs .nerfs-grid::-webkit-scrollbar{display:none}
#scNerfs .nerf-card{--rx:0deg;--ry:0deg;scroll-snap-align:center;scroll-snap-stop:always;flex:0 0 var(--card-w);width:var(--card-w);position:relative;display:grid;grid-template-rows:calc(var(--card-w) * 1.02) auto auto;overflow:hidden;background:linear-gradient(150deg,#2F2F2F 0%,#1b1b1b 58%,#141414 100%);border:1px solid rgba(255,255,255,.12);border-top-color:color-mix(in srgb,var(--accent) 55%,rgba(255,255,255,.12));border-radius:16px;transform:perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)) scale(.84);filter:brightness(.5) saturate(.65);transition:transform .4s cubic-bezier(.16,1,.3,1),filter .4s ease,border-color .22s,box-shadow .4s ease;animation:cadeNerfIn .5s cubic-bezier(.16,1,.3,1) var(--delay) backwards;isolation:isolate;box-shadow:0 14px 28px rgba(0,0,0,.4)}
#scNerfs .nerf-card.is-active{transform:perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)) scale(1);filter:brightness(1) saturate(1);z-index:2;animation:cadeNerfIn .5s cubic-bezier(.16,1,.3,1) var(--delay) backwards,cadeNerfCardGlow var(--glow-dur,6s) ease-in-out var(--float-delay,0s) infinite}
#scNerfs .nerf-card::before{content:"";position:absolute;inset:0;z-index:0;background:radial-gradient(circle at 50% 18%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 48%);pointer-events:none;opacity:0;transition:opacity .4s ease}
#scNerfs .nerf-card.is-active::before{opacity:1}
#scNerfs .nerf-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--accent);opacity:.4;box-shadow:none;z-index:5;transition:opacity .4s ease,box-shadow .4s ease}
#scNerfs .nerf-card.is-active::after{opacity:.85;box-shadow:0 0 18px color-mix(in srgb,var(--accent) 35%,transparent)}
#scNerfs .nerf-portrait{grid-row:1;position:relative;width:100%;height:100%;overflow:hidden;background:#141414;z-index:1;isolation:isolate}
#scNerfs .nerf-portrait-motion{position:absolute;inset:0;animation:cadeNerfFloat var(--float-dur,4.8s) ease-in-out infinite;animation-delay:var(--float-delay,0s)}
#scNerfs .nerf-card:not(.is-active) .nerf-portrait-motion{animation-play-state:paused}
#scNerfs .nerf-portrait-motion img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;object-position:center 12%;user-select:none;-webkit-user-drag:none;filter:saturate(.97) contrast(1.02)}
#scNerfs .nerf-card.is-active .nerf-portrait-motion img{animation:cadeNerfImgGlitch var(--glitch-dur,9s) steps(1) infinite;animation-delay:var(--glitch-delay,0s)}
#scNerfs .nerf-glitch{position:absolute;inset:0;background-size:cover;background-position:center 12%;pointer-events:none;mix-blend-mode:screen;opacity:0}
#scNerfs .nerf-card.is-active .nerf-glitch-r{animation:cadeNerfGlitchR var(--glitch-dur,9s) steps(1) infinite;animation-delay:var(--glitch-delay,0s)}
#scNerfs .nerf-card.is-active .nerf-glitch-b{animation:cadeNerfGlitchB var(--glitch-dur,9s) steps(1) infinite;animation-delay:var(--glitch-delay,0s)}
#scNerfs .nerf-glitch-r{filter:sepia(1) saturate(6) hue-rotate(-50deg) brightness(1.15)}
#scNerfs .nerf-glitch-b{filter:sepia(1) saturate(6) hue-rotate(150deg) brightness(1.15)}
#scNerfs .nerf-scan{position:absolute;inset:0;z-index:2;pointer-events:none;mix-blend-mode:screen;opacity:0;background:repeating-linear-gradient(to bottom,rgba(255,255,255,.16) 0 1px,transparent 1px 3px);background-size:100% 6px}
#scNerfs .nerf-card.is-active .nerf-scan{opacity:.4;animation:cadeNerfScan var(--scan-dur,7s) linear infinite}
#scNerfs .nerf-sweep{position:absolute;inset:-20% -60%;z-index:3;pointer-events:none;mix-blend-mode:screen;background:linear-gradient(115deg,transparent 40%,color-mix(in srgb,var(--accent) 65%,white) 50%,transparent 60%);background-size:250% 250%;background-position:-60% -60%;opacity:0}
#scNerfs .nerf-card.is-active .nerf-sweep{opacity:.55;animation:cadeNerfSweep var(--sweep-dur,9s) ease-in-out infinite}
#scNerfs .nerf-noise{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='60' height='60' filter='url(%23n)'/></svg>")}
#scNerfs .nerf-card.is-active .nerf-noise{opacity:.05;animation:cadeNerfNoiseFlicker 3.4s steps(2) infinite}
#scNerfs .nerf-portrait::after{content:"";position:absolute;inset:0;z-index:5;background:linear-gradient(180deg,transparent 55%,rgba(20,20,20,.68) 100%);pointer-events:none}
#scNerfs .nerf-meta{position:relative;z-index:3;display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding:11px 14px 12px}
#scNerfs .nerf-copy{min-width:0}
#scNerfs .nerf-name{margin:0;font:900 clamp(18px,4vw,24px)/1 var(--display);letter-spacing:.01em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#scNerfs .nerf-handle{margin-top:5px;font:800 9px/1 var(--mono);letter-spacing:.12em;color:rgba(255,255,255,.5)}
#scNerfs .nerf-weapon{flex:0 0 auto;margin:0;padding:7px 8px;border:1px solid color-mix(in srgb,var(--accent) 36%,rgba(255,255,255,.12));border-radius:999px;font:800 7px/1 var(--mono);letter-spacing:.14em;color:var(--accent);background:rgba(20,20,20,.55)}
#scNerfs .nerf-x{width:34px;height:34px;flex:0 0 34px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.14);border-radius:50%;background:#141414;color:#fff;transition:transform .18s,background .18s,border-color .18s;touch-action:manipulation;position:relative;z-index:4}
#scNerfs .nerf-x:hover,#scNerfs .nerf-x:focus-visible{transform:translateY(-2px) scale(1.06);background:#FFA800;border-color:#FFA800;outline:none}
#scNerfs .nerf-x:active{transform:scale(.94)}
#scNerfs .x-icon-svg{width:14px;height:14px;fill:currentColor}
#scNerfs .nerf-label{position:relative;z-index:3;padding:0 14px 12px;font:800 7px/1 var(--mono);letter-spacing:.16em;color:rgba(255,255,255,.34)}
#scNerfs .nerfs-actions{width:min(100%,1380px);justify-content:center;gap:8px;margin:4px auto 0;padding:0 16px}
#scNerfs .nerfs-nav{position:absolute;top:calc((var(--card-w) * 1.02 / 2) + 10px);transform:translateY(-50%);width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(16,17,20,.7);backdrop-filter:blur(6px);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .18s,border-color .18s,transform .18s;z-index:6;touch-action:manipulation}
#scNerfs .nerfs-nav:hover,#scNerfs .nerfs-nav:focus-visible{background:#FFA800;border-color:#FFA800;color:#141414;outline:none}
#scNerfs .nerfs-nav:active{transform:translateY(-50%) scale(.92)}
#scNerfs .nerfs-nav svg{width:18px;height:18px}
#scNerfs .nerfs-nav-prev{left:6px}
#scNerfs .nerfs-nav-next{right:6px}
#scNerfs .nerfs-nav[disabled]{opacity:.25;pointer-events:none}
@media(min-width:600px){#scNerfs .nerfs-carousel-shell{--card-w:min(46vw,320px)}}
@media(min-width:900px){#scNerfs .nerfs-carousel-shell{--card-w:300px}}
@media(min-width:1200px){#scNerfs .nerfs-carousel-shell{--card-w:320px}#scNerfs .nerfs-grid{gap:22px}#scNerfs .nerfs-nav-prev{left:24px}#scNerfs .nerfs-nav-next{right:24px}}
@media(max-height:740px){#scNerfs{padding-top:14px;padding-bottom:14px;gap:6px}#scNerfs .nerfs-heading{font-size:clamp(24px,5vw,34px)}#scNerfs .nerfs-carousel-shell{--card-w:min(58vw,230px)}}
@media(max-height:460px){#scNerfs{padding-top:8px;padding-bottom:8px;gap:3px}#scNerfs .eyebrow{display:none}#scNerfs .nerfs-heading{font-size:clamp(17px,4vw,22px)}#scNerfs .nerfs-subtitle{display:none}#scNerfs .nerfs-carousel-shell{--card-w:min(30vw,150px);margin:4px 0}#scNerfs .nerf-meta{padding:6px 9px 7px}#scNerfs .nerf-name{font-size:13px}#scNerfs .nerf-handle{font-size:7px;margin-top:2px}#scNerfs .nerf-weapon{padding:4px 5px;font-size:6px}#scNerfs .nerf-x{width:22px;height:22px;flex-basis:22px}#scNerfs .x-icon-svg{width:11px;height:11px}#scNerfs .nerf-label{padding:0 9px 7px;font-size:6px}#scNerfs .nerfs-nav{width:30px;height:30px}#scNerfs .nerfs-nav svg{width:14px;height:14px}#scNerfs .nerfs-actions{margin-top:2px}}
@media(prefers-reduced-motion:reduce){
#scNerfs .nerfs-grid{scroll-behavior:auto}
#scNerfs .nerf-card{transition:filter .2s ease;animation:none}
#scNerfs .nerf-card.is-active{animation:none;box-shadow:0 14px 28px rgba(0,0,0,.4),0 0 0 1px color-mix(in srgb,var(--accent) 26%,transparent)}
#scNerfs .nerf-portrait-motion{animation:none}
#scNerfs .nerf-card.is-active .nerf-portrait-motion img{animation:none}
#scNerfs .nerf-card.is-active .nerf-glitch-r,#scNerfs .nerf-card.is-active .nerf-glitch-b{animation:none}
#scNerfs .nerf-card.is-active .nerf-scan,#scNerfs .nerf-card.is-active .nerf-sweep,#scNerfs .nerf-card.is-active .nerf-noise{animation:none;opacity:0}
}
@keyframes cadeNerfIn{from{opacity:0;transform:perspective(900px) translateY(16px) scale(.9)}to{opacity:1;transform:perspective(900px) translateY(0) scale(.92)}}
@keyframes cadeNerfCardGlow{
0%,100%{box-shadow:0 14px 28px rgba(0,0,0,.4),0 0 0 1px color-mix(in srgb,var(--accent) 26%,transparent),0 0 7px 0 color-mix(in srgb,var(--accent) 12%,transparent)}
50%{box-shadow:0 14px 28px rgba(0,0,0,.4),0 0 0 1px color-mix(in srgb,var(--accent) 46%,transparent),0 0 14px 1px color-mix(in srgb,var(--accent) 24%,transparent)}
}
@keyframes cadeNerfFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(calc(var(--float-amt,5px) * -1)) scale(1.018)}}
@keyframes cadeNerfImgGlitch{
0%,90%{transform:translateX(0)}
91%,92.5%{transform:translateX(calc(var(--glitch-amt,2.5px) * 1.4))}
93.5%{transform:translateX(0)}
95%,96.5%{transform:translateX(calc(var(--glitch-amt,2.5px) * -1.4))}
97.5%,100%{transform:translateX(0)}
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
@keyframes cadeNerfNoiseFlicker{0%,100%{opacity:.045}50%{opacity:.09}}

/* ===== CHARACTER DOSSIER ===== */
.nerf-dossier{--accent:#FFA800;position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:none;background:#101114;color:#fff;box-sizing:border-box}
.nerf-dossier[open]{display:flex;align-items:center;justify-content:safe center}
.nerf-dossier::backdrop{background:rgba(6,6,8,.86);backdrop-filter:blur(6px)}
.nerf-dossier .dossier-inner{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.82fr);align-items:center;gap:clamp(24px,4vw,64px);width:min(92vw,1080px);max-height:100%;margin:0 auto;padding:clamp(20px,4vh,48px) clamp(20px,3vw,32px);box-sizing:border-box;overflow-y:auto}
.nerf-dossier .dossier-portrait{position:relative;border-radius:20px;overflow:hidden;background:#141414;aspect-ratio:4/5;isolation:isolate;box-shadow:0 24px 60px rgba(0,0,0,.5),0 0 0 1px color-mix(in srgb,var(--accent) 30%,transparent);animation:dossierPortraitIn .5s cubic-bezier(.16,1,.3,1) both}
.nerf-dossier .dossier-portrait img{width:100%;height:100%;object-fit:cover;object-position:center 12%;display:block}
.nerf-dossier .dossier-glow{position:absolute;inset:-40% -30%;background:radial-gradient(circle at 50% 30%,color-mix(in srgb,var(--accent) 38%,transparent),transparent 60%);pointer-events:none;z-index:2;opacity:.7;animation:dossierGlowPulse 5s ease-in-out infinite}
.nerf-dossier .dossier-portrait::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(16,17,20,.5) 100%);pointer-events:none;z-index:3}
.nerf-dossier .dossier-info{position:relative;z-index:2;min-width:0;animation:dossierInfoIn .5s cubic-bezier(.16,1,.3,1) .08s both}
.nerf-dossier .dossier-index{font:800 10px/1 var(--mono);letter-spacing:.24em;color:color-mix(in srgb,var(--accent) 80%,white);margin:0 0 10px}
.nerf-dossier .dossier-name{margin:0;font:900 clamp(30px,5vw,52px)/1 var(--display);letter-spacing:.01em;color:#fff;text-transform:uppercase}
.nerf-dossier .dossier-handle{margin-top:8px;font:800 12px/1 var(--mono);letter-spacing:.12em;color:rgba(255,255,255,.5);text-decoration:none;display:inline-block}
.nerf-dossier .dossier-handle:hover,.nerf-dossier .dossier-handle:focus-visible{color:var(--accent)}
.nerf-dossier .dossier-tags{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.nerf-dossier .dossier-tag{padding:8px 14px;border:1px solid color-mix(in srgb,var(--accent) 40%,rgba(255,255,255,.14));border-radius:999px;font:800 10px/1 var(--mono);letter-spacing:.14em;color:var(--accent);background:rgba(20,20,20,.55);text-transform:uppercase}
.nerf-dossier .dossier-desc{margin:0 0 14px;font:500 15px/1.55 var(--mono);color:rgba(255,255,255,.72);max-width:52ch}
.nerf-dossier .dossier-quip{margin:0;font:italic 700 13px/1.5 var(--mono);color:color-mix(in srgb,var(--accent) 75%,white);opacity:.85}
.nerf-dossier .dossier-close,.nerf-dossier .dossier-nav{position:fixed;width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(16,17,20,.72);backdrop-filter:blur(6px);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .18s,border-color .18s,transform .18s;z-index:5;touch-action:manipulation}
.nerf-dossier .dossier-close:hover,.nerf-dossier .dossier-nav:hover,.nerf-dossier .dossier-close:focus-visible,.nerf-dossier .dossier-nav:focus-visible{background:#FFA800;border-color:#FFA800;color:#141414;outline:none}
.nerf-dossier .dossier-close:active,.nerf-dossier .dossier-nav:active{transform:scale(.92)}
.nerf-dossier .dossier-close svg,.nerf-dossier .dossier-nav svg{width:20px;height:20px}
.nerf-dossier .dossier-close{top:max(16px,env(safe-area-inset-top));right:max(16px,env(safe-area-inset-right))}
.nerf-dossier .dossier-nav-prev{left:max(16px,env(safe-area-inset-left));top:50%;transform:translateY(-50%)}
.nerf-dossier .dossier-nav-next{right:max(16px,env(safe-area-inset-right));top:50%;transform:translateY(-50%)}
.nerf-dossier .dossier-nav-prev:active{transform:translateY(-50%) scale(.92)}
.nerf-dossier .dossier-nav-next:active{transform:translateY(-50%) scale(.92)}
.nerf-dossier .dossier-nav[disabled]{opacity:.25;pointer-events:none}
@media(max-width:760px){
.nerf-dossier .dossier-inner{grid-template-columns:1fr;grid-template-rows:auto auto;gap:20px;width:100%;padding:max(72px,calc(env(safe-area-inset-top) + 64px)) max(18px,env(safe-area-inset-left)) max(24px,env(safe-area-inset-bottom))}
.nerf-dossier .dossier-portrait{aspect-ratio:1/1;max-height:44vh;justify-self:center;width:min(100%,420px)}
.nerf-dossier .dossier-name{font-size:clamp(26px,7vw,36px)}
.nerf-dossier .dossier-desc{max-width:none}
.nerf-dossier .dossier-nav{width:42px;height:42px}
.nerf-dossier .dossier-nav-prev{left:6px}
.nerf-dossier .dossier-nav-next{right:6px}
}
@keyframes dossierPortraitIn{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes dossierInfoIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes dossierGlowPulse{0%,100%{opacity:.55}50%{opacity:.85}}
@media(prefers-reduced-motion:reduce){
.nerf-dossier .dossier-portrait,.nerf-dossier .dossier-info{animation:none}
.nerf-dossier .dossier-glow{animation:none;opacity:.6}
}`;
  document.head.appendChild(style);
}

const NAV_ICON_PREV = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const NAV_ICON_NEXT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let cards = [];
let shell = null;
let prevBtn = null;
let nextBtn = null;

function buildShell(){
  if(shell) return;
  shell = document.createElement("div");
  shell.className = "nerfs-carousel-shell";
  grid.parentNode.insertBefore(shell, grid);
  shell.appendChild(grid);

  prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "nerfs-nav nerfs-nav-prev";
  prevBtn.setAttribute("aria-label", "Previous target");
  prevBtn.innerHTML = NAV_ICON_PREV;

  nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "nerfs-nav nerfs-nav-next";
  nextBtn.setAttribute("aria-label", "Next target");
  nextBtn.innerHTML = NAV_ICON_NEXT;

  shell.appendChild(prevBtn);
  shell.appendChild(nextBtn);

  prevBtn.addEventListener("click", ()=>step(-1));
  nextBtn.addEventListener("click", ()=>step(1));
}

// Derives the dossier's combat type + description from the real
// combat-ai.js COMBAT profile, so it can never drift out of sync with
// what actually happens in a match — no second, hand-written balance
// description to maintain.
function describeCombat(id){
  const p = COMBAT[id];
  if(!p) return { type:"UNKNOWN", desc:"" };
  const type = p.kind==="melee" ? "MELEE" : p.kind==="ranged" ? "RANGED" : "HYBRID";
  const style = p.kind==="melee"
    ? `Closes in fast and swings at close range (~${p.range}u).`
    : p.kind==="ranged"
      ? `Keeps distance and fires from up to ${p.range}u out.`
      : `Circles at mid-range (~${p.range}u), mixing melee pressure with ranged shots.`;
  return { type, desc:`${style} Speed ${p.speed.toFixed(2)}x · Cooldown ${p.cooldown.toFixed(2)}s.` };
}

let dossier = null, dossierImg, dossierIndex, dossierName, dossierHandle, dossierWeapon, dossierType, dossierDesc, dossierQuip, dossierPrev, dossierNext, dossierClose, dossierPortrait;
let dossierActiveIndex = 0, dossierOpener = null;

function buildDossier(){
  if(dossier) return;
  dossier = document.createElement("dialog");
  dossier.className = "nerf-dossier";
  dossier.innerHTML = `
    <button type="button" class="dossier-close" aria-label="Close character dossier">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
    </button>
    <button type="button" class="dossier-nav dossier-nav-prev" aria-label="Previous character">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button type="button" class="dossier-nav dossier-nav-next" aria-label="Next character">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="dossier-inner">
      <div class="dossier-portrait">
        <img alt="">
        <div class="dossier-glow" aria-hidden="true"></div>
      </div>
      <div class="dossier-info">
        <div class="dossier-index"></div>
        <h2 class="dossier-name" id="dossierName"></h2>
        <a class="dossier-handle" target="_blank" rel="noopener noreferrer"></a>
        <div class="dossier-tags">
          <span class="dossier-tag dossier-weapon"></span>
          <span class="dossier-tag dossier-type"></span>
        </div>
        <p class="dossier-desc" id="dossierDesc"></p>
        <p class="dossier-quip"></p>
      </div>
    </div>`;
  document.body.appendChild(dossier);

  dossierPortrait = dossier.querySelector(".dossier-portrait");
  dossierImg = dossier.querySelector(".dossier-portrait img");
  dossierIndex = dossier.querySelector(".dossier-index");
  dossierName = dossier.querySelector(".dossier-name");
  dossierHandle = dossier.querySelector(".dossier-handle");
  dossierWeapon = dossier.querySelector(".dossier-weapon");
  dossierType = dossier.querySelector(".dossier-type");
  dossierDesc = dossier.querySelector(".dossier-desc");
  dossierQuip = dossier.querySelector(".dossier-quip");
  dossierPrev = dossier.querySelector(".dossier-nav-prev");
  dossierNext = dossier.querySelector(".dossier-nav-next");
  dossierClose = dossier.querySelector(".dossier-close");

  dossier.setAttribute("aria-labelledby", "dossierName");
  dossier.setAttribute("aria-describedby", "dossierDesc");

  dossierClose.addEventListener("click", ()=>dossier.close());
  dossierPrev.addEventListener("click", ()=>dossierStep(-1));
  dossierNext.addEventListener("click", ()=>dossierStep(1));

  // click on the backdrop (the dialog element itself, not its content) closes it
  dossier.addEventListener("click", e=>{ if(e.target===dossier) dossier.close(); });

  dossier.addEventListener("keydown", e=>{
    if(e.key==="ArrowLeft"){ e.preventDefault(); e.stopPropagation(); dossierStep(-1); }
    else if(e.key==="ArrowRight"){ e.preventDefault(); e.stopPropagation(); dossierStep(1); }
    // Escape is handled natively by <dialog>; no extra code needed.
  });

  // single source of truth for cleanup on every close path (Escape,
  // backdrop click, the × button, or a future programmatic close) —
  // <dialog>'s "close" event fires for all of them alike. Focus goes to
  // whichever card the dossier ends on (kept in sync by dossierStep,
  // below), not necessarily the exact card that opened it — prev/next
  // inside the dossier moves the carousel's own "active" card too, and
  // only the active card carries a tabindex, so the original opener may
  // no longer be focusable by the time the dossier closes.
  dossier.addEventListener("close", ()=>{
    const target = cards[dossierActiveIndex] || dossierOpener;
    if(target && document.contains(target)) target.focus();
    dossierOpener = null;
  });
}

function renderDossier(index){
  dossierActiveIndex = Math.max(0, Math.min(ROSTER.length-1, index));
  const p = ROSTER[dossierActiveIndex];
  const combat = describeCombat(p.id);
  const teamDef = TEAM_ROSTER.find(r=>r.id===p.id);
  const quip = teamDef?.lines?.[0] || "";

  dossier.style.setProperty("--accent", p.accent);
  // restart the entrance animations on every character switch
  dossierPortrait.style.animation = "none";
  dossier.querySelector(".dossier-info").style.animation = "none";
  void dossier.offsetWidth; // force reflow
  dossierPortrait.style.animation = "";
  dossier.querySelector(".dossier-info").style.animation = "";

  dossierImg.src = p.img;
  dossierImg.alt = `${p.name} character portrait`;
  dossierIndex.textContent = `${String(dossierActiveIndex+1).padStart(2,"0")} / ${String(ROSTER.length).padStart(2,"0")}`;
  dossierName.textContent = p.name;
  dossierHandle.textContent = `@${p.handle}`;
  dossierHandle.href = `https://x.com/${encodeURIComponent(p.handle)}`;
  dossierWeapon.textContent = p.weapon;
  dossierType.textContent = combat.type;
  dossierDesc.textContent = combat.desc;
  dossierQuip.textContent = quip ? `"${quip}"` : "";

  dossierPrev.disabled = dossierActiveIndex<=0;
  dossierNext.disabled = dossierActiveIndex>=ROSTER.length-1;
}

function dossierStep(dir){
  const next = dossierActiveIndex + dir;
  if(next<0 || next>=ROSTER.length) return;
  renderDossier(next);
  // keep the card carousel behind the dossier in sync, so closing lands
  // back on whichever character the dossier was showing
  if(cards[next]) goToCard(cards[next], false);
}

function openDossier(index, opener){
  buildDossier();
  dossierOpener = opener || null;
  renderDossier(index);
  if(typeof dossier.showModal === "function") dossier.showModal();
  else dossier.setAttribute("open",""); // extremely old browsers: degrade to non-modal
}

function renderRoster(){
  grid.innerHTML="";
  cards = [];
  ROSTER.forEach((p,i)=>{
    const card=document.createElement("article");
    card.className="nerf-card";
    card.dataset.id=p.id;
    card.style.setProperty("--accent",p.accent);
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
          <img src="${p.img}" alt="${p.name} character portrait" loading="eager" decoding="async" draggable="false">
          <div class="nerf-glitch nerf-glitch-r" style="background-image:url(${p.img})" aria-hidden="true"></div>
          <div class="nerf-glitch nerf-glitch-b" style="background-image:url(${p.img})" aria-hidden="true"></div>
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
    cards.push(card);
    card.addEventListener("pointermove",e=>{
      if(e.pointerType==="touch") return;
      const r=card.getBoundingClientRect();
      card.style.setProperty("--rx",`${((e.clientY-r.top)/r.height-.5)*-4}deg`);
      card.style.setProperty("--ry",`${((e.clientX-r.left)/r.width-.5)*5}deg`);
    });
    card.addEventListener("pointerleave",()=>{card.style.setProperty("--rx","0deg");card.style.setProperty("--ry","0deg")});
    card.addEventListener("click",()=>{
      if(!card.classList.contains("is-active")) goToCard(card);
      else openDossier(i, card);
    });
    card.addEventListener("keydown",e=>{
      if((e.key==="Enter"||e.key===" ") && card.classList.contains("is-active")){
        e.preventDefault();
        openDossier(i, card);
      }
    });
  });
}

function currentActive(){
  return cards.find(c=>c.classList.contains("is-active")) || cards[0];
}

function setActive(target){
  cards.forEach(c=>{
    const isActive = c===target;
    c.classList.toggle("is-active", isActive);
    if(isActive){
      c.setAttribute("tabindex","0");
      c.setAttribute("role","button");
      c.setAttribute("aria-label", `View ${ROSTER[cards.indexOf(c)]?.name || ""} dossier`);
    } else {
      c.removeAttribute("tabindex");
      c.removeAttribute("role");
      c.removeAttribute("aria-label");
    }
  });
  if(prevBtn) prevBtn.disabled = cards.indexOf(target) <= 0;
  if(nextBtn) nextBtn.disabled = cards.indexOf(target) >= cards.length-1;
}

function updateActiveFromScroll(){
  if(!cards.length) return;
  const gridRect = grid.getBoundingClientRect();
  if(gridRect.width === 0) return; // screen not visible/laid out yet
  const centerX = gridRect.left + gridRect.width/2;
  let closest = cards[0], closestDist = Infinity;
  cards.forEach(c=>{
    const r = c.getBoundingClientRect();
    const d = Math.abs((r.left + r.width/2) - centerX);
    if(d < closestDist){ closestDist = d; closest = c; }
  });
  setActive(closest);
}

function reducedMotion(){
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function goToCard(card, smooth=true){
  card.scrollIntoView({ behavior: (smooth && !reducedMotion()) ? "smooth" : "auto", inline:"center", block:"nearest" });
}

function step(dir){
  const active = currentActive();
  const idx = cards.indexOf(active);
  const next = cards[Math.max(0, Math.min(cards.length-1, idx+dir))];
  if(next) goToCard(next);
}

let scrollRaf = 0;
function onGridScroll(){
  cancelAnimationFrame(scrollRaf);
  scrollRaf = requestAnimationFrame(updateActiveFromScroll);
}

let resizeTimer = 0;
function onResize(){
  if(!screen.classList.contains("on")) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(()=>{
    const active = currentActive();
    if(active) goToCard(active, false);
    updateActiveFromScroll();
  }, 120);
}

function initLifecycle(){
  grid.addEventListener("scroll", onGridScroll, { passive:true });
  window.addEventListener("resize", onResize, { passive:true });
  new MutationObserver(muts=>{
    if(muts.some(m=>m.type==="attributes" && m.attributeName==="class") && screen.classList.contains("on")){
      updateActiveFromScroll();
    }
  }).observe(screen, { attributes:true, attributeFilter:["class"] });
}

injectStyles();
buildShell();
renderRoster();
if(cards.length) setActive(cards[0]);
initLifecycle();

document.getElementById("btnNerfsBack")?.addEventListener("click",()=>{ goBack(); scTitle.scrollTop=0; });
document.getElementById("btnNerfsStart")?.addEventListener("click",()=>startRun());
document.getElementById("btnTitleNerfs")?.addEventListener("click",()=>{ show(screen); screen.scrollTop=0; });
