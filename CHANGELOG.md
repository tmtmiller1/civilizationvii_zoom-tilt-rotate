# Changelog

All notable changes to Zoom, Tilt, & Rotate are documented here. This project follows semantic versioning.

## [1.1.2] - 2026-10-17

- License: from this version the mod is under the Tower Mod License 1.0, in LICENSE. You can still play it, read the
  code and change your own copy for your own games. Reuploading it, reusing its code in other projects and using it
  to train AI need my written permission. Earlier versions stay under MIT, and `ui/settings-keeper.js` stays MIT so
  other mods can keep embedding it.
- Carries Civilopedia History Corrections. With Civilopedia Expanded: Independents on, six East Asian history pages
  in the Civilopedia (Goguryeo, the Oirat, two Ryukyu pages, Nanzhao and Balhae) give each side where historians in
  different countries disagree, and a few factual errors are fixed. With it off, the game's pages stay as they are.

## [1.1.1] - 2026-10-16

- Closing the building-placement or buy-tile screen no longer swings the camera to north and back. With the view
  turned, say to face south, the heading now stays put through the screen opening and closing, and so do a tipped
  angle and the close-up. Reported by a player who saw a half turn and a spin back on every building.

## [1.1.0] - 2026-10-15

- Tipped toward the horizon, the resource icons now get smaller with distance instead of piling up along the far
  edge of the map. They're drawn the way the game draws them in its city-growth lens, and the ones in the middle of
  the screen keep the game's size. At the game's own angle nothing changes.
- The camera panel has the minimap's Resources and Yields checkboxes. They switch the same layers as the minimap and
  the game's hotkeys, so all three always agree.

## [1.0.1] - 2026-10-14

- The license now says that Civilization VII and its art and data belong to Firaxis and 2K. The mod itself plays
  exactly as in 1.0.0.

## [1.0.0] - 2026-10-14

- First version. Zoom goes six notches past each end of the game's range: in to a close-up, and out until the camera
  looks straight down over most of the map.
- "How close you can zoom in" in Options > Add-ons: Closer (7x) stops at a 5 degree lens, Much closer (18x) at 2
  degrees, and All the way (36x) at 1 degree, as far as the game's camera allows. Each close-up notch magnifies by the
  same amount. A change applies straight away and it's kept between games.
- The mouse wheel, a trackpad's two-finger scroll, gamepad triggers and touch pinch all move the view at an even pace,
  a trackpad scroll stops where you stop, and scrolling back from past a limit steps the lens back one notch at a
  time.
- Tip the camera anywhere from straight down to nearly level with the horizon, and turn the view to face any
  direction. A tap moves one step onto a round number; holding glides and stops where you let go. Turn step and
  angle step settings are in Options > Add-ons. Back to normal returns to north, the game's own angle and the game's
  zoom range in one go.
- Out of the box the keys are Shift with the arrow keys, 0 and C. Change them in Options > Add-ons > Zoom, Tilt, &
  Rotate > Camera keys.
- A camera panel next to the minimap: a zoom gauge, a compass and an angle gauge, buttons to step or keep going, dials
  and sliders you can drag to set any zoom, heading or angle directly, Back to normal, and your keys. It opens from a
  camera button by the minimap's lens button, or with Shift + C.
- Optional dials on screen at the top left: the zoom gauge, compass and angle gauge, draggable, on a see-through
  backing.
- Keyboard, screen-edge and gamepad panning keep the same pace on screen at any zoom, and follow the screen when the
  view is turned.
- The view keeps its zoom, angle and heading through the buy-tile and place-building screens, and those screens
  frame the city the way the game does even when opened from a close-up. When the game moves the camera to a new
  zoom, its own lens comes back as the camera arrives.
- In English, German, Spanish, French, Italian, Japanese, Korean, Polish, Portuguese (Brazil), Russian, and Chinese
  (Simplified and Traditional).
