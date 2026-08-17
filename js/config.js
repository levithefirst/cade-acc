/* ============================================================
   CADE NERF — config.js
   All tunable constants + static data tables. Zero dependencies,
   imported by everything else.

   IMPORTANT: the CFG block below is carried over byte-for-byte from
   CADE RUSH. Those numbers (SPAWN_RATE_*, PLAYER_*, LIVES, ENERGY_*,
   HITSTOP_*, etc.) were calibrated against a headless hit-probability
   simulation targeting: average play dies ~30-35s, skilled play has a
   real shot at a clean 60s run. Don't hand-tune these without re-running
   that check — see the project notes handed to you alongside this file.
   ============================================================ */

export const CFG = {
  RUN_SECONDS:      60,
  MELTDOWN_AT:      15,     // seconds remaining when chaos starts
  FREEZE_SECONDS:   1.15,   // "YOU SURVIVED" hold at 0:00
  FINAL_RUG_WINDOW: 2.2,    // time to dodge the surprise final rug
  LIVES:            3,      // hits to survive before an early "RUGGED OUT"

  PLAYER_R:         13,
  PLAYER_ACCEL:     4200,   // keyboard
  POINTER_ACCEL:    5400,   // mouse/touch
  PLAYER_MAXV:      620,    // dodge-vs-hazard speed balance — calibrated, do not touch casually
  PLAYER_DRAG:      0.80,
  POINTER_DEADZONE: 4,      // px before pointer pull kicks in, kills micro-jitter
  POINTER_EASE:     70,     // px over which pointer pull ramps to full strength
  TOUCH_OFFSET_Y:   70,     // player sits above the finger, not under it

  DASH_TIME:        0.30,
  DASH_SPEED:       1250,
  DASH_COOLDOWN:    2.2,

  // pump energy meter — 3 pumps collected without a hit in between fills
  // it; full bar triggers a temporary speed boost that drains back down
  // over ENERGY_DRAIN_TIME, then resets to earning it from zero again.
  ENERGY_FILL_PUMPS:  3,
  ENERGY_DRAIN_TIME:  5,
  ENERGY_BOOST_MULT:  1.3,

  NEAR_BAND:        15,     // graze distance beyond hitboxes
  MULTI_STEP:       0.25,
  MULTI_MAX:        15,
  MULTI_GRACE:      1.4,    // seconds before decay begins
  MULTI_DECAY:      0.30,   // per second
  MULTI_HIT_KEEP:   0.25,   // fraction kept on hit (hard reset)

  PUMP_R:           11,
  PUMP_BASE:        30,
  BIG_PUMP_MULTI:   5,
  BIG_PUMP_MULT:    1.6,
  GRAZE_BASE:       12,
  SURVIVE_BONUS:    1500,
  PERFECT_BONUS:    3500,

  MAX_RUGS:         120,
  MAX_PUMPS:        24,
  MAX_PARTS:        600,
  HIT_IFRAMES:      1.0,

  HITSTOP_GRAZE:    0.028,
  HITSTOP_STREAK:   0.06,
  HITSTOP_PUMP:     0.02,
  HITSTOP_DASHKILL: 0.09,
  HITSTOP_HIT:      0.14,
  HITSTOP_FINAL:    0.32,
  HITSTOP_SCALE:    0.07,

  STREAK_MILESTONES:[3,6,10,15,20],
  STREAK_BONUS:     220,

  PRESSURE_START_FRAC: 1.06,
  PRESSURE_END_FRAC:   0.42,
  PRESSURE_HIT_CD:     0.55,

  BURST_AT:         6,
  BURST_INTERVAL:   1.05,
  BURST_COUNT:      3,

  SPAWN_RATE_START:     2.08,
  SPAWN_RATE_MID:       0.88,
  SPAWN_RATE_MELT_END:  0.32,

  STORE_KEY:        "cadenerf.v1", // new game, new save slot — doesn't collide with CADE RUSH's saved data

  /* ============================================================
     TEAMS — placeholder tuning, NOT calibrated yet.
     These exist so teams.js has something to read while it's a stub.
     Once real characters + real playtesting happen, these need the
     same simulation-backed treatment the hazard curve above got —
     right now they're reasonable starting guesses, nothing more.
     ============================================================ */
  MAX_TEAMS:          16,   // pool size, mirrors MAX_RUGS's pattern
  TEAM_COUNT_ACTIVE:  6,    // how many teams are "in play" at once — placeholder
  TEAM_R:             16,   // placeholder hitbox radius, will vary per-character later
  TEAM_SPEED:         [70,130], // placeholder roam speed range
  TEAM_NERF_SCORE:    150,  // placeholder score award on a successful nerf
  TEAM_NERF_MULTI_BONUS: 0.5, // placeholder multiplier bump on nerf, mirrors GRAZE_BASE's role
  TEAM_DISABLE_TIME:  4,    // seconds a nerfed team stays down before respawning
  TEAM_RESPAWN_DELAY: 1.5,  // seconds after disable-time ends before it re-enters play
};

export const RANKS = [
  [0,      "PAPER HANDS",       "You folded before the chart even moved."],
  [1200,   "EXIT LIQUIDITY",    "Somebody got rich off that run. Wasn't you."],
  [3200,   "RETAIL DEGEN",      "Respectable. Still bought the top though."],
  [6500,   "DIAMOND PALMS",     "Not quite hands yet. Getting there."],
  [11000,  "CHAIN MENACE",      "You are officially a liquidity hazard."],
  [18000,  "RUG WHISPERER",     "You danced on the wick and lived."],
  [28000,  "ABSOLUTE PSYCHOPATH","Touch grass. Immediately. Then run it back."]
];

export const RUG_TYPES = {
  // speeds calibrated via simulation (0.86x of the original punishing curve)
  // — rugs are kept as SECONDARY hazards in CADE NERF per the brief.
  DUMP:        {r:38, speed:[95,142],  col:"#FF2A2A", label:"DUMP",  w:2.3, h:0.7},
  WICK:        {r:9,  speed:[361,482], col:"#FF5A5A", label:"WICK",  w:0.35,h:3.4},
  LIQUIDATION: {r:17, speed:[129,163], col:"#FF3D6E", label:"LIQ",   w:1,   h:1},
  FAKEOUT:     {r:21, speed:[163,206], col:"#C42BFF", label:"FAKE",  w:1.2, h:1.2},
  WHALE:       {r:66, speed:[45,62],   col:"#8A1020", label:"WHALE", w:1.6, h:1.1}
};

/* ============================================================
   Shared pure utilities — no DOM/canvas access, safe to import anywhere.
   ============================================================ */
export const rnd   = (a,b)=>a+Math.random()*(b-a);
export const rint  = (a,b)=>Math.floor(rnd(a,b+1));
export const clamp = (v,a,b)=>v<a?a:v>b?b:v;
export const lerp  = (a,b,t)=>a+(b-a)*t;
export const pick  = arr=>arr[(Math.random()*arr.length)|0];
export const TAU   = Math.PI*2;

// lighten/darken a hex color by a fraction — used for rug/team bevel gradients
export function shadeColor(hex, pct){
  const num = parseInt(hex.slice(1),16);
  const amt = Math.round(255*pct);
  let r = clamp((num>>16)+amt, 0, 255);
  let g = clamp(((num>>8)&0xFF)+amt, 0, 255);
  let b = clamp((num&0xFF)+amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
