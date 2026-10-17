# How Zoom, Tilt, & Rotate works

The game's camera zooms from 0 (closest) to 1 (farthest). The mod keeps its own zoom value that runs past both ends
and, beyond them, changes the camera's field of view (and, going out, its tilt) instead of the zoom.

`ui/zoom-tilt-rotate.js` replaces the camera controller's zoom handlers, and `ui/zoom-tilt-rotate-view.js` owns the
angle and heading. `ui/zoom-tilt-rotate-icons.js` draws the resource icons in the world while the mod holds the camera
at its own angle; it follows the tilt and the lens through `Camera.setTilt`, `Camera.setVerticalFoV` and
`Camera.restoreDefaults`, which it wraps. `ui/zoom-tilt-rotate-keys.js` reads the camera keys and
`ui/zoom-tilt-rotate-panel.js` draws the camera panel; both send commands to `zoom-tilt-rotate.js` as window events.
`ui/zoom-tilt-rotate-settings.js` keeps the player's choices, and `ui/zoom-tilt-rotate-options.js` with
`ui/zoom-tilt-rotate-keys-editor.js` are the Options rows and the key editor.

## What the engine allows, and how the mod works with it

- The camera has no way to read its field of view, so the mod measures it from where two points on the screen land
  on the map. That keeps it right when something else resets the camera.
- Setting the field of view cancels a zoom that is still moving, so the lens past a limit is applied only once the
  zoom has reached that limit.
- A trackpad sends wheel events with no movement in them when the fingers land, rest or lift, and at the end of its
  momentum. The game reports every one as a scroll down, whichever way you were scrolling. Any real movement, even a
  fraction of a line from a wheel or a trackpad, arrives with a distance of at least 1 in its own direction, so the
  mod ignores every event with no distance.
- Inside its range the engine zooms on the wheel by itself as well as passing the event on. Past a limit that would
  raise the camera and widen the lens on the same notch, so while the lens is past a limit the mod holds the
  engine's own wheel zoom off (`Camera.setPreventMouseCameraZoom`), alongside any view where the game holds it off.
  The engine keeps that switch through a UI reload (an age transition, among others), so the mod sets it back to off
  when it loads.
- The engine won't take a field of view under 1 degree or over 120. Anything past those is clamped, and every value
  in between holds until something changes it. Past 90 degrees, looking straight down, most of the screen is off the
  edge of the map, so the far end stops at 90.
- `Camera.setTilt(angle, 1)` takes 0 to 80 degrees from straight down, and `Camera.rotate(heading, true)` turns the
  view and holds it; `Camera.getState()` reports both, so every ease starts from what's on screen. Both jump straight
  to the new value, so the mod eases them itself. `Camera.restoreDefaults()` (closing the place-building or buy-tile
  screen, among others) drops the lens at once and starts the engine swinging the heading to north and the tilt
  weight to 0 over about half a second, the same swing as `Camera.rotate(0, false)`. A `Camera.rotate(heading, true)`
  in the same frame stops the swing before it shows, so the mod holds the heading there and then eases the tilt back.
  Waiting a frame and easing from what the camera reports races that swing: a read taken before it moved looks like
  "already there", and the camera then turns all the way to north; a read taken later eases back from part-way, a
  visible wobble. The place-building screen's own framing (a `Camera.addKeyframe` with `FLAG_ALL`) leaves the heading
  alone; `KeyframeFlag` has no rotation bit.
- Keyboard, edge and gamepad panning move along the map, not the screen, so the mod turns each pan step by the
  heading. The step is also scaled by tan(fov / 2), which keeps a held arrow key moving the same share of the screen
  at any lens: about 1.56 screens per half second near the ground and 0.8 to 1.0 far out, against the game's own
  1.56 and 0.80. The map wraps east to west, so a pan measured from start to end reads wrong once it crosses the
  seam; the in-game checks add up the movement frame by frame.
- The game draws resource icons at one size on screen wherever their tile is (`SpriteMode.FixedBillboard`), and
  yield icons in the world (`SpriteMode.Billboard`), so yields shrink with distance and resources don't. Its
  city-growth lens draws resource icons in the world too, at scale 1 for the resource layer's 42 pixels and with
  offsets scaled by 16/42. `ui/zoom-tilt-rotate-icons.js` gives each of the resource layer's two sprite grids a twin
  drawn that way: every call the layer makes reaches both, and only one is shown. The game never tilts the camera
  itself, so whenever the tilt weight is above 0 the world twin shows, sized each frame to 0.00085 times the distance
  from the camera to the middle of the screen, times the lens's tan(fov / 2) over the game's. That keeps the icon in
  the middle of the screen at the game's size. The 0.00085 was measured in game by matching the two side by side.
- The game's page never sets the modifier flags on a key event, but the modifier keys arrive as key events of their
  own, so the mod tracks which are held. The game ignores the arrow keys while a modifier is held.
- The game frames a city screen from the lens that's on screen, and a lens change takes a moment to ease in. So when
  a city screen opens from past a limit, the mod puts the game's lens back first and lets the game frame the city
  once it has.
- The game doesn't announce its own camera moves. While the lens is past a limit, the mod checks the zoom ten times
  a second and drops its lens when the game has moved the camera to a different zoom.
- The shared settings store holds every mod's settings and runs to half a megabyte or more, so the mod reads it once
  and again only when a setting changes, never on a zoom or a key press.
