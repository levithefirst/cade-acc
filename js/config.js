/* ============================================================
   CADE OPS — config.js
   All tunable constants + static data tables. Zero dependencies,
   imported by everything else.
   ============================================================ */

export const CFG = {
  RUN_SECONDS:      60,
  MELTDOWN_AT:      15,
  FREEZE_SECONDS:   1.15,
  FINAL_RUG_WINDOW: 2.2,
  LIVES:            6,

  PLAYER_R:         13,
  PLAYER_ACCEL:     4200,
  POINTER_ACCEL:    5400,
  PLAYER_MAXV:      620,
  PLAYER_DRAG:      0.80,
  POINTER_DEADZONE: 4,
  POINTER_EASE:     70,
  TOUCH_OFFSET_Y:   70,

  DASH_TIME:        0.30,
  DASH_SPEED:       1250,
  DASH_COOLDOWN:    2.2,

  ENERGY_FILL_PUMPS:  3,
  ENERGY_DRAIN_TIME:  5,
  ENERGY_BOOST_MULT:  1.3,

  NEAR_BAND:        15,
  MULTI_STEP:       0.25,
  MULTI_MAX:        15,
  MULTI_GRACE:      1.4,
  MULTI_DECAY:      0.30,
  MULTI_HIT_KEEP:   0.25,

  PUMP_R:           16,
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

  STORE_KEY:        "cadenerf.v1",

  MAX_TEAMS:          16,
  TEAM_COUNT_ACTIVE:  6,
  TEAM_R:             16,
  TEAM_SPEED:         [70,130],
  TEAM_NERF_SCORE:    150,
  TEAM_NERF_MULTI_BONUS: 0.5,
  TEAM_DISABLE_TIME:  4,
  TEAM_RESPAWN_DELAY: 1.5,
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
  DUMP:        {r:38, speed:[95,142],  col:"#FF2A2A", label:"DUMP",  w:2.3, h:0.7, trailFX:"ember"},
  WICK:        {r:9,  speed:[361,482], col:"#FF5A5A", label:"WICK",  w:0.35,h:3.4, trailFX:"jagged"},
  LIQUIDATION: {r:17, speed:[129,163], col:"#FF3D6E", label:"LIQ",   w:1,   h:1,   trailFX:"lockring"},
  FAKEOUT:     {r:21, speed:[163,206], col:"#C42BFF", label:"FAKE",  w:1.2, h:1.2, trailFX:"breathe"},
  WHALE:       {r:66, speed:[45,62],   col:"#8A1020", label:"WHALE", w:1.6, h:1.1, trailFX:"vortex"}
};

export const rnd   = (a,b)=>a+Math.random()*(b-a);
export const rint  = (a,b)=>Math.floor(rnd(a,b+1));
export const clamp = (v,a,b)=>v<a?a:v>b?b:v;
export const lerp  = (a,b,t)=>a+(b-a)*t;
export const pick  = arr=>arr[(Math.random()*arr.length)|0];
export const TAU   = Math.PI*2;

export function shadeColor(hex, pct){
  const num = parseInt(hex.slice(1),16);
  const amt = Math.round(255*pct);
  let r = clamp((num>>16)+amt, 0, 255);
  let g = clamp(((num>>8)&0xFF)+amt, 0, 255);
  let b = clamp((num&0xFF)+amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
