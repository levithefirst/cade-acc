/* CADE OPS — UX improvements
   Small DOM/UI layer around the existing screen and game systems.
   No router, framework, duplicate character roster, or gameplay rules.
*/
import { Game, Input, Theme } from "./main.js";
import { startRun, show, scTitle, scEnd, scLeaderboard, scHowToPlay, scNerfs } from "./ui.js";
import { TEAM_ROSTER } from "./teams.js";
import { COMBAT, shots } from "./combat-ai.js";
import { Rugs } from "./rugs.js";
import { Pumps } from "./pumps.js";
import { Teams } from "./teams.js";
import { FX, Parts, Rings, Floaters } from "./particles.js";
import { SFX, Music } from "./audio.js";

const SCREEN_LIST = [scTitle, scEnd, scLeaderboard, scHowToPlay, scNerfs];
const screenHistory = [];
let currentScreen = null;
let suppressHistory = false;
let dossier = null;
let dossierIndex = 0;
let dossierTrigger = null;
let dossierCards = [];
let pauseButton = null;
let pauseOverlay = null;

function visibleScreen(){
  return SCREEN_LIST.find(s => s?.classList.contains("on")) || null;
}

function syncScreenHistory(){
  const next = visibleScreen();
  if(next === currentScreen) return;

  if(suppressHistory){
    suppressHistory = false;
    currentScreen = next;
    return;
  }

  if(currentScreen && next && currentScreen !== next){
    screenHistory.push(currentScreen);
  }
  currentScreen = next;
}

function observeScreens(){
  const observer = new MutationObserver(() => queueMicrotask(syncScreenHistory));
  SCREEN_LIST.forEach(screen => screen && observer.observe(screen, {
    attributes:true,
    attributeFilter:["class"]
  }));
  currentScreen = visibleScreen();
}

function goBack(fallback=scTitle){
  const previous = screenHistory.pop() || fallback;
  suppressHistory = true;
  SFX.ui();
  show(previous);
  previous?.scrollTo?.(0,0);
}

function clearNavigation(){
  screenHistory.length = 0;
  currentScreen = null;
  suppressHistory = false;
}

function bindBackButton(id, fallback){
  const button = document.getElementById(id);
  if(!button || button.dataset.uxBackBound) return;
  button.dataset.uxBackBound = "1";
  button.addEventListener("click", e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    goBack(fallback);
  }, true);
}

function createHomeNerfsButton(){
  const existing = document.getElementById("btnNerfsHome");
  if(existing) return;
  const leaderboard = document.getElementById("btnLeaderboard");
  const row = leaderboard?.closest(".row");
  if(!row) return;

  const button = document.createElement("button");
  button.className = "btn ghost";
  button.id = "btnNerfsHome";
  button.type = "button";
  button.textContent = "Nerfs";
  button.setAttribute("aria-label", "Open the six Nerfs roster");
  button.addEventListener("click", () => {
    SFX.ui();
    show(scNerfs);
    scNerfs?.scrollTo(0,0);
  });
  row.insertBefore(button, leaderboard);
}

function createResultsNavigation(){
  if(document.getElementById("resultsNavigation")) return;
  const again = document.getElementById("btnAgain");
  if(!again) return;
  const primaryRow = again.closest(".row");
  if(!primaryRow) return;

  const row = document.createElement("div");
  row.className = "row results-navigation";
  row.id = "resultsNavigation";

  const leaderboard = document.createElement("button");
  leaderboard.className = "btn ghost";
  leaderboard.type = "button";
  leaderboard.textContent = "Leaderboard";
  leaderboard.setAttribute("aria-label", "Open the global leaderboard");
  leaderboard.addEventListener("click", async () => {
    SFX.ui();
    show(scLeaderboard);
    try{
      const lb = await import("./leaderboard.js");
      lb.paintDomMark?.("markLeaderboard", 0.55, Theme.colors().cade, Theme.colors().bg);
      lb.fetchLeaderboard?.();
    }catch(e){ /* existing leaderboard UI remains usable */ }
  });

  const home = document.createElement("button");
  home.className = "btn ghost";
  home.type = "button";
  home.textContent = "Home";
  home.setAttribute("aria-label", "Return to the CADE OPS home screen");
  home.addEventListener("click", () => exitToHome());

  row.append(leaderboard, home);
  primaryRow.insertAdjacentElement("afterend", row);
}

function getRosterCardData(card){
  const id = card?.dataset.id;
  if(!id) return null;
  const team = TEAM_ROSTER.find(t => t.id === id);
  const combat = COMBAT[id] || {};
  const image = card.querySelector("img")?.currentSrc || card.querySelector("img")?.src || "";
  const handle = card.querySelector(".nerf-handle")?.textContent?.trim()?.replace(/^@/,"") || "";
  const weapon = card.querySelector(".nerf-weapon")?.textContent?.trim() || "";
  const name = card.querySelector(".nerf-name")?.textContent?.trim() || team?.name || id;
  const accent = getComputedStyle(card).getPropertyValue("--accent").trim() || team?.accent || "#FFA800";
  return { id, name, handle, weapon, accent, image, team, combat };
}

function combatType(kind){
  if(kind === "melee") return "MELEE";
  if(kind === "ranged") return "RANGED";
  return "HYBRID";
}

function combatDescription(profile){
  if(profile.kind === "melee") return "Fast close-range pressure.";
  if(profile.kind === "ranged") return "Long-range pressure. Keeps its distance and punishes careless movement.";
  return "Flexible mid-range pressure with a close-range threat.";
}

function buildDossier(){
  if(dossier) return dossier;
  dossier = document.createElement("dialog");
  dossier.id = "characterDossier";
  dossier.setAttribute("aria-labelledby", "dossierTitle");
  dossier.setAttribute("aria-describedby", "dossierDescription");
  dossier.innerHTML = `
    <div class="dossier-shell">
      <button class="dossier-close" id="dossierClose" type="button" aria-label="Close character dossier" autofocus>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="dossier-art" id="dossierArt">
        <div class="dossier-art-grid" aria-hidden="true"></div>
        <div class="dossier-glow" id="dossierGlow" aria-hidden="true"></div>
        <img id="dossierImage" alt="" draggable="false">
        <div class="dossier-art-caption" aria-hidden="true">CADE MARKET / NERF DOSSIER</div>
      </div>
      <div class="dossier-info">
        <div class="dossier-kicker" id="dossierCounter">TARGET 01 / 06</div>
        <h2 class="dossier-title" id="dossierTitle"></h2>
        <div class="dossier-handle" id="dossierHandle"></div>
        <div class="dossier-loadout">
          <span class="dossier-label">WEAPON</span>
          <span class="dossier-weapon" id="dossierWeapon"></span>
        </div>
        <div class="dossier-type" id="dossierType"></div>
        <p class="dossier-description" id="dossierDescription"></p>
        <p class="dossier-quip" id="dossierQuip"></p>
      </div>
      <button class="dossier-nav dossier-prev" id="dossierPrev" type="button" aria-label="Previous character">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg>
      </button>
      <button class="dossier-nav dossier-next" id="dossierNext" type="button" aria-label="Next character">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg>
      </button>
    </div>`;
  document.body.appendChild(dossier);

  dossier.querySelector("#dossierClose").addEventListener("click", () => dossier.close());
  dossier.querySelector("#dossierPrev").addEventListener("click", () => moveDossier(-1));
  dossier.querySelector("#dossierNext").addEventListener("click", () => moveDossier(1));
  dossier.addEventListener("close", () => {
    const card = dossierCards[dossierIndex];
    if(card){
      setActiveCard(card, true);
      requestAnimationFrame(() => card.focus({preventScroll:true}));
    }else if(dossierTrigger){
      dossierTrigger.focus?.({preventScroll:true});
    }
    dossierTrigger = null;
  });
  dossier.addEventListener("cancel", () => {
    // Native <dialog> handles Escape and the close event restores focus.
  });

  let swipeX = 0, swipeY = 0;
  dossier.addEventListener("pointerdown", e => {
    if(e.pointerType !== "touch") return;
    swipeX = e.clientX; swipeY = e.clientY;
  }, {passive:true});
  dossier.addEventListener("pointerup", e => {
    if(e.pointerType !== "touch") return;
    const dx = e.clientX - swipeX;
    const dy = e.clientY - swipeY;
    if(Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy)) return;
    moveDossier(dx < 0 ? 1 : -1);
  }, {passive:true});

  return dossier;
}

function setActiveCard(card, scroll=false){
  dossierCards.forEach(c => {
    const active = c === card;
    c.classList.toggle("is-active", active);
    c.setAttribute("tabindex", active ? "0" : "-1");
    c.setAttribute("aria-current", active ? "true" : "false");
    if(active) c.setAttribute("aria-label", `${getRosterCardData(c)?.name || "Character"}. Active target. Press Enter to open dossier.`);
  });
  if(scroll) card?.scrollIntoView({behavior: reducedMotion() ? "auto" : "smooth", inline:"center", block:"nearest"});
}

function reducedMotion(){
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function syncDossierCards(){
  const grid = document.getElementById("nerfsGrid");
  if(!grid) return false;
  const cards = [...grid.querySelectorAll(".nerf-card")];
  if(cards.length !== 6) return false;
  dossierCards = cards;
  const active = cards.find(c => c.classList.contains("is-active")) || cards[0];
  setActiveCard(active);
  cards.forEach(card => {
    if(card.dataset.dossierBound) return;
    card.dataset.dossierBound = "1";
    card.addEventListener("click", () => {
      if(card.classList.contains("is-active")) openDossier(cards.indexOf(card), card);
    });
    card.addEventListener("keydown", e => {
      if(!card.classList.contains("is-active")) return;
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        openDossier(cards.indexOf(card), card);
      }
    });
  });
  return true;
}

function observeNerfs(){
  const grid = document.getElementById("nerfsGrid");
  if(!grid) return;
  const observer = new MutationObserver(() => requestAnimationFrame(syncDossierCards));
  observer.observe(grid, {childList:true, subtree:true, attributes:true, attributeFilter:["class"]});
  syncDossierCards();
}

function renderDossier(index){
  const data = getRosterCardData(dossierCards[index]);
  if(!data) return;
  const p = data.combat;
  const team = data.team;
  dossierIndex = index;
  const image = dossier.querySelector("#dossierImage");
  image.src = data.image;
  image.alt = `${data.name} character portrait`;
  dossier.querySelector("#dossierTitle").textContent = data.name;
  dossier.querySelector("#dossierHandle").textContent = `@${data.handle}`;
  dossier.querySelector("#dossierWeapon").textContent = data.weapon;
  dossier.querySelector("#dossierType").textContent = combatType(p.kind);
  dossier.querySelector("#dossierDescription").textContent = combatDescription(p);
  dossier.querySelector("#dossierQuip").textContent = team?.lines?.[0] ? `“${team.lines[0]}”` : "";
  dossier.querySelector("#dossierCounter").textContent = `TARGET ${String(index+1).padStart(2,"0")} / 06`;
  dossier.querySelector("#dossierGlow").style.background = `radial-gradient(circle, ${data.accent}55 0%, transparent 68%)`;
  dossier.querySelector(".dossier-shell").style.setProperty("--dossier-accent", data.accent);
  dossier.querySelector("#dossierPrev").disabled = index <= 0;
  dossier.querySelector("#dossierNext").disabled = index >= dossierCards.length-1;
  setActiveCard(dossierCards[index], false);
}

function openDossier(index, trigger){
  if(!dossierCards.length) return;
  buildDossier();
  dossierTrigger = trigger || dossierCards[index];
  renderDossier(Math.max(0, Math.min(dossierCards.length-1, index)));
  if(!dossier.open) dossier.showModal();
}

function moveDossier(dir){
  if(!dossier?.open) return;
  const next = Math.max(0, Math.min(dossierCards.length-1, dossierIndex + dir));
  if(next === dossierIndex) return;
  renderDossier(next);
  dossierCards[next]?.scrollIntoView({behavior: reducedMotion() ? "auto" : "smooth", inline:"center", block:"nearest"});
}

function createPauseUI(){
  if(document.getElementById("pauseBtn")) return;
  pauseButton = document.createElement("button");
  pauseButton.id = "pauseBtn";
  pauseButton.type = "button";
  pauseButton.setAttribute("aria-label", "Pause game");
  pauseButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14"/></svg>';
  document.body.appendChild(pauseButton);

  pauseOverlay = document.createElement("div");
  pauseOverlay.id = "pauseOverlay";
  pauseOverlay.setAttribute("role", "dialog");
  pauseOverlay.setAttribute("aria-modal", "true");
  pauseOverlay.setAttribute("aria-labelledby", "pauseTitle");
  pauseOverlay.hidden = true;
  pauseOverlay.innerHTML = `
    <div class="pause-panel">
      <div class="pause-kicker">CADE OPS</div>
      <h2 id="pauseTitle">GAME PAUSED</h2>
      <div class="pause-rule" aria-hidden="true"></div>
      <button class="pause-action pause-resume" type="button">Resume</button>
      <button class="pause-action" type="button" id="pauseRestart">Restart</button>
      <button class="pause-action pause-exit" type="button" id="pauseExit">Exit to Home</button>
    </div>`;
  document.body.appendChild(pauseOverlay);

  pauseButton.addEventListener("click", () => togglePause());
  pauseOverlay.querySelector(".pause-resume").addEventListener("click", () => resumeGame());
  pauseOverlay.querySelector("#pauseRestart").addEventListener("click", () => restartFromPause());
  pauseOverlay.querySelector("#pauseExit").addEventListener("click", () => exitToHome());
}

function syncPauseUI(){
  if(!pauseButton || !pauseOverlay) return;
  const active = Game.scene === "play";
  pauseButton.hidden = !active;
  pauseButton.setAttribute("aria-label", Game.paused ? "Resume game" : "Pause game");
  pauseButton.classList.toggle("is-paused", !!Game.paused);
  pauseOverlay.hidden = !Game.paused;
  document.body.classList.toggle("game-paused", !!Game.paused);
}

function togglePause(){
  if(Game.scene !== "play") return;
  Game.paused ? resumeGame() : pauseGame();
}

function pauseGame(){
  if(Game.scene !== "play" || Game.paused) return;
  Game.paused = true;
  Input.keys = {};
  SFX.ui();
  syncPauseUI();
  pauseOverlay?.querySelector(".pause-resume")?.focus({preventScroll:true});
}

function resumeGame(){
  if(Game.scene !== "play" || !Game.paused) return;
  Game.paused = false;
  SFX.ui();
  syncPauseUI();
  pauseButton?.focus({preventScroll:true});
}

function restartFromPause(){
  SFX.ui();
  clearNavigation();
  Game.paused = false;
  startRun();
  syncPauseUI();
}

function exitToHome(){
  SFX.ui();
  Game.paused = false;
  Input.keys = {};
  Rugs.clear(); Pumps.clear(); Teams.clear(); Parts.clear(); Floaters.clear(); Rings.clear(); FX.reset(); shots.length = 0;
  Game.scene = "title";
  clearNavigation();
  show(scTitle);
  scTitle?.scrollTo(0,0);
  Music.start("calm");
  syncPauseUI();
}

function installGamePause(){
  if(Game.__cadeUxPauseInstalled) return;
  Game.__cadeUxPauseInstalled = true;
  Game.paused = false;

  const originalUpdate = Game.update.bind(Game);
  Game.update = function(dt){
    if(this.paused){
      syncPauseUI();
      return;
    }
    originalUpdate(dt);
    syncPauseUI();
  };

  const originalReset = Game.reset.bind(Game);
  Game.reset = function(){
    this.paused = false;
    originalReset();
    syncPauseUI();
  };

  window.addEventListener("keydown", e => {
    if(dossier?.open) return;
    if(e.key === "Escape" && (Game.scene === "play" || Game.paused)){
      e.preventDefault();
      e.stopImmediatePropagation();
      togglePause();
    }
    if(e.key === "Enter" && (Game.scene === "title" || Game.scene === "results")) clearNavigation();
  }, true);

  window.addEventListener("keydown", e => {
    if(!dossier?.open) return;
    if(e.key === "ArrowLeft" || e.key === "ArrowRight"){
      e.preventDefault();
      moveDossier(e.key === "ArrowRight" ? 1 : -1);
    }
  }, true);
}

function injectStyles(){
  if(document.getElementById("cade-ux-improvements-style")) return;
  const style = document.createElement("style");
  style.id = "cade-ux-improvements-style";
  style.textContent = `
/* Character dossier */
#characterDossier{width:min(1120px,calc(100vw - 24px));height:min(92svh,820px);max-width:none;max-height:none;padding:0;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:#111214;color:#fff;overflow:hidden;box-shadow:0 30px 100px rgba(0,0,0,.68),0 0 0 1px rgba(255,168,0,.10);font-family:var(--ui)}
#characterDossier::backdrop{background:rgba(3,4,6,.78);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.dossier-shell{--dossier-accent:#FFA800;position:relative;display:grid;grid-template-columns:minmax(0,1.72fr) minmax(280px,.78fr);width:100%;height:100%;min-height:0;background:radial-gradient(circle at 30% 40%,color-mix(in srgb,var(--dossier-accent) 10%,transparent),transparent 42%),linear-gradient(145deg,#18191c,#0c0d0f 72%)}
.dossier-art{position:relative;min-width:0;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(255,255,255,.02),transparent 45%)}
.dossier-art-grid{position:absolute;inset:0;opacity:.25;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(90deg,#000,transparent 92%)}
.dossier-glow{position:absolute;inset:5% 8%;filter:blur(32px);opacity:.7;pointer-events:none}
#dossierImage{position:relative;z-index:2;width:100%;height:100%;object-fit:contain;object-position:center 54%;padding:clamp(20px,4vw,54px);filter:saturate(1.03) contrast(1.04) drop-shadow(0 26px 30px rgba(0,0,0,.42));user-select:none;-webkit-user-drag:none;animation:dossierImageIn .32s var(--ease-out)}
.dossier-art-caption{position:absolute;left:24px;bottom:20px;z-index:3;font:800 8px/1 var(--mono);letter-spacing:.22em;color:rgba(255,255,255,.32)}
.dossier-info{position:relative;z-index:4;display:flex;flex-direction:column;justify-content:center;gap:11px;padding:clamp(26px,4vw,52px) clamp(22px,3vw,40px);border-left:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(0,0,0,.12));min-width:0}
.dossier-kicker{font:800 9px/1 var(--mono);letter-spacing:.22em;color:var(--dossier-accent);text-transform:uppercase}
.dossier-title{font:900 clamp(34px,5vw,70px)/.9 var(--display);letter-spacing:-.03em;text-transform:uppercase;color:#fff;word-break:break-word}
.dossier-handle{font:700 11px/1 var(--mono);letter-spacing:.10em;color:rgba(255,255,255,.48)}
.dossier-loadout{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;padding:11px 0;border-top:1px solid rgba(255,255,255,.09);border-bottom:1px solid rgba(255,255,255,.09)}
.dossier-label{font:800 8px/1 var(--mono);letter-spacing:.18em;color:rgba(255,255,255,.38)}
.dossier-weapon{padding:8px 11px;border:1px solid color-mix(in srgb,var(--dossier-accent) 45%,rgba(255,255,255,.14));border-radius:999px;color:var(--dossier-accent);background:color-mix(in srgb,var(--dossier-accent) 8%,transparent);font:900 9px/1 var(--mono);letter-spacing:.15em}
.dossier-type{align-self:flex-start;padding:7px 10px;border-left:3px solid var(--dossier-accent);background:rgba(255,255,255,.045);font:900 10px/1 var(--mono);letter-spacing:.18em;color:#fff}
.dossier-description{font:600 13px/1.65 var(--ui);color:rgba(255,255,255,.68);max-width:330px}
.dossier-quip{font:800 italic 13px/1.45 var(--ui);color:#fff;max-width:330px;padding-top:7px}
.dossier-quip::before{content:"COMBAT QUIP";display:block;margin-bottom:5px;font:800 7px/1 var(--mono);letter-spacing:.18em;color:rgba(255,255,255,.32);font-style:normal}
.dossier-close,.dossier-nav{position:absolute;z-index:8;display:flex;align-items:center;justify-content:center;width:50px;height:50px;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(12,13,15,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;cursor:pointer;touch-action:manipulation;transition:transform .16s var(--ease-spring),background .16s,border-color .16s,color .16s}
.dossier-close{top:16px;right:16px}
.dossier-nav{top:50%;transform:translateY(-50%)}
.dossier-prev{left:16px}.dossier-next{right:16px}
.dossier-close:hover,.dossier-close:focus-visible,.dossier-nav:hover,.dossier-nav:focus-visible{background:var(--dossier-accent);border-color:var(--dossier-accent);color:#111;outline:none;transform:translateY(-2px) scale(1.04)}
.dossier-nav:disabled{opacity:.25;pointer-events:none}
.dossier-close svg,.dossier-nav svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.dossier-close:focus-visible,.dossier-nav:focus-visible{outline:3px solid #fff;outline-offset:3px}
#nerfsGrid .nerf-card[tabindex="0"]{cursor:pointer}
#nerfsGrid .nerf-card[tabindex="0"]:focus-visible{outline:3px solid var(--accent);outline-offset:5px}
@keyframes dossierImageIn{from{opacity:.25;transform:scale(.985) translateY(8px)}to{opacity:1;transform:none}}

/* Gameplay pause */
#pauseBtn{position:fixed;top:max(76px,calc(env(safe-area-inset-top) + 68px));right:max(14px,env(safe-area-inset-right));z-index:12;width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.18);background:rgba(20,20,20,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.3);cursor:pointer;touch-action:manipulation}
#pauseBtn:hover,#pauseBtn:focus-visible{background:var(--cade);border-color:var(--cade);color:#141414;outline:none;transform:translateY(-1px)}
#pauseBtn:focus-visible{outline:3px solid #fff;outline-offset:3px}
#pauseBtn svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round}
#pauseBtn.is-paused{background:var(--cade);color:#141414}
#pauseBtn[hidden]{display:none}
#pauseOverlay{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:max(24px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));background:rgba(5,6,8,.62);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
#pauseOverlay[hidden]{display:none}
.pause-panel{width:min(380px,100%);padding:32px 26px 28px;border:1px solid rgba(255,255,255,.14);border-top-color:rgba(255,168,0,.45);border-radius:20px;background:linear-gradient(160deg,rgba(47,47,47,.96),rgba(16,17,19,.98));box-shadow:0 28px 80px rgba(0,0,0,.55),0 0 35px rgba(255,168,0,.08);text-align:center}
.pause-kicker{font:800 8px/1 var(--mono);letter-spacing:.28em;color:var(--cade);margin-bottom:10px}
.pause-panel h2{font:900 clamp(28px,8vw,42px)/1 var(--display);letter-spacing:.02em;color:#fff}
.pause-rule{width:64px;height:2px;margin:16px auto 20px;background:var(--cade);box-shadow:0 0 14px rgba(255,168,0,.35)}
.pause-action{width:100%;min-height:52px;margin-top:10px;padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#fff;font:900 14px/1 var(--display);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;touch-action:manipulation}
.pause-action:hover,.pause-action:focus-visible{background:var(--cade);border-color:var(--cade);color:#141414;outline:none}
.pause-action:focus-visible{outline:3px solid #fff;outline-offset:3px}
.pause-resume{background:linear-gradient(180deg,var(--cade-light),var(--cade-hot));border-color:rgba(255,255,255,.32);color:#141414;box-shadow:0 10px 25px rgba(255,168,0,.16)}
.pause-exit{color:rgba(255,255,255,.58)}
.results-navigation{margin-top:-4px}
.results-navigation .btn{min-width:128px}

@media(max-width:760px){
  #characterDossier{width:calc(100vw - 14px);height:94svh;border-radius:18px}
  .dossier-shell{grid-template-columns:1fr;grid-template-rows:minmax(0,3fr) minmax(0,1.25fr)}
  .dossier-art{min-height:0}
  #dossierImage{padding:16px 42px 8px;object-position:center 52%}
  .dossier-art-caption{left:14px;bottom:10px;font-size:7px}
  .dossier-info{border-left:0;border-top:1px solid rgba(255,255,255,.09);padding:14px 48px 16px;gap:6px;justify-content:flex-start;overflow:auto}
  .dossier-title{font-size:clamp(28px,9vw,46px)}
  .dossier-handle{font-size:9px}
  .dossier-loadout{margin-top:2px;padding:7px 0}
  .dossier-weapon{padding:6px 9px;font-size:8px}
  .dossier-type{padding:5px 8px;font-size:8px}
  .dossier-description,.dossier-quip{font-size:11px;line-height:1.4;max-width:none}
  .dossier-quip{padding-top:2px}
  .dossier-close{top:9px;right:9px;width:48px;height:48px}
  .dossier-nav{top:43%;width:48px;height:48px}
  .dossier-prev{left:8px}.dossier-next{right:8px}
  #pauseBtn{width:50px;height:50px;right:max(12px,env(safe-area-inset-right));top:max(76px,calc(env(safe-area-inset-top) + 70px))}
  .pause-panel{padding:28px 20px 24px}
}
@media(min-width:1100px){#pauseBtn{top:82px;right:22px}}
@media(prefers-reduced-motion:reduce){
  #dossierImage{animation:none}
  .dossier-close,.dossier-nav,#pauseBtn{transition:none}
}
`;
  document.head.appendChild(style);
}

function install(){
  injectStyles();
  observeScreens();
  createHomeNerfsButton();
  createResultsNavigation();
  createPauseUI();
  buildDossier();
  observeNerfs();
  bindBackButton("btnNerfsBack", scTitle);
  bindBackButton("btnLbBack", scTitle);

  // Any run started from the existing primary actions is a fresh navigation context.
  ["btnNerfsStart", "btnAgain"].forEach(id => {
    const el = document.getElementById(id);
    if(!el || el.dataset.uxRunBound) return;
    el.dataset.uxRunBound = "1";
    el.addEventListener("click", () => clearNavigation(), true);
  });

  installGamePause();
  syncPauseUI();
}

// nerfs-page.js renders its cards during module evaluation. This module is
// loaded from burst.js, so wait one frame before binding the roster, then keep
// the observer alive for the existing carousel lifecycle.
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, {once:true});
else requestAnimationFrame(install);
