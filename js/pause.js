/* ============================================================
   CADE OPS — PAUSE
   Same pattern as burst.js: a single control layered onto the existing
   game loop. No second simulation loop, no second game state.

   THE ACTUAL FREEZE lives in main.js's frame() function — it skips
   Game.update(dt) entirely while Game.paused is true. Every timer, AI
   state machine, projectile, hazard, and particle system in the game
   runs through that one call, so gating it there is the single correct
   choke point. This file only owns the button, the overlay, and the
   keyboard/pause-state wiring — it does not touch gameplay state itself
   beyond flipping Game.paused.

   The one other place gameplay logic runs outside Game.update() is
   burst.js's own rAF loop (Space/tap -> activate()) — that file guards
   itself with `Game.paused` directly, same as this file guards pause
   toggling with `Game.scene==="play"`.
   ============================================================ */
import { Game, W, H } from "./main.js";
import { startRun, goHome } from "./ui.js";
import { Floaters } from "./particles.js";
import { SFX } from "./audio.js";

const isTouchDevice = (window.matchMedia && matchMedia("(pointer:coarse)").matches) || "ontouchstart" in window;

const pauseBtn = document.createElement("button");
pauseBtn.id = "pauseBtn";
pauseBtn.type = "button";
pauseBtn.setAttribute("aria-label", "Pause");
pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" class="icon-svg" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
document.body.appendChild(pauseBtn);

const dialog = document.createElement("dialog");
dialog.id = "pauseDialog";
dialog.setAttribute("aria-labelledby", "pauseTitle");
dialog.innerHTML = `
  <div class="pause-inner">
    <div class="pause-title" id="pauseTitle">GAME PAUSED</div>
    <button type="button" class="btn pause-btn" id="btnPauseResume">Resume</button>
    <button type="button" class="btn ghost pause-btn" id="btnPauseRestart">Restart</button>
    <button type="button" class="btn ghost pause-btn" id="btnPauseExit">Exit To Home</button>
  </div>`;
document.body.appendChild(dialog);

const style = document.createElement("style");
style.id = "cade-pause-style";
style.textContent = `
#pauseBtn{position:fixed;top:max(64px,calc(env(safe-area-inset-top) + 64px));right:max(12px,env(safe-area-inset-right));width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(20,20,20,.65);backdrop-filter:blur(8px);color:#fff;display:none;align-items:center;justify-content:center;z-index:15;cursor:pointer;touch-action:manipulation;transition:background .18s,border-color .18s,transform .18s}
#pauseBtn.show{display:flex}
#pauseBtn:hover,#pauseBtn:focus-visible{background:#FFA800;border-color:#FFA800;color:#141414;outline:none}
#pauseBtn:active{transform:scale(.92)}
#pauseBtn .icon-svg{width:18px;height:18px;fill:currentColor}
#pauseDialog{position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:none;background:transparent;box-sizing:border-box}
#pauseDialog[open]{display:flex;align-items:center;justify-content:safe center}
#pauseDialog::backdrop{background:rgba(8,8,10,.72);backdrop-filter:blur(4px)}
#pauseDialog .pause-inner{display:flex;flex-direction:column;align-items:stretch;gap:12px;width:min(88vw,340px);padding:32px 26px;background:linear-gradient(150deg,#232326,#141416);border:1px solid rgba(255,168,0,.24);border-radius:18px;box-shadow:0 30px 70px rgba(0,0,0,.55)}
#pauseDialog .pause-title{font-family:var(--display,"Bungee",sans-serif);font-weight:900;font-size:22px;letter-spacing:.04em;color:#FFA800;text-align:center;margin:0 0 10px;text-shadow:0 0 18px rgba(255,168,0,.4)}
#pauseDialog .pause-btn{min-height:48px}
@media(max-height:480px){#pauseDialog .pause-inner{padding:20px 22px;gap:8px}#pauseDialog .pause-title{font-size:18px;margin-bottom:4px}}
`;
document.head.appendChild(style);

function isPausable(){ return Game.scene === "play"; }

function openPause(){
  if(!isPausable() || Game.paused) return;
  Game.paused = true;
  Game.pausedAtMs = performance.now();
  SFX.ui();
  if(typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open","");
}

function closePause(){
  if(!Game.paused) return;
  Game.paused = false;
  if(dialog.open) dialog.close();
  // short, subtle resume cue — reuses the existing on-canvas Floaters
  // system rather than inventing a new countdown/transition mechanism
  Floaters.add(W/2, H*0.42, "READY", "#FFA800", 26);
}

pauseBtn.addEventListener("click", e=>{ e.preventDefault(); openPause(); });

dialog.querySelector("#btnPauseResume").addEventListener("click", ()=>{ SFX.ui(); closePause(); });
dialog.querySelector("#btnPauseRestart").addEventListener("click", ()=>{
  SFX.ui();
  Game.paused = false;
  if(dialog.open) dialog.close();
  startRun();
});
dialog.querySelector("#btnPauseExit").addEventListener("click", ()=>{
  SFX.ui();
  Game.paused = false;
  if(dialog.open) dialog.close();
  goHome();
});

// <dialog> closes on Escape natively — this one handler covers every
// close path alike (Resume button, Escape, a future programmatic close)
// so Game.paused can never desync from whether the overlay is showing.
dialog.addEventListener("close", ()=>{ if(Game.paused) closePause(); });

// Escape *opens* pause when not yet paused; the dialog's native Escape
// handling covers the reverse once it's open.
window.addEventListener("keydown", e=>{
  if(e.key==="Escape" && isPausable() && !Game.paused){ e.preventDefault(); openPause(); }
}, true);

// visibility only — deliberately not the freeze mechanism itself, just
// shows/hides the button in step with whether pausing is currently valid
function frame(){
  pauseBtn.classList.toggle("show", isPausable());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
