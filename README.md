# CADE OPS

**Dash. Nerf. Dominate.** CADE OPS is a 60-second arcade game for the browser, presented as "CadeMarket presents". You dash through six roaming team leaders (the "Nerfs") to disable them, dodge rugs, and chain near-misses into a degen multiplier. Your best score goes onto a global leaderboard tied to a callsign that can't be changed.

It is plain HTML, CSS and native ES modules on a canvas, with no build step. Five Vercel serverless functions in `api/` back the game with Upstash Redis.

![HTML5 Canvas](https://img.shields.io/badge/HTML5-canvas-E34F26?logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20modules-F7DF1E?logo=javascript&logoColor=black)
![Vercel Functions](https://img.shields.io/badge/Vercel-functions-000000?logo=vercel&logoColor=white)
![Upstash Redis](https://img.shields.io/badge/Upstash-Redis-00E9A3?logo=upstash&logoColor=white)

> [!NOTE]
> The repo's homepage, `cade-acc.vercel.app`, currently returns Vercel `DEPLOYMENT_NOT_FOUND`, and so does the share URL hard-coded in `js/ui.js` (`cade-ops.vercel.app`). Right now there is no live deployment to play.

---

## How to play

| Input | Action |
|---|---|
| Mouse, drag (touch), <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys | Move |
| ⚡ button | **Ape Dash**. Dash through a team leader to nerf them. |
| <kbd>Space</kbd> or the BURST button | **Burst**, which charges from pumps and close calls |

- A run lasts **60 seconds**, and the last **15 seconds** are a "meltdown" with heavier spawns.
- You get **6 lives**. Touching a team or a rug without dashing costs one.
- **Grazing** hazards builds the degen multiplier, up to ×15.
- **Green pumps** pay out multiplied. Collect 3 in a row to fill your energy bar for a speed boost.
- When the run ends you get a rank, from *PAPER HANDS* up to *ABSOLUTE PSYCHOPATH*. You can share it on X, copy the tweet, or save a score card image.

There are five rug types: `DUMP`, `WICK`, `LIQUIDATION`, `FAKEOUT` and `WHALE`. The six Nerfs are Steve, gnar, Kosgood, Scotty, Rookmate and Pop Punk, each with its own weapon and combat AI. All tunables live in [`js/config.js`](js/config.js).

## Features

- **Permanent callsign.** On first visit you pick a callsign of 10–16 characters (letters, numbers, spaces, `_` or `-`). The server stores it against an HttpOnly `__Host-cade_player_id` cookie, and after that it can't be changed.
- **Global leaderboard.** Each registered player gets one entry, holding their best score (Redis `ZADD GT`). Submissions are idempotent per `runId` for 24 hours and rate-limited to 5 per IP per minute. Claiming the run and updating the score happen in one atomic Lua script.
- **Resilient submits.** The client stores a pending score and retries it after a reload or when you open the leaderboard. The leaderboard waits for any in-flight write before it loads.
- **Aggregate analytics.** `/api/stats` exposes only public-safe totals, such as players online (a 45-second presence lease), sessions, completions, high score and averages. See [`docs/ANALYTICS.md`](docs/ANALYTICS.md).
- **Polish.** Hit-stop, particles, a synthesized audio toggle, light and dark themes, pause, and a "Meet The Nerfs" roster page.

## API

These are Vercel Node functions with default-export handlers. The ones that write data reject cross-site requests (`403`).

| Endpoint | Method | Purpose |
|---|---|---|
| [`/api/player`](api/player.js) | `GET`, `POST` | Read or register the cookie-bound player and callsign (`409` if the callsign is locked) |
| [`/api/submit-score`](api/submit-score.js) | `POST` | Submit a run's score (`401` if unregistered, `429` if rate-limited) |
| [`/api/leaderboard`](api/leaderboard.js) | `GET` | Top scores (the client asks for `?limit=25`) |
| [`/api/telemetry`](api/telemetry.js) | `POST` | Session start, end and presence heartbeats |
| [`/api/stats`](api/stats.js) | `GET` | Aggregate, public-safe metrics |

If the Redis env vars are missing, every endpoint returns `500 … not configured`.

## Run it

There is no `package.json` and no build step.

**Game only.** Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

The canvas, assets and modules load this way. But the callsign, leaderboard and telemetry calls to `/api/*` will fail, because the functions aren't running.

**With the API**, deploy to Vercel (or run `vercel dev`) and set:

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

> [!NOTE]
> `vercel dev` has not been tested against this repo. The functions use `fetch` against the Upstash REST API and have no npm dependencies.

## Project layout

```
index.html          entry point: all screens + module scripts
js/
  main.js           game state, loop, canvas, input, viewport
  config.js         tunables, ranks, rug types
  player.js teams.js rugs.js pumps.js combat-ai.js burst.js pause.js particles.js
  ui.js             screens, HUD, results, share/score card
  leaderboard.js    callsign registration, score submit + retry, board
  telemetry.js      session + presence client
  audio.js nerfs-page.js
css/                style.css, polish.css, burst.css, identity.css
api/                Vercel serverless functions (Upstash Redis)
assets/nerfs/       roster portraits
docs/               ANALYTICS.md, CADE_OPS_STATE.md (project notes)
```

The game started out as "Cade Rush". The Redis keys still use the `caderush:` prefix, and `localStorage` uses `cadenerf.v1`.

## Status

[`docs/CADE_OPS_STATE.md`](docs/CADE_OPS_STATE.md) holds the most recent project notes (20 Aug 2026). They list two checks that were still open: a production deploy of the leaderboard repair, and a real-device submission of a score above 200,000. A "V2 Hunt" prototype was built and then reverted on `main`.

## License

MIT. See [LICENSE](LICENSE).
