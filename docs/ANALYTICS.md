# CADE OPS analytics

Server-side usage analytics are stored in Upstash Redis.

`GET /api/stats` returns aggregate, public-safe metrics.

The game records:

- players currently online, based on a 45-second presence lease
- active game sessions
- unique players active in the last 24 hours
- sessions started in the last 24 hours
- completed games in the last 24 hours
- lifetime registered players, sessions, and completed games
- total nerfs, grazes, dashes, pumps, and hits
- final-rug survivals
- full-roster completions
- all-time high score and multiplier
- average score and average completed-session duration

A session is created when a run starts and finalized when the result screen is reached. Duplicate end requests are ignored server-side. Presence expires automatically when a browser stops sending heartbeats, so closed or backgrounded tabs do not remain online indefinitely.

The public stats endpoint exposes aggregate numbers only. Player IDs, callsigns, IP addresses, and raw session records are never returned by `/api/stats`.
