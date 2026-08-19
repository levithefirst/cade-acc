# CADE OPS State

Documentation-only project memory. This file is never imported, bundled, or referenced by runtime code. Source files remain the runtime source of truth.

## Architecture
- Static HTML + ES modules. `index.html` is the entry point.
- Runtime JavaScript lives in `js/`; shared CSS lives in `css/`; runtime media lives in `assets/`.
- Vercel serves the repository as a static site.

## Gameplay systems
- `js/main.js` owns the central game state and animation loop.
- `js/player.js`, `js/rugs.js`, `js/pumps.js`, and `js/teams.js` own player/hazard/team behavior.
- `js/ui.js` owns canvas/DOM presentation and title showcase painting.
- This rendering repair does not change movement, dash, combat, AI, scoring, timer, health, burst mechanics, leaderboard identity, or audio.

## Screen system
- Screens are DOM containers in `index.html`, switched by the existing UI state/navigation helpers.
- `#scTitle` is the landing screen; `#cv` is the gameplay canvas; `#scNerfs` is the NERFS page.
- Identity, leaderboard, sound, and theme controls remain in their existing modules.

## Rendering pipeline
- `#cv` is the gameplay canvas.
- `#roster-showcase` is a separate decorative title canvas.
- `paintRosterShowcase()` (in `js/ui.js`) measures the title canvas and draws the existing `TEAM_ROSTER` composition.
- A hidden title screen cannot provide reliable canvas dimensions (it starts behind the identity gate). The single authoritative repaint path now lives in `js/main.js`'s boot sequence (`initRosterShowcaseLifecycle`, immediately before `requestAnimationFrame(frame)`): it treats `#scTitle` gaining the `"on"` class as the paint-lifecycle boundary, repaints on the next animation frame, observes title class mutations (covers the identity→title transition and any later back-navigation), and repaints on resize/orientation. It deliberately does not swallow renderer exceptions.
- `js/visual-fix.js` was a temporary runtime patch that duplicated this exact logic and was only reachable because `js/nerfs-page.js` imported it as a side effect (an unrelated, confusing coupling — the NERFS module has nothing to do with title rendering). Its behavior was merged into `js/main.js`'s real boot sequence and the file was deleted. There is now exactly one repaint path for the showcase; do not add a second one.

## Asset system
- Runtime images are served from `assets/` using repository-relative production paths.
- `assets/nerfs-sprite.jpg` is the six-frame NERFS portrait sprite, expected to be 768x128 with six 128x128 frames in roster order.
- The current repaired sprite was decoded and validated before being committed.

## NERFS page
- `js/nerfs-page.js` supplies the six roster records, markup, sprite positioning, interaction, and existing component styling.
- The portrait source is `/assets/nerfs-sprite.jpg`; no remote avatar source is used.
- NERFS card layout remains the existing 3 x 2 desktop composition with responsive mobile behavior.
- `css/polish.css` contains the established page-level NERFS layout rules; `js/nerfs-page.js` retains its component-specific style injection because the current implementation depends on it. No visual redesign was introduced by this repair.

## Theme system
- `Theme` in `js/main.js` remains authoritative for dark/light rendering.
- CADE palette: `#2F2F2F`, `#FFB514`, `#141414`, `#FFA800`, `#FFFFFF`.
- The title canvas is intentionally transparent; correct rendering depends on painting after the title screen has a measurable layout.

## Important design contracts
- Fix rendering lifecycle failures at the source instead of hiding them with CSS.
- Never rely on a hidden screen's zero-sized layout for canvas backing resolution.
- NERFS image assets must be valid and decodable in production.
- Decorative title rendering remains separate from gameplay rendering.
- This document has no runtime role.

## Known issues
- **FIXED — landing showcase gold/blank rectangle.** Root cause: the initial showcase paint could occur before the title screen had a measurable layout (it opens behind an identity gate). Verified locally with a headless-Chromium harness: forcing `#scTitle` to `"on"` and reading the canvas's `ImageData` back shows real painted content (tens of thousands of non-transparent pixels, not zero), repeatably, across desktop and mobile viewports and both themes, with zero page/console errors from the renderer. Not a `roundRect` compatibility issue — `TEAM_ROSTER` draw functions use native `CanvasRenderingContext2D.roundRect`, which the test browser (a current Chromium build) supports without error; this was not changed, since the actual failure was the timing race, not API support.
- **FIXED — competing repaint paths.** `js/visual-fix.js` (a runtime patch, only ever loaded as a side effect of importing `js/nerfs-page.js`) and `js/main.js`'s own direct `paintRosterShowcase()` boot call + resize/orientation listeners were two independent repaint systems for the same canvas. Consolidated into the single lifecycle owner in `js/main.js` (see Rendering pipeline); `js/visual-fix.js` deleted after confirming (via repo-wide grep) nothing else imported it.
- **FIXED — NERFS blank portraits.** `assets/nerfs-sprite.jpg` is a valid baseline JPEG, confirmed by parsing its SOF0 marker directly (768x128, 8-bit, 3 components, terminated by a proper EOI marker) and by loading it in a real browser, where all six `<img>` elements report `complete:true, naturalWidth:768, naturalHeight:128`. The committed git blob hash matches the working-tree file exactly (no CRLF/LFS corruption risk — no `.gitattributes` present). The `?v=2` cache-busting query string was left in place; it is harmless and removing it was not necessary to fix anything.
- **NOT VERIFIED IN PRODUCTION.** This environment's network egress to `cadeops.vercel.app` is blocked by policy (confirmed via both `curl`, which got a proxy-level 403 on CONNECT, and the `WebFetch` tool, which reported `EGRESS_BLOCKED`) — production could not be reached at all from this session. Everything above is VERIFIED LOCALLY only: a plain `python3 -m http.server` serving the repository root, driven by headless Chromium (Playwright), asserting on actual pixel data and real DOM/network state rather than assumptions. Since this repo has no build step (`vercel.json`/`package.json` absent — Vercel serves it as a static site with auto-detected `/api` functions), what's committed to `main` is what ships; local verification against the raw files is a reasonably strong proxy but is not the same as hitting the live URL. Whoever can reach `https://cadeops.vercel.app` should do a final pass: load `/`, `/assets/nerfs-sprite.jpg`, and the NERFS page, and confirm no console errors.
- **MONITORING — NERFS CSS ownership.** `css/polish.css` (page-level layout) and `js/nerfs-page.js`'s injected `<style>` (component-specific rules) both style `#scNerfs`. They are currently non-destructive to the image pipeline. No consolidation was done — out of scope for this repair pass, and the existing split is functioning correctly.

## Failed fixes
- CSS-only patches to the title screen did not address the hidden-canvas measurement race.
- Styling changes to the NERFS portrait container could not repair an invalid/truncated image asset.
- Silent `try/catch` repaint logic obscured renderer failures and must not be reintroduced.

## Major decisions
- Keep the existing canvas renderer and screen architecture.
- Use the existing local sprite asset rather than remote or generated avatars.
- Use title visibility and animation-frame timing as the showcase paint contract.
- Own that paint contract from exactly one place (`js/main.js`'s boot sequence) rather than a separate always-loaded patch module.
- Keep gameplay systems outside the rendering repair boundary.

## Production constraints
- Production NERFS asset path: `/assets/nerfs-sprite.jpg`.
- Static site deployment; no framework-specific image pipeline is involved.
- Documentation must never be imported or bundled.

## Change history
- 2026-08-19 — rendering repair (prior session) — corrected title showcase lifecycle and restored a valid six-frame NERFS portrait asset without changing gameplay.
- 2026-08-19 — diagnostic + repair pass — re-verified both prior fixes hold with a real headless-browser test (pixel-level assertions, not assumptions); found and fixed a genuine remaining issue (two competing repaint systems for the same canvas — `js/visual-fix.js` vs. `js/main.js`'s direct calls); consolidated to one authoritative repaint path and deleted `js/visual-fix.js`; confirmed no gameplay/scoring/difficulty/control files were touched.

## Current verified state
- Last verified commit: see this commit's parent in `git log` (this doc is updated in the same commit as the fix, so `git log -1 -- docs/CADE_OPS_STATE.md` on `main` names it).
- Last verified date: 2026-08-19.
- Current production status: not directly checked this pass (egress blocked in this environment); local verification via headless Chromium against the exact committed files shows no rendering/console errors and correct pixel output on the roster showcase, correct sprite decoding for the NERFS page, and clean syntax across every file in `js/` and `api/`.
- Open issues: none known in the rendering/asset paths covered by this pass. NERFS CSS ownership remains split across two files (monitored, not broken). Production has not been re-checked against this exact commit by this session.
- Files requiring caution: `js/main.js` (now owns the title showcase repaint lifecycle — do not add a second repaint path), `js/ui.js`, `js/nerfs-page.js`, `css/polish.css`, `assets/nerfs-sprite.jpg`.
