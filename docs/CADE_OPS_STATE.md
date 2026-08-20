# CADE OPS — Project State

Documentation-only project memory. This file is never imported by JavaScript, CSS, build tooling, or runtime code. Source files remain the runtime source of truth.

## Last Verified
- Date: 2026-08-20
- Repository: `levithefirst/cade-acc`, branch `main`
- Current source HEAD: `7c6429ff6fc2451a771b4dcacddbd40eed116df2`
- Production deployment verified for the code repair: Vercel deployment `dpl_4Fb3LgQa7vDSH8h6nevS4XNAKiy5`, serving commit `e910e883d6f563eb8d47eaa05440da38a8b10f48`, state READY.

## Architecture
- Static HTML + native ES modules. `index.html` is the entry point.
- `js/main.js` owns central game state, animation loop, gameplay canvas, input state, theme state, and viewport sizing.
- `js/player.js`, `js/teams.js`, `js/rugs.js`, `js/pumps.js`, `js/combat-ai.js`, `js/burst.js`, `js/pause.js`, and `js/particles.js` provide gameplay systems.
- `js/ui.js` owns DOM screen navigation, HUD/results rendering, title showcase drawing, sound/theme UI, and share actions.
- `js/leaderboard.js` owns callsign registration, client identity persistence, score submission, and leaderboard display.
- `/api/player.js`, `/api/submit-score.js`, and `/api/leaderboard.js` are Vercel serverless endpoints backed by Upstash Redis.
- CSS is split between shared stylesheets and component-specific injected NERFS styles in `js/nerfs-page.js`.

## Gameplay Systems
- `Game.update()` is the central simulation path.
- Player movement supports pointer/touch plus WASD/arrow controls. Dash is handled by the existing player system.
- Teams are the NERF objectives and collision hazards. Rugs and pumps are separate arena systems.
- Combat AI is attached to the existing team update/draw flow.
- Score, multiplier, lives, timer, nerf count, pumps, grazes, dashes, hits, Burst, and final-rug behavior remain in the existing gameplay modules.
- This repair did not change gameplay mechanics, scoring formulas, difficulty, combat, AI, or run timing.

## UI / Screen System
- Screens are DOM `.screen` containers switched through `show()`, `goBack()`, and `goHome()` in `js/ui.js`.
- `#scIdentity` is the callsign gate handled by `js/leaderboard.js`.
- `#scTitle`, `#scHowToPlay`, `#scNerfs`, `#scLeaderboard`, and `#scEnd` are the major DOM screens.
- Active gameplay is rendered on `#cv` rather than a gameplay DOM screen.
- Sound, theme, leaderboard, NERFS navigation, pause, and results controls reuse the established UI systems.

## Rendering Pipeline
- `#cv` is the main gameplay canvas. `main.js` sizes it from the viewport and device-pixel ratio.
- `#roster-showcase` is a separate transparent title canvas painted by `paintRosterShowcase()` using the real `TEAM_ROSTER` draw functions.
- The title showcase has one authoritative repaint lifecycle in `main.js`. It waits until `#scTitle` is visible/measurable, then paints on the next animation frame, and repaints on resize/orientation.
- Gameplay rendering runs through the existing `render()` path. Decorative title rendering remains separate from gameplay simulation.

## Assets
- Runtime assets live under `assets/` and use repository-relative production paths.
- NERFS portraits are individual files under `assets/nerfs/` for Steve, Gnar, Kosgood, Scotty, Rookmate, and Pop Punk.
- The old `assets/nerfs-sprite.jpg` implementation was removed. NERFS cards use normal image elements with the individual portrait files.
- Vercel serves the static site directly; `/api` contains serverless functions.

## NERFS Page
- `js/nerfs-page.js` owns roster data presentation, the six portrait cards, responsive/carousel behavior, dossier behavior, and component-specific CSS.
- Portraits are actual image assets, not placeholders or CSS-only silhouettes.
- Character identity/data remains sourced from the existing roster and combat systems.

## Theme
- `Theme` in `js/main.js` is authoritative for dark/light rendering.
- Cade Market palette: `#2F2F2F`, `#FFB514`, `#141414`, `#FFA800`, `#FFFFFF`.
- The title showcase is intentionally transparent and must be painted after its layout exists in both themes.

## Important Contracts / Invariants
- Fix rendering lifecycle failures at their source. Do not hide them with arbitrary opacity, overflow, or timing hacks.
- Do not measure a hidden screen for canvas backing dimensions.
- The title showcase has one authoritative repaint lifecycle in `main.js`.
- NERFS image assets must remain valid, decodable, and reachable from production.
- Callsign text entry must not feed the gameplay WASD/arrow keyboard handler.
- Leaderboard writes are server-authoritative and keyed to the immutable player cookie.
- A legitimate high score must not be rejected merely because an obsolete sanity ceiling is too low.
- The leaderboard UI must not race an in-flight score write and read stale personal data immediately after Game Over.
- Gameplay systems remain separate from decorative UI fixes.
- This document has no runtime role.

## Known Issues
- No known active issue from the repaired paths. A real-device keyboard test and a real >200,000-point submission remain the final user-level checks because this environment cannot impersonate the user's browser cookie/session.

## Resolved Issues
### Landing showcase / gold rectangle
- Status: FIXED before this repair.
- Root cause: the title showcase could be painted before `#scTitle` had measurable layout, producing a bad canvas backing size; there had also been a competing temporary repaint path.
- Fix: `main.js` now owns the deterministic title-visibility repaint lifecycle; the obsolete `visual-fix.js` workaround was removed in the earlier rendering repair.
- Gameplay was untouched.

### NERFS portraits
- Status: FIXED before this repair.
- Root cause: the earlier sprite-based asset/rendering path was replaced after validation with six individual portrait assets and direct image rendering.
- Fix: six production-safe individual portrait files and a single NERFS component rendering path.

### Callsign WASD/ASD input
- Status: FIXED in this repair.
- Root cause: the global gameplay keyboard handler owns WASD/arrow keys and calls `preventDefault()`. The callsign input needed a hard event boundary so gameplay keyboard handling could never consume text-entry keystrokes.
- Fix: `js/leaderboard.js` isolates `keydown` and `keyup` at the callsign input during the target phase using `stopImmediatePropagation()`. Normal input default behavior is not cancelled.
- Verify: focus the callsign field and type `A`, `S`, and `D` among normal letters; the characters must appear in the field and must not affect gameplay input state.

### Leaderboard rejecting new high scores
- Status: FIXED in this repair.
- Root cause: production `POST /api/submit-score` returned HTTP 400 for the observed 219,636-point run because `api/submit-score.js` capped `MAX_PLAUSIBLE_SCORE` at 200,000. Vercel runtime logs recorded a 400 at 12:43 UTC while the public leaderboard still showed the previous 86,456 score.
- Fix: raise the server-side sanity ceiling to 1,000,000 while keeping finite/non-negative validation, immutable identity checks, run de-duplication, rate limiting, and best-score semantics. `js/leaderboard.js` also tracks the in-flight submission and waits for it before fetching the leaderboard when opened from results.
- Verify: complete a run above 200,000, confirm `POST /api/submit-score` returns 200, then open Global Leaderboard and confirm the new best score is present.

## Failed Fixes / Lessons
- The old title-rendering workaround used a second repaint path and silently swallowed renderer exceptions. It was replaced by one lifecycle-owned repaint path.
- The old NERFS sprite approach was abandoned in favor of individual verified portrait assets. Do not resurrect the deleted sprite path without a concrete requirement and asset validation.
- A 200,000 score ceiling was too low for the actual game. Sanity limits must reflect the real scoring range.
- Fire-and-forget score submission can make an immediately opened leaderboard read stale data. Keep the submission promise coupled to the leaderboard read path.

## Major Decisions
- Keep the existing vanilla HTML/ES-module architecture. No framework migration.
- Keep gameplay simulation in existing gameplay modules. Visual/UI fixes must not rewrite the simulation.
- Keep leaderboard identity server-authoritative through the HttpOnly player cookie.
- Preserve legacy leaderboard rows while canonical new-player scores use the player-ID sorted set.
- Keep documentation under `docs/` only; it is never a runtime source of truth.

## Change History
- 2026-08-20 — fixed leaderboard rejection of legitimate >200k scores; hardened callsign keyboard isolation; made leaderboard reads wait for the current score write.
- 2026-08-19 — repaired title showcase lifecycle and NERFS portrait rendering; removed the obsolete visual-fix repaint workaround.
- 2026-08-19 — completed NERFS responsive/dossier/navigation/pause UX work without changing gameplay rules.

## Do Not Change Casually
- `js/main.js` game loop, input state, scoring, collision, and rendering lifecycle.
- `js/leaderboard.js` identity and score submission contract.
- `/api/player.js` cookie identity semantics.
- `/api/submit-score.js` score validation, de-duplication, and Redis write path.
- `/api/leaderboard.js` canonical/legacy merge behavior.
- `assets/nerfs/` portrait filenames and production paths.
- `js/teams.js` roster identity and combat data.

## Verification Checklist
- [x] Current `main` inspected.
- [x] Current production deployment identified and READY.
- [x] Live production HTML inspected after the code repair deployment.
- [x] Production `/api/leaderboard?limit=25` inspected.
- [x] Production runtime logs inspected for `/api/submit-score`.
- [x] The observed 400 was traced to the 200,000 score ceiling.
- [x] Production now serves the repaired `js/leaderboard.js`.
- [x] Vercel build completed successfully for the repaired code.
- [x] Gameplay scoring and mechanics left unchanged.
- [x] No application code imports `docs/CADE_OPS_STATE.md`.
- [ ] Post-deploy interactive Android keyboard test by a real device.
- [ ] Post-deploy end-to-end score submission above 200,000 using a real player cookie.

## Current Verified State
- Source HEAD: `7c6429ff6fc2451a771b4dcacddbd40eed116df2`.
- Code repair commits: `7902d35edd2ee01574e6145b85fc0375c51c89e3` and `e910e883d6f563eb8d47eaa05440da38a8b10f48`.
- Production deployment: `dpl_4Fb3LgQa7vDSH8h6nevS4XNAKiy5`, READY, serving `e910e883d6f563eb8d47eaa05440da38a8b10f48`.
- Vercel build completed without build errors.
- Production HTML and repaired `js/leaderboard.js` were fetched successfully after deployment.
- Open issues: none known in source; only real-user/device verification remains for the two interaction paths that require a live browser session.
