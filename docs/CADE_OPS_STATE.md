# CADE OPS State

Documentation-only project memory. This file is never imported or bundled. Runtime source remains the code in `js/`, `css/`, `index.html`, and `assets/`.

## Architecture
- Static HTML + ES modules. No framework and no router library.
- `js/main.js` owns the central game state, canvas, simulation loop, input, and theme.
- `js/ui.js` owns HUD drawing, screen switching, results flow, and title presentation.
- `js/teams.js` owns the six in-game team identities and their gameplay silhouettes.
- `js/combat-ai.js` owns the six combat profiles and projectile behavior.
- `js/nerfs-page.js` owns the NERFS page roster records, individual portrait cards, carousel, and page-specific styling.
- `js/ux-improvements.js` adds the small navigation/history layer, character dossier, Home→NERFS access, game-over leaderboard access, and gameplay pause UI without introducing a router or duplicate roster.
- `js/burst.js` imports the UX layer and explicitly freezes its own animation state while `Game.paused` is true.

## Screen system
- Screens are DOM containers in `index.html`, switched through the existing `show()` helper in `js/ui.js`.
- `#scTitle` is Home, `#scHowToPlay` is the onboarding screen, `#scNerfs` is the six-character carousel, `#scLeaderboard` is the existing leaderboard, and `#scEnd` is the results screen.
- `js/ux-improvements.js` observes the existing screen classes and keeps a small contextual history stack. Back therefore returns to the screen that actually opened NERFS or the leaderboard instead of assuming Home.
- Home remains a root screen with no Back control.

## Character assets and NERFS page
- The NERFS page uses six separate local portrait files under `assets/nerfs/`.
- Current portrait files are `steve.jpg`, `gnar.jpg`, `kosgood.jpg`, `scotty.jpg`, `rookmate.jpg`, and `poppunk.jpg`.
- `js/nerfs-page.js` remains the single source for the NERFS page's handle, weapon, accent, and portrait path records.
- The character dossier does not create another character roster. It reads the rendered NERFS card for handle, weapon, accent, and image, then joins that existing identity with the authoritative `TEAM_ROSTER` and `COMBAT` records for personality and combat type/profile.
- The dossier is a native modal `<dialog>` with previous/next controls, mobile swipe, keyboard arrows, Escape, focus restoration, and reduced-motion handling.
- No RPG levels, XP, rarity, inventory, equipment, or invented stats are used.

## Gameplay pause
- `Game.paused` is the authoritative pause flag added by `js/ux-improvements.js` around the existing `Game.update()` entry point.
- While paused, the existing simulation update is not called. This freezes the timer, player, teams, rugs, pumps, collisions, projectiles, multiplier decay, dash/burst state, gameplay particles, and other simulation-dependent updates.
- `js/burst.js` also checks `Game.paused` before advancing its own charge-lock/pulse animation frame so Burst state cannot continue changing behind the pause overlay.
- The arena remains rendered behind a dark scrim. The pause UI contains Resume, Restart, and Exit to Home.
- Escape pauses during play and resumes while paused. The pause control is separated from the bottom combat controls.

## Navigation additions
- Home has a compact `Nerfs` button alongside the existing leaderboard control.
- NERFS retains its existing horizontal carousel and Back/Let's Cade controls.
- The active NERFS card opens the character dossier. Its active state remains selected when the dossier closes.
- Game Over keeps Run It Back as the primary action and now gets Leaderboard + Home as a compact secondary navigation row.
- Existing leaderboard functionality and backend remain unchanged.

## Accessibility and responsive behavior
- New utility controls use approximately 48px touch targets.
- Dossier cards expose the active character as a keyboard control. Enter/Space opens it; left/right changes characters; Escape closes it; focus returns to the triggering card.
- Native `<dialog>` provides modal inertness and baseline focus behavior.
- Pause uses a contained keyboard focus cycle, visible focus styles, and touch-friendly controls.
- Dossier and pause transitions respect `prefers-reduced-motion`.
- Dossier layout gives the artwork the dominant share of the viewport on desktop and mobile, with a compact information panel rather than RPG-style stat screens.

## Rendering and asset contracts
- `#cv` remains the gameplay canvas.
- `#roster-showcase` remains the decorative title canvas and its lifecycle remains owned by `js/main.js`.
- Runtime NERFS images are local repository assets. No remote avatar source or image-generation pipeline is required by the current architecture.
- Do not reintroduce the obsolete six-frame sprite-sheet architecture into the NERFS page.

## Gameplay contracts
- Preserve the 60-second run, six lives, dash, Burst, pumps, rugs, multiplier, scoring, combat AI, projectiles, leaderboard backend, identity system, sound system, and theme system.
- Pause must gate the existing update loop rather than hiding the canvas while simulation continues.
- The six identities, handles, weapons, and combat behavior remain unchanged.

## Verification notes
- The repository is a static site with no package/build step in the current tree.
- The implementation should be validated against the actual page at phone and desktop viewport sizes, with mouse, keyboard, touch, and reduced-motion settings.
- Production access was not assumed during this implementation. Final browser verification should use the deployed page when network access is available.
