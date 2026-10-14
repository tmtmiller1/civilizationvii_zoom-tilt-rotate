# Contributing

"Zoom, Tilt, & Rotate" changes how the camera moves and nothing else. Keep it that way.

## Ground rules

- The game's own controls keep working as they did: the wheel, trackpad, gamepad and pinch still zoom, and Alt
  (Option on a Mac) with a drag still peeks around and swings back to north. The mod extends them past the game's
  limits and adds its own keys alongside.
- Every wrapped engine call (`Camera.panFocus`, `Camera.setPreventMouseCameraZoom`, `Camera.restoreDefaults`, the
  camera controller's zoom, rotate and input handlers, `CityZoomer`) calls through to the original.
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
  unit tests and the check that every language file matches the English.
- `devtools/` holds the in-game checks, run through Tower Bench with `devtools/run.sh` (see the README).
- `docs/how-it-works.md` explains the engine's behaviour the mod works around.
