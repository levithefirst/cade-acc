# CADE OPS State

Documentation-only project memory. This file is not imported by runtime code and is not part of the application bundle.

## 1. Architecture

- Static HTML entry point: `index.html`.
- Vercel serves the repository as a static site and auto-detects `api/*.js` as serverless functions.
- Runtime JavaScript is vanilla ES modules under `js/`.
- CSS is split across `css/style.css`, `css/polish.css`, `css/burst.css`, and `css/identity.css`.
- Main runtime entry point: `js/main.js`.
- Gameplay canvas: `#cv`.
- DOM screens are `.screen` elements in `index.html`.
- `js/main.js` owns the central game state, viewport sizing, input, update loop, and canvas render loop.
- `js/ui.js` owns screen presentation, HUD/results UI, theme helpers, and the title showcase renderer.
- `js/teams.js` owns the six in-game team definitions and their canvas drawing functions.
- `js/nerfs-page.js` owns NERFS roster markup/data and its page-specific presentation behavior.
- `js/leaderboard.js` owns client identity/leaderboard UI integration; `api/player.js`, `api/submit-score.js`, and `api/leaderboard.js` provide the server side.

## 2. Gameplay Systems

- `Game` in `js/main.js` is the central state machine: `title`, `play`, `freeze`, `finalrug`, `out`, and `results`.
- `Player` in `js/player.js` handles keyboard/pointer movement, Ape Dash, iframes, trail effects, and energy speed boost.
- `Teams` in `js/teams.js` manages the six team leaders used as Nerf targets and hazards.
- `Rugs` and `Pumps` manage secondary hazards/rewards.
- `Game.collisions()` handles player/target interactions, including swept dash checks against teams.
- `js/burst.js` and `css/burst.css` provide the Burst combat mechanic.
- `js/particles.js` provides ambient particles, hit effects, rings, floaters, and FX.
- `js/audio.js` owns sound/music/haptics.
- `js/telemetry.js` records gameplay telemetry.
- Scoring, multiplier, timer, lives, nerf count, grazes, pumps, dashes, and run statistics are maintained by `Game`.

## 3. UI / Screen System

Screens currently include:

- `#scIdentity`: first-time anonymous player registration.
- `#scTitle`: landing/title screen.
- `#scHowToPlay`: rules gate before a run.
- `#scNerfs`: six-Nerf roster page.
- `#scLeaderboard`: global leaderboard.
- `#scEnd`: results screen.

The normal screen visibility mechanism is `.screen.on` in `css/style.css`. `ui.show()` removes `.on` from the main navigable screens and adds it to the requested screen. Identity registration has a separate explicit show/hide path because it is a pre-title gate.

Sound and theme controls are wired from `ui.js`. Theme state is persisted through `Store`; the active theme is exposed as `data-theme` on `<html>`.

## 4. Rendering Pipeline

### Gameplay canvas `#cv`

`main.js` sizes `#cv` from `window.innerWidth/innerHeight` and device pixel ratio. The animation frame loop updates the game and then renders the background, ambient effects, Pumps, Rugs, Teams, player/effects, HUD, and post-processing.

### Title showcase `#roster-showcase`

`ui.paintRosterShowcase()` draws a static title composition using the same `TEAM_ROSTER[*].draw()` functions used in gameplay. It also draws decorative pumps, a rug fragment, and a custom player/operator hero. The canvas is intentionally transparent so the title composition can sit over the live gameplay canvas/ambient background.

**Rendering contract:** `#roster-showcase` must be painted only after the title screen is visible and has measurable layout dimensions. A hidden `.screen` can return zero dimensions from `getBoundingClientRect()`, so eager painting while `#scTitle` is `display:none` is invalid.

Resize/orientation changes must repaint after layout has settled.

### DOM overlays

Title/results/leaderboard controls are regular DOM elements layered above `#cv`. Brand marks use small canvases painted by `paintDomMark()`.

## 5. Asset System

- Runtime static assets live under `assets/`.
- The NERFS page currently uses `assets/nerfs-sprite.jpg` as a six-frame horizontal sprite.
- Expected sprite geometry is `768x128`, six adjacent `128x128` frames ordered Steve, gnar, Kosgood, Scotty, Rookmate, Pop Punk.
- Production URL: `/assets/nerfs-sprite.jpg`.
- Runtime-critical image assets must be valid, fully decodable image files. A repository file existing is not sufficient; the image must decode successfully in production.

## 6. NERFS Page

`js/nerfs-page.js` owns the roster data and renders six cards into `#nerfsGrid`.

Roster order and sprite indices:

1. Steve / `@steoniy` / index 0
2. gnar / `@gnarzilla` / index 1
3. Kosgood / `@kosgooood` / index 2
4. Scotty / `@scottybmitchell` / index 3
5. Rookmate / `@0xRookmate` / index 4
6. Pop Punk / `@PopPunkOnChain` / index 5

The page uses the sprite as a single image and crops the selected frame with CSS positioning. The NERFS page is responsive: desktop uses the established grid and small screens use horizontal scroll/snap cards.

Visual ownership should remain consolidated: `nerfs-page.js` may inject the page-specific stylesheet because that is the current architecture, while `css/polish.css` should not introduce competing NERFS portrait/layout rules.

## 7. Theme System

- Dark mode is the default and uses `--void: #141414` with CADE orange/gold accents.
- Light mode uses the established bright-gold CADE treatment and is selected through `data-theme="light"`.
- Important palette tokens include `#2F2F2F`, `#FFB514`, `#141414`, `#FFA800`, and `#FFFFFF`.
- `Theme.colors()` supplies canvas colors; `Theme.apply()` updates the document theme and repaints DOM brand marks.
- Transparent title showcase rendering is intentional. Theme fixes must not make the showcase opaque merely to mask missing canvas content.

## 8. Important Design Contracts

- Screen visibility uses the existing `.screen.on` mechanism.
- Canvas rendering must happen only when the target canvas has real layout dimensions.
- The title showcase is decorative UI and must remain separate from gameplay state/rendering.
- Gameplay character drawing remains in `teams.js`; the NERFS page is a presentation layer.
- The six-frame NERFS sprite must remain a valid, decodable local asset with stable frame ordering.
- Runtime visual failures must not be hidden with blanket `catch` blocks.
- Avoid duplicate ownership of the same visual component across injected JavaScript CSS and global styles.
- Gameplay systems should not be changed for presentation-only bugs.

## 9. Known Issues

- **FIXED:** Title showcase initialization-order bug. Root cause: `paintRosterShowcase()` was called from `main.js` before `initPlayerName()` could make `#scTitle` visible, allowing a zero-sized canvas backing bitmap. Fix: repaint only after the title screen is visible/measurable and through the established screen lifecycle.
- **FIXED:** NERFS sprite asset integrity. The previous production sprite had to be treated as an asset-level failure when it did not decode reliably. The replacement must be validated as a complete JPEG before release.
- **FIXED:** NERFS sprite frame selection must use the container-relative frame width, not an image-width assumption.
- **FIXED:** Obsolete `visual-fix.js` repaint workaround removed once the title lifecycle is authoritative.

## 10. Failed Fixes

- Repeated CSS-only changes to the title showcase did not address the hidden-canvas initialization order. Do not repeat CSS patches when the canvas is painted before layout exists.
- Repainting from a side-effect module (`visual-fix.js`) with a silent `catch` obscured renderer failures and created a competing initialization path. The root lifecycle must own repainting.
- Repeated NERFS card styling changes did not solve an invalid/corrupt sprite asset. Validate the binary asset before changing card CSS.

## 11. Major Decisions

- Keep the game as a vanilla ES-module/static-site architecture rather than introducing a framework.
- Keep gameplay characters and the title showcase on the existing canvas drawing system.
- Keep NERFS page artwork local and deterministic rather than using remote avatar URLs.
- Treat server-side leaderboard identity as authoritative; client storage is only a durable cache.
- Keep this document documentation-only. It must never be imported or referenced by runtime code.

## 12. Change History

- 2026-08-18: NERFS roster, combat, and identity systems were consolidated through the existing vanilla module architecture.
- 2026-08-19: NERFS image asset/rendering fixes were applied after the roster page showed empty portrait areas.
- 2026-08-19: Title/NERFS rendering root-cause repair prepared around lifecycle ordering and asset validation.

## 13. Current Verified State

- Last verified commit: `066c3e399e2fc50bc6256da2810c8411d6208118` before the current root-cause repair.
- Last verified date: 2026-08-19.
- Current known production status: NERFS cards render but the portrait pipeline requires root-cause validation; title showcase initialization order also requires correction.
- Open issues: current root-cause repair is in progress.
- Files requiring caution: `js/main.js`, `js/ui.js`, `js/leaderboard.js`, `js/nerfs-page.js`, `js/visual-fix.js`, `js/teams.js`, `css/style.css`, `css/polish.css`, and `assets/nerfs-sprite.jpg`.
