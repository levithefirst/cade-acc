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
- `paintRosterShowcase()` measures the title canvas and draws the existing `TEAM_ROSTER` composition.
- A hidden title screen cannot provide reliable canvas dimensions. `js/visual-fix.js` now treats title visibility as the paint lifecycle boundary, schedules a repaint on the next animation frame, observes title class changes, and repaints on resize/orientation. It deliberately does not swallow renderer exceptions.

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
- **FIXED — landing showcase gold/blank rectangle.** Root cause: the initial showcase paint can occur before the title screen has a measurable layout. The lifecycle repair now repaints only after `#scTitle` is visible and on the next animation frame, including navigation/resize/orientation. A silent renderer catch was removed.
- **FIXED — NERFS blank portraits.** Root cause: the repository sprite asset was not a reliably decodable production JPEG. The six-frame sprite was replaced with a valid 768x128 JPEG and strict decoding/frame validation was performed.
- **MONITORING — NERFS CSS ownership.** The page-level stylesheet and runtime component stylesheet both contain NERFS rules. They are currently non-destructive to the repaired image pipeline, so no broad CSS rewrite was introduced during this deadline repair.

## Failed fixes
- CSS-only patches to the title screen did not address the hidden-canvas measurement race.
- Styling changes to the NERFS portrait container could not repair an invalid/truncated image asset.
- Silent `try/catch` repaint logic obscured renderer failures and must not be reintroduced.

## Major decisions
- Keep the existing canvas renderer and screen architecture.
- Use the existing local sprite asset rather than remote or generated avatars.
- Use title visibility and animation-frame timing as the showcase paint contract.
- Keep gameplay systems outside the rendering repair boundary.

## Production constraints
- Production NERFS asset path: `/assets/nerfs-sprite.jpg`.
- Static site deployment; no framework-specific image pipeline is involved.
- Documentation must never be imported or bundled.

## Change history
- 2026-08-19 — rendering repair — corrected title showcase lifecycle and restored a valid six-frame NERFS portrait asset without changing gameplay.

## Current verified state
- Last verified commit: pending final commit SHA.
- Last verified date: 2026-08-19.
- Current production status: pending final deployment verification.
- Open issues: NERFS CSS ownership is monitored; no known asset/rendering blocker remains after source and asset validation.
- Files requiring caution: `js/main.js`, `js/ui.js`, `js/visual-fix.js`, `js/nerfs-page.js`, `css/polish.css`, `assets/nerfs-sprite.jpg`.
