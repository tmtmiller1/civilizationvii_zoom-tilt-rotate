# Better Zoom In / Zoom Out

A Civilization VII mod. Zoom closer and farther than the game allows. Keep scrolling in past the game's closest
view and the camera narrows its lens until a single unit fills the screen; keep scrolling out past the farthest view
and it widens and turns to look straight down, until most of the map fits on one screen.

Each end adds six notches of zoom. Scrolling back the other way returns to the game's own view, one notch at a time.

---

## What the player does

Zoom the way you already do: the mouse wheel, a two-finger scroll on a trackpad, the gamepad triggers, or a pinch
on a touch screen. Nothing to set up.

- **Zooming in past the limit** narrows the field of view from the game's 35 degrees down to 5, about seven times
  closer than the game's closest view. Unit models hold up all the way in.
- **Zooming out past the limit** widens the field of view to 90 degrees while the camera turns to look straight
  down, so you see the map rather than the sky and the horizon.
- **Panning** with the keyboard, the screen edge or a gamepad slows down as you zoom in, so each step moves the
  same share of the screen at any zoom. Dragging the map with the mouse keeps the ground under the cursor, as it
  always has.
- **A trackpad scroll stops where you stop.** The view follows the camera instead of racing ahead of it, and it does
  not spring back out after a zoom in.
- **City screens.** Buying a tile or placing a building frames the city as usual. When you close the screen the
  view goes back to where you had it, even past the limit.
- **The game moving the camera** (a notification, selecting a unit) is fine: the next zoom picks up from wherever
  the camera ended up.

## Install

Copy `better-zoom.modinfo`, `text/` and `ui/` into a folder in the game's `Mods` directory, then enable Better Zoom
In / Zoom Out in the game's mod settings. It changes nothing in a save, so it can be turned on or off at any time.

Made for Civilization VII 1.5.0.

## Known limits

- Tested with a Mac trackpad, mouse drag, and the game's own input events for the gamepad and touch. Not yet tried
  with a physical mouse wheel, a real gamepad or a touch screen.
- On a Mac trackpad, zoom with a two-finger scroll. Pinching has not been seen to zoom the game.
- A notch sent in the first moment of one of the game's own camera moves can cut that move short, as in the
  unmodded game.

## How it works

The game's camera zooms from 0 (closest) to 1 (farthest). The mod keeps its own zoom value that runs past both ends
and, beyond them, changes the camera's field of view (and, going out, its tilt) instead of the zoom. All of it is
in `ui/better-zoom.js`, a UI script that replaces the camera controller's zoom handlers.

A few things about the engine that shaped it:

- The camera has no way to read its field of view, so the mod measures it from where two points on the screen land
  on the map. That keeps it right when something else resets the camera.
- Setting the field of view cancels a zoom that is still moving, so the lens past a limit is applied only once the
  zoom has reached that limit.
- A trackpad scroll ends in a run of wheel events with no movement in them, and the game reports each as a scroll
  down. The mod ignores those for a second after a real scroll event.
- `Camera.getState()` reports the zoom as it eases toward its target, so the mod steps from the zoom it asked for,
  not from what the camera shows mid-move.

## Development

`devtools/` holds the tests. Each one runs inside a running game through Tower Bench's `eval`, so they need the game
running with its UI debugger on port 9444, Tower Bench at `../../tools/tower-bench`, and a game with a founded
capital that has a population point waiting to be placed:

```
devtools/run.sh devtools/full-range.js
devtools/run.sh devtools/fast-notches.js
devtools/run.sh devtools/trackpad-stream.js
devtools/run.sh devtools/trackpad-tail.js
devtools/run.sh devtools/camera-move-and-city-screens.js
devtools/run.sh devtools/panning-and-lens-reset.js
devtools/run.sh devtools/gamepad-trigger.js
devtools/run.sh devtools/touch-pinch.js
devtools/run.sh devtools/reload-part-1.js   # then, once the UI is back:
devtools/run.sh devtools/reload-part-2.js
```

`trackpad-tail.js` replays `gesture-zoom-in.json`, a zoom-in recorded from a Mac trackpad. `recorder.js` logs input
and camera state while you test by hand, and `inject.mjs` turns the UI script into something you can paste into a
running game to try an edit without restarting.

## License

MIT. See [LICENSE](LICENSE).
