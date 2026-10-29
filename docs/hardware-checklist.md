# Hardware checklist

Every in-game check so far ran on one Mac, with its trackpad and keyboard, in a 2880 x 1800 window. The mouse wheel
went in as wheel events posted through macOS, and the gamepad and touch screen as events sent through the game's input
handler, so all three still need trying on real devices. This is the list to run by hand. Each row says what to do and
what you should see; write what you actually saw in the Result column, starting with the run's letter.

## Runs

Add a row for each sitting.

| Run | Date | Device and OS | Game version | Screen and window | Other mods |
| --- | --- | --- | --- | --- | --- |
| A | | | | | |
| B | | | | | |

"Other mods" is either none (every other mod off) or the usual set. Do a device with none first.

## Before each run

- Load a game with a founded capital, then press Back to normal (Shift + 0) so the view starts at the game's own
  zoom, angle and north.
- In Options > Add-ons > Zoom, Tilt, & Rotate, leave "How close you can zoom in" at Closer (7x), the turn step at 45
  and the angle step at 10 unless a row says otherwise.
- On the Mac, the recorder can keep the raw input for you. With the game's UI debugger on port 9444, from
  `tools/tower-bench`:

  ```
  node tower-bench.mjs eval "$(cat ../../tower_mods/zoom-tilt-rotate/devtools/recorder.js)"
  # try the rows, then save what it kept:
  node tower-bench.mjs eval 'JSON.stringify(window.zoomRecording)' > ~/Desktop/ztr-<device>-<date>.json
  ```

  It keeps every input event the game sends (`raw`), the zoom, wheel and touch events that reach the camera
  (`zoomInputs`), the zoom, lens and tilt whenever they change (`samples`), and how far the map slipped under the
  cursor on each left-drag (`drags`). A UI reload clears it. Keep the files out of the repo and put the name in the
  Result column.

## Mouse wheel

| # | Do this | You should see | Result |
| --- | --- | --- | --- |
| W1 | One notch in, then one out, at the game's normal view | The game's own zoom step each way | |
| W2 | Keep scrolling in, one notch at a time, until it stops | Six notches past the game's closest view, each about the same jump, ending about 7 times closer. The close-up holds when you stop | |
| W3 | Scroll back out one notch at a time | The lens widens one notch per notch, rather than snapping back to the game's view | |
| W4 | Keep scrolling out past the game's farthest view | Six notches; the camera turns to look straight down and most of the map fits on screen | |
| W5 | A fast spin each way | The zoom stops soon after the wheel does | |
| W6 | With the recorder on, one notch each way, then look at `raw` | Each wheel event has a distance (5 or -5 so far). Note any wheel event with 0: the mod ignores those | |
| W7 | Spin the wheel out fast from the middle of the game's range, through the farthest view and on | The camera tips toward straight down along with the widening view, with no pause or step at each notch, and the two finish together | |
| W8 | Tick "Keep the angle when zoomed far out" in Options, then W7 again | The angle stays put the whole way out; the view widens and the map's far edge comes into view at the top, with no sky | |

## Trackpad pinch (Mac)

A two-finger scroll zooms; a pinch hasn't zoomed the game in testing. These rows say whether the game gets a pinch at
all.

| # | Do this | You should see | Result |
| --- | --- | --- | --- |
| P1 | Every mod off, including this one. Pinch out and in over the map, with the recorder on | Note whether the view zooms, and every event name in `raw` while you pinch | |
| P2 | This mod on, the same pinch | The same as P1. If P1 zoomed, this should zoom too, and on past the game's limits | |
| P3 | This mod on, a two-finger scroll in and out | Zooms, stops when your fingers stop, and lifting them doesn't zoom you back out | |

## Mouse drag

Drags posted through macOS never start the game's camera drag, so a drag at 90 degrees hasn't been watched yet.

| # | Do this | You should see | Result |
| --- | --- | --- | --- |
| D1 | All the way out (looking straight down), drag the map with the left button | The spot you grabbed stays under the cursor | |
| D2 | All the way in, the same drag | The same | |
| D3 | Turned to face east (Shift + Right twice) and tipped to about 60 degrees, the same drag | The same. With the recorder on, note each drag's `slipPercent` | |

## Gamepad

| # | Do this | You should see | Result |
| --- | --- | --- | --- |
| G1 | Hold the zoom-in trigger from the game's normal view | Zooms in about as fast as the game's own trigger, on into the close-up, and stops when you let go | |
| G2 | Half press the trigger | Slower than a full press | |
| G3 | Hold the zoom-out trigger past the game's farthest view | Carries on out and turns to look straight down | |
| G4 | Pan with the stick at the game's view, all the way in and all the way out | About the same speed across the screen each time | |
| G5 | Face east (Shift + Right twice), then push the stick up | The map moves up the screen, the way you're looking | |
| G6 | Turn the view with the game's own rotate control, then let go | It goes back to the heading you had set (north if you hadn't turned it) | |
| G7 | Reach the camera button by the minimap and the panel's buttons | Note whether you can, and whether a press steps the camera | |

## Touch screen

| # | Do this | You should see | Result |
| --- | --- | --- | --- |
| T1 | Pinch out and in at the game's normal view | The zoom follows your fingers | |
| T2 | Keep pinching in past the game's closest view | Goes on into the close-up | |
| T3 | Keep pinching out past the game's farthest view | Goes on out and turns to look straight down | |
| T4 | Lift your fingers | The view stays where you left it | |
| T5 | Drag the camera panel's dials and sliders with a finger | They follow your finger and set the camera | |

## Windows

| # | Do this | You should see | Result |
| --- | --- | --- | --- |
| X1 | Subscribe on the Workshop, start a game, open Options > Add-ons | The mod's rows, in the game's language | |
| X2 | Run the mouse wheel rows (W1 to W5) | As above | |
| X3 | The default keys: Shift with the arrows, Shift + 0, Shift + C | Each one works. Alt with a drag still turns the view and swings back to north | |
| X4 | Change a key in Camera keys, quit and restart the game | Your key is still set | |
| X5 | From the close-up, open the buy-tile screen (a population point waiting), then close it | The city is framed the way the game frames it, then your close-up comes back | |

## Wide screens

Players asked for more room to zoom out on ultrawide screens. A 21:9 window on the Mac covers part of it: in the
game's graphics options, pick windowed and a 21:9 size if the list has one (2560 x 1080, say), or size the window to
about 21:9 by hand. Note the size the page reports (`node tower-bench.mjs eval '[innerWidth, innerHeight]'`). Then run
the same rows on a real ultrawide screen when there's one to hand.

| # | Do this | You should see | Result |
| --- | --- | --- | --- |
| U1 | All the way out | Most of the map, side to side. Note any sky or blank edge, and whether it's far enough out | |
| U2 | All the way in | Units in the middle look as they do at 16:10 | |
| U3 | Tipped to 80 degrees and turned | The resource icons shrink toward the far edge, out to the sides of the screen too | |
| U4 | Open the camera panel, and turn on the dials on screen | The panel sits beside the minimap and the dials at the top left, each fully on screen | |
| U5 | Hold an arrow key at the game's view, then all the way in | The map moves at about the same speed across the screen | |
