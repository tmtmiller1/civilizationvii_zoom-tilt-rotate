# Contributing

"Zoom, Tilt, & Rotate" changes how the camera moves and nothing else. Keep it that way.

## Ground rules

- The game's own controls keep working as they did: the wheel, trackpad, gamepad and pinch still zoom, and Alt
  (Option on a Mac) with a drag still peeks around and swings back to north. The mod extends them past the game's
  limits and adds its own keys alongside.
- The camera controller's two zoom handlers are the mod's own, and its input handler keeps back the wheel events with
  no movement in them and takes the direct pinch itself. Every other wrapped engine call calls through to the
  original: `Camera.panFocus`, `Camera.setPreventMouseCameraZoom`, `Camera.restoreDefaults`, `Camera.setTilt`,
  `Camera.setVerticalFoV`, the controller's rotate handler, `CityZoomer`, and the resource layer's two sprite grids.
- Read the shared settings store once and again only when a setting changes, never per wheel event, key press or
  frame. A read costs several milliseconds.
- Your saves aren't touched: settings live in the shared `modSettings` store, and the gameplay database is left as it
  is.
- The mod id `tmt-zoom-tilt-rotate`, the `LOC_ZOOM_TILT_ROTATE_*` tags, the option ids and the settings keys are what
  players' saved choices and the import paths hang on. Leave them as they are.

## Layout

- `ui/zoom-tilt-rotate.js` replaces the camera controller's zoom handlers, applies the lens and tilt past each limit,
  scales panning to the lens, and answers the commands the keys and the panel send.
- `ui/zoom-tilt-rotate-view.js` holds the angle and heading: easing to them, tap to step, hold to glide, and putting them
  back when the game resets the camera. Only `zoom-tilt-rotate.js` imports it.
- `ui/zoom-tilt-rotate-icons.js` gives each of the resource layer's two sprite grids a twin drawn in the world, and
  shows the twins instead while the mod holds the camera at its own angle. It wraps `Camera.setTilt`,
  `Camera.setVerticalFoV` and `Camera.restoreDefaults` to follow the tilt and the lens. Only `zoom-tilt-rotate.js`
  imports it.
- `ui/zoom-tilt-rotate-keys.js` turns the camera keys into commands.
- `ui/zoom-tilt-rotate-panel.js` draws the camera button by the minimap, the camera panel and the dials on screen.
- `ui/zoom-tilt-rotate-settings.js` holds the player's choices, the default keys and the shared text lookup; it has no
  engine objects, so the tests import it.
- `ui/zoom-tilt-rotate-options.js` adds the rows in Options > Add-ons, and `ui/zoom-tilt-rotate-keys-editor.js` is the
  Camera keys window.
- `ui/settings-keeper.js` is the Tower Settings Keeper file, copied unchanged; it is linted and tested in its own repo.
- `zoom-tilt-rotate.modinfo` loads the options in the shell and game scopes and the camera scripts in the game.
- `text/` holds the text: the English in `en_us/ModText.xml` and eleven languages beside it. `text/README.md` says
  how to translate. `icons/` holds the button glyphs and the dial pieces.
- `tests/`, `eslint.config.js` and `package.json` are the dev gate; `npm run verify` runs lint, a syntax check, the
  unit tests and the check that every language file matches the English. The camera tests load the shipped scripts
  as they are, against a stand-in camera, window and clock in `tests/camera-harness.mjs`; `tests/loader.mjs` points
  the game's modules at the stand-ins in `tests/stubs/`. They drive the scripts the way the game does, with wheel
  events, commands and Camera calls, so they don't depend on how the code is split between files.
- `devtools/` holds the in-game checks, run through Tower Bench with `devtools/run.sh` (see the README).
- `docs/how-it-works.md` explains the engine's behaviour the mod works around, and `docs/hardware-checklist.md` is
  the list of checks on real devices to run by hand.

## Making room in zoom-tilt-rotate.js

The lint gate allows 500 lines of code a file, not counting blank lines and comments. `ui/zoom-tilt-rotate.js` is at
477 and `ui/zoom-tilt-rotate-panel.js` at 492, so anything sizeable, such as a fix for the trackpad pinch or something
for the game's reveal cinematics, needs room made first. Make it as a change of its own that only moves code: function
bodies stay as they are, the gate stays at error, and the camera tests pass unchanged before and after.

1. `ui/zoom-tilt-rotate-lens.js`, about 28 lines: the lens arithmetic and the field-of-view measurement. That's
   `GAME_FIELD_OF_VIEW`, `CLOSE_UP`, `FAR_OUT`, `BASE_ZOOM_RATE`, `clamp`, `blend`, `halfTan`, `closeUpFieldOfView`,
   `closeUpShare` and `measureFieldOfView`, with the comment above the constants. None of it keeps any state.
2. `ui/zoom-tilt-rotate-input.js`, about 25 lines: what a zoom input is worth. That's `zoomAmountFor` with the
   held-trigger constants and state it uses, and `isScrollWithoutMovement`. If the pinch turns out to need its own
   reading of an event, that goes here too.
3. `ui/zoom-tilt-rotate-commands.js`, about 49 lines: the `zoom-tilt-rotate-command` listener, `COMMANDS`,
   `VIEW_MOVES`, `moveView`, and the zoom buttons' tap and hold (`ZOOM_REPEAT_MS`, `zoomHold`, `holdZoom`,
   `zoomButton`). Nothing may import `zoom-tilt-rotate.js`, which wraps the camera and must only run once, so that
   script hands over `goToZoom`, `stepZoom`, `backToNormal` and `announceView` in one call at its end, the way
   `onViewMoved` hands the view its announcer. `stepZoom` and `backToNormal` stay where they are.

That leaves `zoom-tilt-rotate.js` at about 386 lines, holding the zoom's state and everything that changes it: the
engine zoom and the lens waits, the game-move watcher, the controller's handlers, the city screens and the
announcements. A pinch fix lands in its `handleInput` replacement, next to the zero-distance wheel filter, and calls
into `zoom-tilt-rotate-input.js` for anything longer than a line or two. List each new file under `ImportFiles` in the
modinfo's game scope, the way `zoom-tilt-rotate-view.js` is listed. Only `zoom-tilt-rotate.js` imports them, so they
stay out of `UIScripts`.

The split was tried on a copy on 2026-10-15: lint passed at error, all 43 tests passed without a change, and the line
counts above come from that run.

If the panel needs room later, the seam is its controls: `slider`, `dragOn` and the three dials, about 110 lines. The
dials read the panel's `view`, so it would have to be handed over too.
