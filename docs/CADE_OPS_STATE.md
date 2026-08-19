# CADE OPS State

Documentation-only project memory. This file is never imported, bundled, or referenced by runtime code. Source files remain the runtime source of truth.

## Architecture
- Static HTML + ES modules. `index.html` is the entry point.
- Runtime JavaScript lives in `js/`; shared CSS lives in `css/`; runtime media lives in `assets/`.
- Vercel serves the repository as a static site.

## Gameplay systems
- `js/main.js` owns the central game state (`Game`), the animation loop (`frame()`), and the canvas viewport.
- `js/player.js`, `js/rugs.js`, `js/pumps.js`, and `js/teams.js` own player/hazard/team behavior.
- `js/combat-ai.js` layers per-character combat (melee/ranged/hybrid profiles, projectiles, attack telegraphs) onto `Teams.update`/`Teams.draw` by wrapping them at module load — the six `COMBAT` profiles keyed by roster id are the single source of truth for each character's actual in-match behavior.
- `js/burst.js` layers the Burst panic-button ability onto the same loop, following the same "no second simulation" pattern.
- `js/ui.js` owns canvas HUD drawing, screen navigation, and the results flow.
- None of this pass's UX work changed scoring math, the 60-second run duration, lives, dash mechanics, Burst mechanics, pump/rug behavior, combat AI stats, character identities, weapons, or the leaderboard backend.

## Screen system
- Screens are DOM containers in `index.html` (`#scTitle`, `#scHowToPlay`, `#scNerfs`, `#scLeaderboard`, `#scEnd`), switched via `show()`/`goBack()`/`goHome()` in `js/ui.js`.
- `#scIdentity` is a one-time callsign gate handled separately from the `show()`-managed screen set (see `js/leaderboard.js`).
- Gameplay itself is canvas-only (`#cv`) — there is no `.screen` for active play; `dashBtn`/`burstBtn`/`pauseBtn` are persistent fixed-position DOM controls shown/hidden based on `Game.scene`.

## Navigation history
- `js/ui.js` keeps a small in-module back-stack (`navStack`, private) — not a router, not a dependency.
- `show(el)` auto-pushes whichever screen was active immediately before the switch. `goBack()` pops it. `goHome()` clears the stack and goes to `#scTitle` (an explicit reset, not a "back" action — used by the Game Over "Home" button and, in future, anywhere a hard reset to the landing page is wanted).
- Only "Back" buttons needed to change (from a hardcoded `show(scTitle)` to `goBack()`); every "forward" navigation call is untouched — the stack records provenance automatically.
- `startRun()` clears the stack, since a fresh run is a new context or entry point, not a place to "go back" into.
- Verified contextual pairs (headless-browser, see Current verified state): Home → NERFS → Back → Home; How To Play → NERFS → Back → How To Play; Home → Leaderboard → Back → Home; Game Over → Leaderboard → Back → Game Over.

## Rendering pipeline
- `#cv` is the gameplay canvas.
- `#roster-showcase` is a separate decorative title canvas painted by `paintRosterShowcase()` (`js/ui.js`), using the real `TEAM_ROSTER` `draw()` functions — no separate art asset.
- The single authoritative repaint path for the showcase lives in `js/main.js`'s boot sequence (`initRosterShowcaseLifecycle`): it treats `#scTitle` gaining the `"on"` class as the paint-lifecycle boundary, repaints on the next animation frame, observes title class mutations, and repaints on resize/orientation. Do not add a second repaint path.

## Asset system
- Runtime images are served from `assets/` using repository-relative production paths.
- The six NERFS portraits are **individual files**, not a sprite sheet: `assets/nerfs/{steve,gnar,kosgood,scotty,rookmate,poppunk}.jpg`, each ~55–80KB, resized to a 900px long edge. There is no cache-busting query string on these paths.
- `assets/nerfs-sprite.jpg` (the old single-file, six-frame sprite this page previously cropped via CSS `background-position` math) has been deleted. There are no remaining references to it anywhere in the repo (confirmed by repo-wide grep as part of this pass) — if you find one, it's dead code from before this change.

## NERFS page
- `js/nerfs-page.js` owns the roster carousel, the character dossier, and all of their component-specific injected CSS (consistent with this file's existing pattern — see NERFS CSS ownership below).
- **Carousel**: a horizontal CSS scroll-snap container (`#nerfsGrid`), not a static grid. One character is "active" (full brightness/scale, glow, scanline/sweep/glitch idle fx running) at a time; the rest sit dimmed and scaled down as visible neighbors. A single scroll listener (rAF-throttled) recomputes which card is closest to the container's horizontal center and toggles one `.is-active` class — that class is the single source of truth for both the visual spotlight and which card's decorative animations are actually running (inactive cards have their idle animation paused, not just visually deprioritized). Prev/Next buttons and native swipe/wheel/drag scrolling both drive the same mechanism. No infinite loop (would need cloned DOM nodes); Prev/Next disable at the ends.
- **Character dossier**: clicking/tapping the *active* card (or pressing Enter/Space while it's keyboard-focused) opens a near-full-screen `<dialog>` via `showModal()` — chosen specifically because it gives a native focus trap, Escape-to-close, and `::backdrop` for free, matching the rest of this codebase's preference for reusing platform/existing systems over hand-rolled ones. Shows: character number ("01 / 06"), large portrait (the same asset the carousel uses — no second image), name, handle (links to X), weapon label, combat type, and a short combat description — the type/description are *derived at render time* from `combat-ai.js`'s real `COMBAT` profile object (via `describeCombat()`), not a separately hand-written blurb, so they cannot drift out of sync with actual gameplay. One personality/quip line is pulled from `TEAM_ROSTER`'s existing `lines` array in `teams.js`. Prev/Next (buttons, and ArrowLeft/ArrowRight while the dialog is focused) step through characters and keep the carousel's own active card in sync underneath. Closing (Escape, the × button, or a backdrop click) restores focus to whichever card the dossier ended on — not necessarily the exact card that opened it, since navigating inside the dossier moves the carousel's active card too, and only the active card is keyboard-focusable (`tabindex`/`role="button"`/`aria-label` are added to a card only while it's active, removed otherwise).
- `css/polish.css` intentionally has **no** `#scNerfs` card ruleset — a prior, parallel ruleset there was dead code (grid placement on elements that weren't direct grid children) and was removed. `js/nerfs-page.js`'s injected stylesheet (`#cade-nerfs-roster-style`) is the one authoritative source for both the carousel and the dossier's layout/visuals. Do not add a second `#scNerfs` or `.nerf-dossier` ruleset elsewhere.

## Pause system
- `js/pause.js` is a standalone file following the same pattern as `js/burst.js`: it layers one feature onto the existing loop, no second simulation, no second game-state object.
- **The actual freeze** happens in `js/main.js`'s `frame()` function: while `Game.paused` is true, the call to `Game.update(dt)` is skipped entirely. Every timer, AI state machine, projectile, hazard, particle system, and multiplier/energy decay in the game runs through that one call, so gating it there is the single correct choke point — nothing else needed its own pause check for gameplay *simulation*.
- `render()` still runs every frame regardless of pause, so the arena stays visible behind the pause dialog's `::backdrop` (a restrained dark overlay, not a hidden game).
- Two things outside `Game.update()` needed explicit handling, found by testing (not assumed):
  1. `js/burst.js` runs its own independent `requestAnimationFrame` loop and its Space-key/button handlers call `activate()` directly — both now guard on `Game.paused`, and the loop's own charge/pulse timers stop advancing while paused.
  2. Several draw-time-only cosmetic pulses (timer bob, multiplier pulse, energy boost ring, dash-ready ring, the "exposed" target ring, attack telegraph flicker, screen-shake jitter, glitch-slice jitter) read `performance.now()` directly. Since `render()` keeps running while paused, these would otherwise keep animating off real wall-clock time even though the *gameplay* they represent is frozen. Fixed via `pausableNow()` (exported from `js/main.js`), which returns the timestamp pause began, held constant for as long as `Game.paused` is true — every one of those call sites now goes through it instead of a raw `performance.now()`. Verified by diffing two full-page screenshots taken 1.5s apart while paused: byte-identical.
- Pause is only togglable while `Game.scene === "play"` (the pause button is only shown then, and Escape only opens it in that state) — not during the brief automatic `freeze`/`finalrug` cinematic transitions.
- Resume, Restart, and Exit To Home are the three dialog actions. Resume posts a short "READY" cue via the existing `Floaters` on-canvas text system (no new transition mechanism). There is deliberately no backdrop-click-to-close on the pause dialog (unlike the NERFS dossier, which does have one) — an accidental tap resuming a paused game would be a bad outcome, so pause requires an explicit button or Escape.

## Game Over screen
- Button hierarchy (top to bottom): final score/stats → **Run It Back** (primary, unchanged) → **Leaderboard** / **Home** (new, side-by-side, `.btn.ghost.wide` — the same class already used by Copy Tweet/Save Image, so no new button styling was introduced) → Share on X → Copy Tweet / Save Image / theme toggle.
- The Leaderboard button reuses the exact same `openLeaderboard()` function the title screen's Leaderboard button already called (`js/leaderboard.js`) — not a duplicate implementation.

## Theme system
- `Theme` in `js/main.js` remains authoritative for dark/light rendering.
- CADE palette: `#2F2F2F`, `#FFB514`, `#141414`, `#FFA800`, `#FFFFFF`.

## Accessibility behavior
- The NERFS dossier and pause dialog both use native `<dialog>` + `showModal()`: native focus trap while open, native Escape-to-close, `::backdrop`. Both restore focus explicitly on their `close` event (covers every close path — Escape, a button, a backdrop click — uniformly) rather than relying on browser-version-dependent automatic focus restoration.
- The active NERFS carousel card is the only one that's keyboard-focusable (`tabindex="0"`, `role="button"`, a descriptive `aria-label`) and Enter/Space opens its dossier — inactive cards are intentionally not tab-stops, since only the centered/active card is a meaningful target.
- All new interactive controls (pause button, dossier close/prev/next, new title/results buttons) use the existing `.btn`/`:focus-visible` styling already defined in `css/style.css`, or replicate its focus-visible treatment for custom circular controls, rather than introducing a second visual language for focus states.
- Touch targets: the pause button and dossier/carousel nav buttons are 42–48px; existing `.btn` sizing was not changed.

## Reduced-motion support
- `@media (prefers-reduced-motion: reduce)` disables all decorative animation in: the NERFS carousel (idle float, glitch/RGB-split, scanline, sweep, entrance), the character dossier (portrait/info entrance, accent glow pulse), consistent with the pattern already established elsewhere in the app. Gameplay-affecting behavior is never gated by this — only purely decorative motion is.

## Important design contracts
- Fix rendering lifecycle failures at the source instead of hiding them with CSS.
- Never rely on a hidden screen's zero-sized layout for canvas backing resolution.
- NERFS image assets must be valid and decodable in production.
- Decorative title rendering remains separate from gameplay rendering.
- Character combat descriptions in the dossier must be derived from the real `combat-ai.js` profiles, never hand-written separately.
- Pausing must actually stop simulation (via `Game.update()` gating), not just visually hide the game.
- This document has no runtime role.

## Known issues
- **NOT VERIFIED IN PRODUCTION.** This environment has no route to the public internet, so `cadeops.vercel.app` could not be reached this pass either. Everything in this document is verified locally: a plain `python3 -m http.server` serving the repository root, driven by headless Chromium (Playwright), asserting on real DOM state, computed styles, screenshots, and (for the pause freeze specifically) byte-for-byte screenshot comparison — not assumptions. Since this repo has no build step, what's committed to `main` is what ships; local verification against the exact committed files is a reasonably strong proxy but is not the same as hitting the live URL.
- **MONITORING — combat description text.** `describeCombat()` in `js/nerfs-page.js` derives its output from `COMBAT[id].kind/range/speed/cooldown`. If someone tunes those numbers for balance later without reading this doc, the dossier's description updates automatically (that's the point) — but the *prose* ("Closes in fast and swings...") was hand-written once against the six profiles as they existed at the time of this pass and doesn't re-validate that a `kind` value is still one of the three it expects. Not a bug today; worth a glance if a fourth combat archetype is ever added.

## Major decisions
- Keep the existing canvas renderer, screen architecture, and `show()`-based navigation — extended with a small back-stack rather than replaced with a router.
- Reuse existing systems wherever one already existed for the job: `Floaters` for the pause "READY" cue, `.btn` styling for every new button, native `<dialog>` for both new overlays instead of a hand-rolled modal/focus-trap system, the real `TEAM_ROSTER`/`COMBAT` data for the dossier instead of a second roster.
- Gate the pause freeze at exactly one point (`Game.update()` in `frame()`) rather than scattering pause checks through every subsystem, then specifically hunt down and fix the handful of things that don't run through that one call (Burst's own loop; `performance.now()`-driven cosmetic pulses) — verified by testing, not assumed complete.

## Production constraints
- Production NERFS asset paths: `/assets/nerfs/{steve,gnar,kosgood,scotty,rookmate,poppunk}.jpg`.
- Static site deployment; no framework-specific image pipeline is involved.
- Documentation must never be imported or bundled.

## Change history
- 2026-08-19 — rendering repair — corrected title showcase lifecycle and restored a valid NERFS portrait asset without changing gameplay.
- 2026-08-19 — NERFS entry-flow fix — routed "Meet The 6 Nerfs" and the NERFS page's own Back button through the app's real screen-management system.
- 2026-08-19 — responsive polish + idle animation pass on NERFS/How To Play/Results screens; added restrained per-character idle fx to the (then sprite-based) NERFS portraits.
- 2026-08-19 — replaced the six-frame sprite sheet with six individual illustrated portrait assets; rebuilt the NERFS page as an active-spotlight horizontal carousel with Prev/Next navigation, keyboard support, and reduced-motion handling.
- 2026-08-19 — UX finishing pass (this entry): added the character dossier (native `<dialog>`, derived combat descriptions, full keyboard/focus handling); added a small contextual back-navigation stack (`goBack()`/`goHome()`) across all screens; added Leaderboard + Home to the Game Over screen; added a real pause system (button, `<dialog>` overlay, actual `Game.update()` freeze, plus fixes for the two things that don't run through that call — Burst's independent loop and several `performance.now()`-driven cosmetic pulses); added a "Meet The Nerfs" entry point to the title screen without altering its existing composition.

## Current verified state
- Last verified commit: see this commit's parent in `git log` (this doc is updated in the same commit as the change, so `git log -1 -- docs/CADE_OPS_STATE.md` on `main` names it).
- Last verified date: 2026-08-19.
- Verified locally (headless Chromium against the exact committed files): all six NERFS portraits load with correct character mapping; carousel active-card detection and Prev/Next/swipe/scroll all update the active card correctly; dossier opens with data matching the real `COMBAT`/`TEAM_ROSTER` source, Prev/Next/arrow-key navigation works, Escape closes and restores focus correctly (both the simple case and after in-dossier navigation); all four contextual back-navigation pairs (see Navigation history) resolve correctly; Game Over's new Leaderboard/Home buttons are present, wired, and visually match the requested hierarchy; the landing page is pixel-unchanged in composition at mobile and desktop; the pause button doesn't overlap the canvas-drawn HUD at mobile or desktop viewport sizes; pausing produces byte-identical screenshots 1.5s apart; Resume/Restart/Exit To Home all behave correctly; Burst is inert while paused; reduced-motion disables every decorative animation checked (dossier, carousel).
- Open issues: none known in the paths covered by this pass. Production has not been checked against this exact commit by this session (no network egress available).
- Files requiring caution: `js/main.js` (owns both the title showcase repaint lifecycle and the pause freeze choke point — do not add a second repaint path or a second place that gates simulation), `js/ui.js` (owns `show()`/`goBack()`/`goHome()` — route new "Back" buttons through `goBack()`, not a hardcoded `show()`), `js/nerfs-page.js` (owns both the carousel and the dossier, and is the one authoritative `#scNerfs`/`.nerf-dossier` stylesheet), `js/pause.js`, `js/burst.js` (has its own loop — any future pause-adjacent gameplay feature should check whether it also needs its own `Game.paused` guard rather than assuming `Game.update()` gating covers it).
