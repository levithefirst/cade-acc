# CADE OPS — Project State

Documentation-only project memory. This file is never imported by JavaScript, CSS, build tooling, or runtime code. Source files remain the runtime source of truth.

## Last Verified
- Date: 2026-08-20
- Repository: `levithefirst/cade-acc`, branch `main`
- Latest V2 prototype commit: `aca188f30f155a78081c833928c72e13f638261a`
- The existing CADE OPS game remains intact. V2 Hunt is an additive prototype entry point from the title screen.

## Architecture
- Static HTML + native ES modules. `index.html` is the entry point.
- `js/main.js` owns the original game state, animation loop, gameplay canvas, input state, theme state, and viewport sizing.
- `js/player.js`, `js/teams.js`, `js/rugs.js`, `js/pumps.js`, `js/combat-ai.js`, `js/burst.js`, `js/pause.js`, and `js/particles.js` provide the original gameplay systems.
- `js/ui.js` owns the original DOM screen navigation, HUD/results rendering, title showcase, sound/theme UI, and share actions.
- `js/leaderboard.js` owns callsign registration, client identity persistence, score submission, and leaderboard display.
- `/api/player.js`, `/api/submit-score.js`, and `/api/leaderboard.js` are Vercel serverless endpoints backed by the existing persistence layer.
- `js/hunt-v2.js` is a self-contained tactical Hunt prototype. It owns its own map, simulation loop, AI states, abilities, scoring, extraction, HUD, and result overlay. It does not replace the original Game loop.

## V2 Hunt Prototype
The title screen now exposes `CADE HUNT V2`.

Core loop:
- 60-second single-player hunt.
- One compact tactical map with walls, cover, routes, and an extraction zone.
- Six NERFs act as hunters.
- AI uses `UNKNOWN → INVESTIGATING → SEARCHING → HUNTING` states.
- Line-of-sight is blocked by map walls.
- NERFs retain last-known player/decoy positions during investigation/search.
- Roles are explicit: Steve Controller, Gnar Brute, Kosgood Assassin, Scotty Tracker, Rookmate Ranged, Pop Punk Disruptor.
- Four abilities are available: Rail Shot, EMP Burst, Decoy, Ghost Step.
- The final 10 seconds open extraction. The player must reach the extraction zone before time expires.
- Score has no artificial maximum. Multiplier can continue increasing during a run.
- The original CADE OPS game remains available through `Let's Cade`.

## V2 Controls
- Desktop: WASD / arrow keys to move, mouse to aim, 1–4 for abilities.
- Mobile: four on-screen ability buttons are provided. The tactical movement layer is currently keyboard-first; mobile movement remains a follow-up prototype task.
- Escape ends the Hunt prototype run.

## Leaderboard Contracts
- The existing leaderboard remains separate from the V2 Hunt prototype in this first pass.
- Canonical score storage keeps the best score per registered player.
- Legacy run-based rows remain readable.
- There is no arbitrary game-score ceiling in the existing leaderboard submission contract.
- Score submission remains idempotent through the existing run claim flow.

## Original Gameplay Systems
- `Game.update()` is the central original simulation path.
- Player movement supports pointer/touch plus WASD/arrow controls. Dash is handled by the existing player system.
- Teams are the original NERF objectives and collision hazards. Rugs and pumps are separate arena systems.
- Combat AI is attached to the existing team update/draw flow.
- Score, multiplier, lives, timer, nerf count, pumps, grazes, dashes, hits, Burst, and final-rug behavior remain in the original modules.

## Important Decisions
- V2 is additive rather than a rewrite. The current game stays playable while the Hunt prototype is tested.
- WebSockets, accounts, matchmaking, multiplayer authority, large maps, progression systems, and seasonal systems are deliberately not part of this prototype.
- The tactical core is prioritized first: map knowledge, detection, last-known position, role differentiation, abilities, pressure, and extraction.
- NERFs are hunters first. Making all six playable is deferred.
- The map is intentionally compact so routes and danger zones can be learned quickly.

## Verification
- [x] Current repository tree inspected before V2 implementation.
- [x] V2 files added without replacing the original Game loop.
- [x] Hunt JS passed Node syntax checking before commit.
- [x] Desktop keyboard controls implemented.
- [x] Four abilities implemented with cooldowns.
- [x] Detection, LOS, investigation, search, chase, and extraction implemented.
- [x] Six NERF roles implemented.
- [x] No artificial score ceiling added to V2.
- [ ] Production browser playtest of a complete 60-second Hunt remains required.
- [ ] Mobile movement needs a dedicated touch movement pass.
- [ ] V2 scores are not yet submitted to the global leaderboard.

## Known Follow-ups
- Add a proper touch joystick or drag-to-move control for Hunt.
- Add richer NERF silhouettes/animation to the V2 arena once the core loop is playtested.
- Tune detection radii, role speeds, attack cadence, map routes, and extraction pressure from real play sessions.
- Decide whether V2 should eventually replace the original `Let's Cade` flow after playtesting, rather than removing the original game now.

## Do Not Change Casually
- Original game loop, scoring, identity, leaderboard, combat, AI, audio, theme, and responsive behavior.
- Existing production API contracts.
- `docs/CADE_OPS_STATE.md` must remain documentation-only.
