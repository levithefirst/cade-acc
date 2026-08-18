/*
  CADE OPS — THE 6 NERFS

  Adds:
  1. A character page between HOW TO PLAY and the game.
  2. Clickable X profiles for all six characters.
  3. The six team leaders actively hunting the player during runs.

  Existing game systems remain responsible for:
  - spawning
  - collisions
  - nerfing
  - scoring
  - lives
  - respawning
*/

import { Game } from "./main.js";
import { Teams, TEAM_ROSTER } from "./teams.js";
import { Player } from "./player.js";
import { CFG } from "./config.js";

const nerfsScreen = document.getElementById("scNerfs");
const nerfsGrid = document.getElementById("nerfsGrid");
const howToPlay = document.getElementById("scHowToPlay");

if (!nerfsScreen || !nerfsGrid) {
  console.warn("CADE OPS: THE 6 NERFS screen was not found.");
} else {

  const X_HANDLES = {
    steve: "steoniy",
    gnar: "gnarzill",
    kosgood: "kosgoood",
    scotty: "scottybmitchell",
    rookmate: "0xRookmate",
    poppunk: "PopPunkOnChain"
  };

  /*
    PAGE STYLING
    Uses the same Bungee font and visual language already loaded
    by the main CADE OPS page.
  */

  const style = document.createElement("style");

  style.textContent = `
    #scNerfs {
      position: fixed;
      inset: 0;
      z-index: 20;

      box-sizing: border-box;

      padding:
        calc(24px + env(safe-area-inset-top))
        16px
        calc(20px + env(safe-area-inset-bottom));

      overflow-y: auto;
      overflow-x: hidden;

      align-items: center;
      justify-content: flex-start;

      background:
        radial-gradient(
          circle at 50% 20%,
          rgba(255,168,0,.16),
          transparent 45%
        ),
        linear-gradient(
          180deg,
          rgba(10,10,10,.97),
          rgba(18,18,18,.99)
        );
    }

    #scNerfs .eyebrow {
      margin-top: 4px;
    }

    .nerfs-heading {
      margin-top: 4px;

      text-shadow:
        0 0 18px rgba(255,168,0,.28),
        0 0 40px rgba(255,168,0,.12);
    }

    .nerfs-subtitle {
      margin-top: 5px;
      margin-bottom: 18px;
      text-align: center;
    }

    .nerfs-grid {
      width: min(100%, 720px);

      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));

      gap: 10px;
    }

    .nerf-card {
      position: relative;

      min-width: 0;

      padding: 9px;

      border-radius: 17px;

      background:
        linear-gradient(
          145deg,
          rgba(255,255,255,.10),
          rgba(255,255,255,.025)
        );

      border: 1px solid rgba(255,255,255,.11);

      box-shadow:
        0 14px 30px rgba(0,0,0,.30),
        inset 0 1px 0 rgba(255,255,255,.08);

      overflow: hidden;

      text-align: center;

      transition:
        transform .18s ease,
        border-color .18s ease;
    }

    .nerf-card::before {
      content: "";

      position: absolute;

      left: 0;
      top: 0;
      bottom: 0;

      width: 3px;

      background: var(--nerf-accent);

      box-shadow:
        0 0 15px var(--nerf-accent);
    }

    .nerf-card:active {
      transform: scale(.97);
    }

    .nerf-portrait {
      display: block;

      width: 100%;
      height: 118px;

      border-radius: 12px;

      background:
        radial-gradient(
          circle at 50% 45%,
          rgba(255,168,0,.18),
          rgba(0,0,0,.20) 70%
        );
    }

    .nerf-name {
      display: block;

      margin-top: 8px;

      color: #fff;

      font-family:
        Bungee,
        Arial Black,
        Impact,
        sans-serif;

      font-size: 14px;
      line-height: 1.15;

      text-decoration: none;
    }

    .nerf-name:hover,
    .nerf-name:focus {
      color: #ffa800;
    }

    .nerf-x {
      display: block;

      margin-top: 5px;

      color: rgba(255,255,255,.52);

      font-family:
        ui-monospace,
        SFMono-Regular,
        Menlo,
        monospace;

      font-size: 8px;
      font-weight: 700;

      text-decoration: none;

      overflow-wrap: anywhere;
    }

    .nerf-x:hover,
    .nerf-x:focus {
      color: #ffa800;
    }

    .nerf-label {
      margin-top: 7px;

      color: rgba(255,255,255,.34);

      font-family:
        ui-monospace,
        SFMono-Regular,
        Menlo,
        monospace;

      font-size: 7px;
      font-weight: 700;

      letter-spacing: .08em;
    }

    .nerfs-actions {
      margin-top: 16px;
      padding-bottom: 4px;
    }

    @media (max-height: 700px) {

      #scNerfs {
        padding-top: 14px;
      }

      .nerfs-subtitle {
        margin-bottom: 9px;
      }

      .nerf-portrait {
        height: 92px;
      }

      .nerf-card {
        padding: 7px;
      }

      .nerfs-actions {
        margin-top: 10px;
      }
    }

    @media (min-width: 700px) {

      .nerfs-grid {
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
      }

      .nerf-portrait {
        height: 150px;
      }
    }
  `;

  document.head.appendChild(style);


  function showScreen(screen) {

    document
      .querySelectorAll(".screen")
      .forEach(s => {
        s.classList.remove("on");
        s.classList.remove("first-in");
      });

    screen.classList.add("on");
    screen.classList.add("first-in");

    screen.scrollTop = 0;
  }


  /*
    Render each existing game character into a portrait canvas.
    This keeps the page synchronized with the actual in-game roster.
  */

  function drawPortrait(canvas, roster) {

    if (!roster || !canvas) return;

    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );

    const width =
      canvas.clientWidth || 280;

    const height =
      canvas.clientHeight || 118;

    canvas.width =
      width * dpr;

    canvas.height =
      height * dpr;

    const ctx =
      canvas.getContext("2d");

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    const bg =
      ctx.createLinearGradient(
        0,
        0,
        0,
        height
      );

    bg.addColorStop(
      0,
      "rgba(255,168,0,.12)"
    );

    bg.addColorStop(
      1,
      "rgba(0,0,0,.24)"
    );

    ctx.fillStyle = bg;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );


    ctx.save();

    ctx.translate(
      width / 2,
      height * .67
    );

    const scale =
      Math.min(
        1.45,
        height / 92
      );

    ctx.scale(
      scale,
      scale
    );


    const fakeTeam = {
      disabled: false,
      age: 1,
      exposed: false
    };


    roster.draw(
      ctx,
      fakeTeam,
      1
    );

    ctx.restore();


    const glow =
      ctx.createLinearGradient(
        0,
        height * .65,
        0,
        height
      );

    glow.addColorStop(
      0,
      "rgba(255,168,0,0)"
    );

    glow.addColorStop(
      1,
      "rgba(255,168,0,.10)"
    );

    ctx.fillStyle = glow;

    ctx.fillRect(
      0,
      height * .65,
      width,
      height * .35
    );
  }


  function renderRoster() {

    if (
      !TEAM_ROSTER ||
      !TEAM_ROSTER.length
    ) {
      console.warn(
        "CADE OPS: TEAM_ROSTER unavailable."
      );

      return;
    }


    nerfsGrid.innerHTML = "";


    TEAM_ROSTER
      .slice(0, 6)
      .forEach((roster, index) => {

        let handle =
          X_HANDLES[roster.id];


        if (!handle) {
          handle =
            String(roster.name || "")
              .replace(/\s+/g, "");
        }


        const card =
          document.createElement("article");

        card.className =
          "nerf-card";

        card.style.setProperty(
          "--nerf-accent",
          roster.accent || "#ffa800"
        );


        const portrait =
          document.createElement("canvas");

        portrait.className =
          "nerf-portrait";

        portrait.setAttribute(
          "aria-label",
          roster.name
        );


        const name =
          document.createElement("a");

        name.className =
          "nerf-name";

        name.textContent =
          roster.name;

        name.href =
          `https://x.com/${handle}`;

        name.target =
          "_blank";

        name.rel =
          "noopener noreferrer";


        const x =
          document.createElement("a");

        x.className =
          "nerf-x";

        x.textContent =
          `x.com/${handle}`;

        x.href =
          `https://x.com/${handle}`;

        x.target =
          "_blank";

        x.rel =
          "noopener noreferrer";


        const label =
          document.createElement("div");

        label.className =
          "nerf-label";

        label.textContent =
          `NERF TARGET · ${String(index + 1).padStart(2, "0")}`;


        card.appendChild(
          portrait
        );

        card.appendChild(
          name
        );

        card.appendChild(
          x
        );

        card.appendChild(
          label
        );


        nerfsGrid.appendChild(
          card
        );


        drawPortrait(
          portrait,
          roster
        );
      });
  }


  renderRoster();


  /*
    HOW TO PLAY → THE 6 NERFS
  */

  const howButton =
    document.getElementById(
      "btnHowToPlayBack"
    );

  if (howButton) {

    howButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        event.stopImmediatePropagation();

        showScreen(
          nerfsScreen
        );
      },
      true
    );
  }


  /*
    THE 6 NERFS → HOW TO PLAY
  */

  const backButton =
    document.getElementById(
      "btnNerfsBack"
    );

  if (backButton) {

    backButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        showScreen(
          howToPlay
        );
      }
    );
  }


  /*
    THE 6 NERFS → GAME
  */

  const startButton =
    document.getElementById(
      "btnNerfsStart"
    );

  if (startButton) {

    startButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        const originalStart =
          document.getElementById(
            "btnStart"
          );

        if (originalStart) {
          originalStart.click();
        }
      }
    );
  }


  /*
    ============================================================
    HUNTER AI
    ============================================================

    The existing Teams.update() still handles:
    - roaming
    - pump seeking
    - collisions
    - nerfing
    - respawning

    This adds a steering force toward the player so
    all six characters actively hunt from the beginning.
  */

  const originalTeamsUpdate =
    Teams.update.bind(Teams);


  Teams.update =
    function hunterTeamsUpdate(dt) {

      originalTeamsUpdate(dt);


      if (Game.scene !== "play") {
        return;
      }


      const arenaWidth =
        window.innerWidth;

      const arenaHeight =
        window.innerHeight;


      for (const team of this.pool) {

        if (
          !team.on ||
          team.disabled
        ) {
          continue;
        }


        const dx =
          Player.x -
          team.x;

        const dy =
          Player.y -
          team.y;

        const distance =
          Math.hypot(
            dx,
            dy
          ) || 1;


        /*
          Leave a small reaction window.
        */

        if (
          distance <
          team.r + 32
        ) {
          continue;
        }


        const baseSpeed =
          CFG.TEAM_SPEED[1] || 100;

        const hunterSpeed =
          baseSpeed * 1.08;


        const targetVX =
          (dx / distance) *
          hunterSpeed;

        const targetVY =
          (dy / distance) *
          hunterSpeed;


        const steering =
          Math.min(
            1,
            dt * 2.2
          );


        team.vx +=
          (
            targetVX -
            team.vx
          ) *
          steering;


        team.vy +=
          (
            targetVY -
            team.vy
          ) *
          steering;


        /*
          Small additional movement.
        */

        team.x +=
          team.vx *
          dt *
          0.20;

        team.y +=
          team.vy *
          dt *
          0.20;


        /*
          Keep them inside the arena.
        */

        team.x =
          Math.max(
            team.r,
            Math.min(
              arenaWidth - team.r,
              team.x
            )
          );


        team.y =
          Math.max(
            team.r,
            Math.min(
              arenaHeight - team.r,
              team.y
            )
          );


        team.state =
          "chase";
      }
    };
}
