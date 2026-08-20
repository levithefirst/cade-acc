/* ============================================================
   CADE OPS — leaderboard.js
   One persistent anonymous player per browser installation.
   Identity is registered once through /api/player, then locked.
   The server's HttpOnly cookie is authoritative; localStorage is
   only a durable client-side cache of the server-issued identity.
   ============================================================ */
import { Store, Theme, Game } from "./main.js";
import { SFX } from "./audio.js";
import { show, scTitle, scLeaderboard, paintDomMark, goBack } from "./ui.js";

const identityScreen = document.getElementById("scIdentity");
const identityForm = document.getElementById("identityForm");
const identityInput = document.getElementById("identityInput");
const identityHint = document.getElementById("identityHint");
const identityStatus = document.getElementById("identityStatus");
const lockedName = document.getElementById("playerNameLocked");

identityInput?.addEventListener("keydown", e => e.stopImmediatePropagation(), {capture:true});
identityInput?.addEventListener("keyup", e => e.stopImmediatePropagation(), {capture:true});

function setLockedName(name) {
  if (lockedName) lockedName.textContent = name || "DEGEN";
}

function persistIdentity(playerId, name) {
  const s = Store.read();
  s.playerId = playerId;
  s.playerName = name;
  s.nameChangesUsed = 0;
  Store.write(s);
  setLockedName(name);
}

function persistPendingIdentity(playerId) {
  const s = Store.read();
  s.playerId = playerId;
  Store.write(s);
}

function showIdentity(message = "") {
  if (scTitle) scTitle.classList.remove("on");
  if (identityScreen) identityScreen.classList.add("on");
  if (message && identityStatus) identityStatus.textContent = message;
}

function showTitle() {
  if (identityScreen) identityScreen.classList.remove("on");
  if (scTitle) scTitle.classList.add("on");
  setLockedName(Store.read().playerName);
}

function setIdentityBusy(busy) {
  const submit = identityForm?.querySelector("button[type=submit]");
  if (submit) {
    submit.disabled = busy;
    submit.textContent = busy ? "LOCKING..." : "CONFIRM CALLSIGN";
  }
  if (identityInput) identityInput.disabled = busy;
}

function validateLocalName(raw) {
  const name = String(raw || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (name.length < 10) return { error: "Minimum 10 characters." };
  if (name.length > 16) return { error: "Maximum 16 characters." };
  if (!/^[A-Z0-9 _-]+$/.test(name)) return { error: "Use letters, numbers, spaces, _ or - only." };
  return { name };
}

async function loadServerIdentity() {
  const res = await fetch("/api/player", { credentials: "same-origin", cache: "no-store" });
  if (res.ok) return res.json();
  throw new Error("Identity service unavailable");
}

export async function initPlayerName() {
  const saved = Store.read();
  if (identityInput && saved.playerName) identityInput.value = saved.playerName;

  if (identityForm && !identityForm.dataset.bound) {
    identityForm.dataset.bound = "1";
    identityForm.addEventListener("submit", async e => {
      e.preventDefault();
      const checked = validateLocalName(identityInput?.value);
      if (checked.error) {
        if (identityHint) identityHint.textContent = checked.error;
        identityHint?.classList.add("warn");
        return;
      }
      identityHint?.classList.remove("warn");
      if (identityStatus) identityStatus.textContent = "Registering your player...";
      setIdentityBusy(true);
      try {
        const res = await fetch("/api/player", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: checked.name })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 409 && data.name && data.playerId) {
            persistIdentity(data.playerId, data.name);
            showTitle();
            return;
          }
          throw new Error(data.error || "Could not register callsign");
        }
        persistIdentity(data.playerId, data.name);
        if (identityStatus) identityStatus.textContent = "CALLSIGN LOCKED";
        setTimeout(showTitle, 280);
      } catch (err) {
        if (identityStatus) identityStatus.textContent = err.message || "Registration failed. Try again.";
      } finally {
        setIdentityBusy(false);
      }
    });
  }

  try {
    const player = await loadServerIdentity();
    if (player?.playerId && player?.registered && player?.name) {
      persistIdentity(player.playerId, player.name);
      showTitle();
      const current = Store.read();
      if (current.pendingScore && Number(current.pendingScore.score) > 0) {
        submitScoreToLeaderboard(Number(current.pendingScore.score));
      }
      return;
    }
    if (player?.playerId) {
      persistPendingIdentity(player.playerId);
      showIdentity("WELCOME TO CADE OPS");
      return;
    }
    showIdentity("WELCOME TO CADE OPS");
  } catch (err) {
    if (saved.playerId && saved.playerName) {
      setLockedName(saved.playerName);
      showTitle();
    } else {
      showIdentity("CONNECTION REQUIRED TO REGISTER");
    }
  }
}

let scoreSubmission = Promise.resolve(null);

function savePendingScore(score, runId) {
  const s = Store.read();
  const previous = Number(s.pendingScore?.score || 0);
  if (score >= previous) {
    s.pendingScore = { score: Math.round(score), runId };
    Store.write(s);
  }
}

function clearPendingScore(score) {
  const s = Store.read();
  if (!s.pendingScore) return;
  if (Number(s.pendingScore.score) <= Number(score)) {
    delete s.pendingScore;
    Store.write(s);
  }
}

export function submitScoreToLeaderboard(score) {
  const job = (async () => {
    const rankEl = document.getElementById("eGlobalRank");
    if (rankEl) rankEl.textContent = "";
    try {
      const s = Store.read();
      if (!s.playerId || !s.playerName) return null;
      const cleanScore = Math.round(Number(score));
      if (!Number.isFinite(cleanScore) || cleanScore < 0) return null;
      const runId = `run-${Math.floor(Game.runStartedAt || Date.now())}-${cleanScore}`;
      savePendingScore(cleanScore, runId);

      let res;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await fetch("/api/submit-score", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: s.playerId, name: s.playerName, score: cleanScore, runId })
          });
          if (res.ok || res.status < 500) break;
        } catch (err) {
          if (attempt === 1) throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!res?.ok) return null;
      const data = await res.json();
      clearPendingScore(cleanScore);
      setLockedName(data.name || s.playerName);
      if (data.rank && rankEl) rankEl.innerHTML = `Global rank <b>#${data.rank}</b>`;
      return data;
    } catch (e) {
      return null;
    }
  })();
  scoreSubmission = job;
  return job;
}

export async function fetchLeaderboard() {
  const status = document.getElementById("lbStatus");
  const list = document.getElementById("lbList");
  status.textContent = "Loading...";
  list.innerHTML = "";
  try {
    const res = await fetch("/api/leaderboard?limit=25", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (!data.entries || !data.entries.length) {
      status.textContent = "No runs yet. Be the first.";
      return;
    }
    status.textContent = data.hasLegacy
      ? `Top ${data.entries.length} players · legacy runs preserved`
      : `Top ${data.entries.length} players, all-time`;
    list.innerHTML = data.entries.map((e, i) => {
      const rankClass = i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "";
      const currentClass = e.isCurrent ? " is-current" : "";
      const legacyClass = e.legacy ? " is-legacy" : "";
      const legacyTag = e.legacy ? `<span class="lb-legacy">LEGACY</span>` : "";
      return `<div class="lb-row ${rankClass}${currentClass}${legacyClass}">
        <div class="lb-rank">#${i + 1}</div>
        <div class="lb-name">${escapeHtml(e.name)}${legacyTag}</div>
        <div class="lb-score">${Number(e.score).toLocaleString()}</div>
      </div>`;
    }).join("");
    if (data.yourRank && data.yourName) {
      const alreadyVisible = data.entries.some(e => e.isCurrent);
      const yourRow = alreadyVisible
        ? ""
        : `<div class="lb-your-rank"><span>YOUR RANK</span><b>#${data.yourRank}</b><strong>${escapeHtml(data.yourName)}</strong><em>${Number(data.yourScore || 0).toLocaleString()}</em></div>`;
      if (yourRow) list.insertAdjacentHTML("beforeend", yourRow);
    }
  } catch (e) {
    status.textContent = "Couldn't load the leaderboard — check back later.";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

async function openLeaderboard(){
  SFX.ui();
  // Results can still hold the just-finished run's score. Re-submit it before
  // reading the board so a previous failed write cannot strand a valid result.
  if (Game.scene === "results" && Number(Game.score) > 0) {
    await submitScoreToLeaderboard(Game.score);
  } else {
    await scoreSubmission;
  }
  show(scLeaderboard);
  paintDomMark("markLeaderboard", 0.55, Theme.colors().cade, Theme.colors().bg);
  await scoreSubmission;
  await fetchLeaderboard();
}
document.getElementById("btnLeaderboard")?.addEventListener("click", openLeaderboard);
document.getElementById("btnEndLeaderboard")?.addEventListener("click", openLeaderboard);
document.getElementById("btnLbBack")?.addEventListener("click", () => {
  SFX.ui();
  goBack();
});
