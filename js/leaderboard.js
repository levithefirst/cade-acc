/* ============================================================
   CADE NERF — leaderboard.js
   Player name (10-char minimum, capped at 2 lifetime changes) plus the
   global leaderboard fetch/submit. Talks to /api/submit-score and
   /api/leaderboard (unchanged from CADE RUSH — score submission is
   game-agnostic, no server-side changes needed for this conversion).

   Everything here degrades silently if the API isn't configured or
   reachable — a leaderboard outage must never block or interrupt an
   actual run. See the two /api files for the Redis-backed
   implementation and setup steps.
   ============================================================ */
import { Store, Theme } from "./main.js";
import { SFX } from "./audio.js";
import { show, scTitle, scLeaderboard, paintDomMark } from "./ui.js";

const nameInput = document.getElementById("playerNameInput");
const nameHint = document.getElementById("nameHint");

export function initPlayerName(){
  const s = Store.read();
  let name = s.playerName;
  if(!name){
    // "DEGEN-" + 4 digits = 10 characters exactly, satisfies the minimum by construction
    name = "DEGEN-" + Math.floor(1000+Math.random()*9000);
    s.playerName = name; Store.write(s);
  }
  nameInput.value = name;
  updateNameState();
}

function updateNameState(){
  const s = Store.read();
  const left = 2 - (s.nameChangesUsed||0);
  if(left<=0){
    nameInput.disabled = true;
    nameHint.textContent = "Name locked — 0 changes left";
  } else {
    nameInput.disabled = false;
    nameHint.textContent = `${left} name change${left===1?"":"s"} left · min 10 characters`;
  }
  nameHint.classList.remove("warn");
}
function nameError(msg){
  nameHint.textContent = msg;
  nameHint.classList.add("warn");
  nameInput.classList.add("input-error");
  setTimeout(()=>{ nameInput.classList.remove("input-error"); updateNameState(); }, 1600);
}

nameInput.addEventListener("change", ()=>{
  const s = Store.read();
  const changesUsed = s.nameChangesUsed || 0;
  const raw = nameInput.value.trim();

  if(changesUsed >= 2){
    nameInput.value = s.playerName;
    return; // input is disabled at this point anyway — belt and suspenders
  }
  if(raw.length < 10){
    nameInput.value = s.playerName;
    nameError("Minimum 10 characters");
    return;
  }

  const finalName = raw.slice(0,16).toUpperCase();
  s.playerName = finalName;
  s.nameChangesUsed = changesUsed + 1;
  Store.write(s);
  nameInput.value = finalName;
  SFX.ui();
  updateNameState();
});

export async function submitScoreToLeaderboard(score){
  const rankEl = document.getElementById("eGlobalRank");
  if(rankEl) rankEl.textContent = "";
  try{
    const name = Store.read().playerName || "DEGEN";
    const res = await fetch("/api/submit-score", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ name, score })
    });
    if(!res.ok) return;
    const data = await res.json();
    if(data.rank && rankEl) rankEl.innerHTML = `Global rank <b>#${data.rank}</b>`;
  }catch(e){ /* offline or API not configured yet — say nothing, don't interrupt */ }
}

export async function fetchLeaderboard(){
  const status = document.getElementById("lbStatus");
  const list = document.getElementById("lbList");
  status.textContent = "Loading..."; list.innerHTML = "";
  try{
    const res = await fetch("/api/leaderboard?limit=25");
    if(!res.ok) throw new Error();
    const data = await res.json();
    if(!data.entries || !data.entries.length){
      status.textContent = "No runs yet. Be the first.";
      return;
    }
    status.textContent = `Top ${data.entries.length} runs, all-time`;
    list.innerHTML = data.entries.map((e,i)=>{
      const rankClass = i===0?"rank-1":i===1?"rank-2":i===2?"rank-3":"";
      return `<div class="lb-row ${rankClass}">
        <div class="lb-rank">#${i+1}</div>
        <div class="lb-name">${escapeHtml(e.name)}</div>
        <div class="lb-score">${e.score.toLocaleString()}</div>
      </div>`;
    }).join("");
  }catch(e){
    status.textContent = "Couldn't load the leaderboard — check back later.";
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

document.getElementById("btnLeaderboard")?.addEventListener("click", ()=>{
  SFX.ui();
  show(scLeaderboard);
  paintDomMark("markLeaderboard", 0.55, Theme.colors().cade, Theme.colors().bg);
  fetchLeaderboard();
});
document.getElementById("btnLbBack")?.addEventListener("click", ()=>{
  SFX.ui();
  show(scTitle);
});
