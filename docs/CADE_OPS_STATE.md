# CADE OPS — Project State

Documentation-only project memory. This file is never imported by JavaScript, CSS, build tooling, or runtime code. Source files remain the runtime source of truth.

## Last Verified
- Date: 2026-08-20
- Repository: `levithefirst/cade-acc`, branch `main`
- Latest source repair commit: `6c50671059449494e4488d62eb51072fc3752ffb`
- Production currently serves the previous READY deployment until the Git-connected deployment for the latest commit completes.

## Architecture
- Static HTML + native ES modules. `index.html` is the entry point.
- `js/main.js` owns central game state, animation loop, gameplay canvas, input state, theme state, and viewport sizing.
- `js/player.js`, `js/teams.js`, `js/rugs.js`, `js/pumps.js`, `js/combat-ai.js`, `js/burst.js`, `js/pause.js`, and `js/particles.js` provide gameplay systems.
- `js/ui.js` owns DOM screen navigation, HUD/results rendering, title showcase drawing, sound/theme UI, and share actions.
- `js/leaderboard.js` owns callsign registration, client identity persistence, score submission, and leaderboard display.
- `/api/player.js`, `/api/submit-score.js`, and `/api/leaderboard.js` are Vercel serverless endpoints backed by Upstash Redis.
- CSS is split between shared stylesheets and component-specific injected NERFS styles in `js/nerfs-page.js`.

## Leaderboard Contracts
- Player identity is server-authoritative through the HttpOnly `__Host-cade_player_id` cookie.
- Canonical leaderboard storage has one member per registered player and keeps the best score with Redis `ZADD GT`.
- Legacy run-based leaderboard rows remain readable and are never overwritten by new canonical submissions.
- There is no arbitrary game-score ceiling. Scores must only be finite, non-negative, safely representable integers in JavaScript.
- A run submission is idempotent for 24 hours through its `runId`.
- The run claim and canonical leaderboard update now happen inside one atomic Redis Lua script. A transient failure can no longer consume a run before its score is written.
- IP rate-limit increment and expiry now happen inside one atomic Redis Lua script, avoiding an unexpired rate-limit key if the request fails between those operations.
- The client persists a pending score and retries it after reload or when opening the leaderboard, and the leaderboard waits for the in-flight score write before fetching results.

## Gameplay Systems
- `Game.update()` is the central simulation path.
- Player movement supports pointer/touch plus WASD/arrow controls. Dash is handled by the existing player system.
- Teams are the NERF objectives and collision hazards. Rugs and pumps are separate arena systems.
- Combat AI is attached to the existing team update/draw flow.
- Score, multiplier, lives, timer, nerf count, pumps, grazes, dashes, hits, Burst, and final-rug behavior remain in the existing gameplay modules.
- The leaderboard repair did not change gameplay mechanics, scoring formulas, difficulty, combat, AI, or run timing.

## Verification
- [x] Current repository tree inspected.
- [x] `/api/player.js` inspected.
- [x] `/api/submit-score.js` inspected and repaired.
- [x] `/api/leaderboard.js` inspected.
- [x] Client leaderboard submission/retry path inspected.
- [x] Production leaderboard endpoint returned HTTP 200 with current data.
- [x] Production runtime logs inspected for the last 6 hours.
- [x] The observed production HTTP 400 was traced to the obsolete score ceiling.
- [x] Source-level JavaScript syntax of the new Redis-script wrapper was checked with Node.
- [x] The old failure window between run claiming and `ZADD` was removed.
- [x] Rate-limit increment/expiry race was removed.
- [ ] Production deployment of commit `6c50671059449494e4488d62eb51072fc3752ffb` still needs to become READY.
- [ ] A real browser session must submit a >200,000 score to validate the live cookie/session path end-to-end.

## Known Production Signals
- In the last 6 hours before the latest source repair, production recorded 20 HTTP 200 responses, one HTTP 400, and one HTTP 405 across the inspected serverless traffic.
- The single HTTP 400 was `POST /api/submit-score` at 12:43 UTC on the older deployment and corresponded to the legitimate high-score rejection.
- The only grouped runtime error reported in the last hour was Node's `DEP0169` `url.parse()` deprecation warning on `/api/leaderboard`, with no application exception cluster reported.

## Resolved Issues
### Leaderboard rejecting legitimate high scores
- Root cause: the server had a hard `MAX_PLAUSIBLE_SCORE` ceiling that rejected the observed 219,636 run.
- Fix: removed the game-score ceiling entirely. Only invalid numeric values are rejected.

### Score submission could be lost after a transient Redis failure
- Root cause: the old code claimed `runId` before performing `ZADD`. If `ZADD` failed after the claim, a retry was treated as a duplicate and the score could be stranded in local pending storage.
- Fix: the run claim and best-score update are now one atomic Redis Lua operation.

### Rate-limit key could become permanent
- Root cause: `INCR` and `EXPIRE` were separate network operations. A failure between them could leave the key without expiry.
- Fix: increment and expiry are now one atomic Redis Lua operation.

### Stale leaderboard immediately after Game Over
- Root cause: score submission could still be in flight while the leaderboard was opened.
- Fix: the client tracks the submission promise and waits for it before fetching the board.

## Remaining Verification
- The current source is repaired, but production must be checked again after Vercel serves commit `6c50671059449494e4488d62eb51072fc3752ffb`.
- A real-device submission above 200,000 remains the final end-to-end check because this environment cannot reuse the user's browser cookie/session.
