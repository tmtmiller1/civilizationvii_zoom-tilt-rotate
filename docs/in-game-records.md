# In-game records

What was watched in a running game, run by run. Each entry says the setup and what was seen.

## 2026-10-15, overnight L1: usual set, Antiquity, seed 4242, turn 14

Game 1.5.0. `deploy --prove`: all 9 UI files the game serves match the working tree (1.1.0, commit a6a01dd). The
game had moved on: capital Heian-Kyo founded, a population point waiting, a Warrior 8 tiles out. Every other Tower
mod on, as installed. The vanilla side of each check below is still owed.

First pass of the three checks read 35 degrees everywhere and the zoom never moved: an Emigration "Call our people
home" dialog and then the Advisor Council pop-up were open, and while any such screen holds the context the camera
takes no wheel input. With them closed, one notch moved the zoom 0.40 -> 0.31, and the checks ran:

- `close-up-reach.js`: Closer `[35,35,27,20,14,10,7,5]`, Much closer `[22,14,8,5,3,2,2,2]`, All the way
  `[20,11,6,3,2,1,1,1]`; at 1 degree, switching to Closer eased the lens out to 5 with the zoom unchanged. Pass.
- `trackpad-tail.js`: the whole gesture and the non-zero events alone both end at zoom 0, 5 degrees; the late tail
  left the close-up at 5 degrees. Pass.
- `game-move-recovery.js`: close-up at 5 degrees; `lookAtPlot` without a zoom kept it; a move to zoom 0.5 put the lens
  back to 35 degrees 757 ms after the camera arrived (431 ms); a jump to a unit 8 tiles away kept the close-up. Pass.
- `reveal-and-restore.js` (new): at the 5 degree close-up, turned to 45 degrees, `Visibility.revealAllPlots` opened
  the game's Natural Wonder Found placards (Redwood Forest, Uluru, Bermuda Triangle, Torres del Paine). Within about
  1.4 s the lens went from 5 to 35 degrees, the zoom stayed 0 and the heading stayed 45. While a placard was up, the
  tilt commands didn't move the camera; after Continue on each, they did. Then `Camera.restoreDefaults()`: the lens
  read 35 degrees at every sample to 3.2 s (35 at 2514 ms), so the 25.6 degree reading didn't come back.
- Resources and Yields boxes in the panel: ticking Resources switched `fxs-resource-layer` on; the game's own
  `LensManager.toggleLayer` (the hotkey's call) switched it off and the panel box followed; Yields on and off the
  same. The minimap's own box wasn't read (its lens panel was closed).
- Resource-icon twin, captures in `working_screenshots/overnight-2026-10-15/`: at the game's angle
  (`L1-ztr-icons-game-angle.png`) the icons are the game's size; at 50 degrees (`L1-ztr-icons-tipped-50.png`) the
  near icons are clearly larger than the far ones and nothing piles up along the far edge. At 80 degrees
  (`L1-ztr-icons-tipped.png`) the near half of the screen is off-map cloud, so that capture doesn't show much.

Not reached in this run: Demographics' cinematic tour and city camera with ZTR on.

## 2026-10-16, watch run 2 block 1 L2: usual set, Antiquity, seed 4242, turn 25

Game 1.5.0, windowed 1600x1000, all 16 Tower mods from their `Mods/` copies with each working tree deployed. Captures
in `working_screenshots/watch2-block1/`. The vanilla side of the panel boxes is in the V6 entry below.

- Resources boxes: the minimap's own box (the lens-panel component's `layerElementMap`), ZTR's panel box and
  `LensManager.toggleLayer` (the hotkey's call) agreed at every step: on, off from ZTR's box, on from the minimap's
  box, off from `toggleLayer`.
- Demographics' city camera (`startInstant`) and cinematic tour (`launchCinematic`) on Heijo ran with ZTR on. The tour
  drew its flyby (`L2-demographics-tour-ztr.png`, "FLYBY 3/4"); it still read active after 70 s and the probe tore it
  down. `Camera.getState` read zoom 0.4, 35 degrees throughout (the tour's shot cameras aren't what `getState`
  reads), and 35 degrees after the teardown and `restoreDefaults`. Neither mod wrote an error line.

## 2026-10-16, watch run 2 block 1 V6: ZTR alone, Antiquity, seed 4242, turn 1

Game 1.5.0, windowed 1600x1000, every other user mod off, ZTR's `Mods/` copy with its working tree deployed. Run
`2026-10-16T18-33-44`. Capital founded, a population point waiting, a Warrior 8 tiles out.

- `close-up-reach.js`: Closer `[35,35,27,20,14,10,7,5]`, Much closer `[22,14,8,5,3,2,2,2]`, All the way
  `[20,11,6,3,2,1,1,1]`; at 1 degree, switching to Closer eased the lens to 5. Pass.
- `trackpad-tail.js`: the whole gesture and the non-zero events alone both end at zoom 0, 5 degrees; the late tail
  left it at 5. Pass.
- `game-move-recovery.js`: close-up at 5 degrees; a move keeping the zoom kept it; a move to zoom 0.5 put the lens
  back to 35 degrees 748 ms after the camera arrived (424 ms); a jump to the unit 8 tiles away kept the close-up. Pass.
- All three the same as with the usual set.
- Resources boxes: the minimap's box, ZTR's box and `toggleLayer` agreed at every step.
- Resource-icon twin: captures `V6-ztr-icons-game-angle.png` and `V6-ztr-icons-tipped.png` (tilt 64) taken, but at
  turn 1 too few resources were in view to judge the size change. Still owed.

## 2026-10-16, placement heading L3: usual set, Antiquity, seed 4242, turn 1

Game 1.5.0, windowed, lab start `--setup fast --quick`, every Tower mod on from its `Mods/` copy, ZTR's working tree
deployed (`deploy --prove`: all 9 files served). The capital founded by script on turn 1. Follows a player report: with
the view facing south, placing a building turned the camera to north and spun it back, every time.

- `heading-through-placement.js` before the fix (1.1.0 code), heading 180: opening `INTERFACEMODE_PLACE_BUILDING`
  kept the heading at every sample through the 1 s framing (zoom 0.4 to 0.3, tilt 0 to 30); closing it read -180,
  -152.8, -177.4, -180 at 0, 259, 517 and 774 ms: a 27 degree swing toward north and back. The screen's keyframe
  (`Camera.addKeyframe`, `writeMask: KeyframeFlag.FLAG_ALL`) on its own left the heading at -180 throughout;
  `KeyframeFlag` is FOCUS 1, ZOOM 2, ORBIT 4, FOV 8, TILT 16, ALL 31. `lookAtPlot` to zoom 0.5 kept it too.
- `restore-defaults-heading.js`: `Camera.rotate(-180, true)` lands the next frame and holds. `Camera.restoreDefaults()`
  on its own then eased the heading -180, -139, -106, -79, -58, -42, -28, -19, -12, -7, -4, -2, -1, 0 over 500 ms, the
  same curve as `Camera.rotate(0, false)`. One `rotate(-180, true)` on the next frame stopped it (one sample at -169,
  then -180 held); a hold in the same frame as `restoreDefaults`, followed by `restoreCameraZoom` and `clearAnimation`
  as city-zoomer calls them, kept -180 at every frame. `restoreDefaults` eases the tilt weight 1 to 0 over 600 ms the
  same way; a `setTilt(50, 1)` right after it dipped to 0.06 and eased back to 1 by 600 ms.
- After the fix (hold in the same frame, and the ease asserts the hold when the camera reads as already there), the
  heading strayed 0.0 degrees at every frame through 2 s of opening and 2 s of closing, three times: at the game's lens
  (zoom 0.4), with the angle at 50 (back at 50/1.00 after), and from the 5 degree close-up (zoom 0, lens 5 after).
  Back to normal afterwards read 0 degrees, 35 degree lens.

Not reached: the same with every other mod off.

## 2026-10-29, far-out feel: ZTR alone, Antiquity, seed 4242, turn 1

Game 1.5.0, windowed 1600x1000, `tools/crash-soak/run-soak.sh` with only ZTR on (every other third-party mod off),
capital founded by script. First the released 1.1.2 files, then the working tree copied over them and the UI
reloaded. Follows two Workshop comments: past the farthest view, the zoom moved first and the angle afterwards, which
felt wobbly. Synthetic wheel notches through the camera controller at about 23 frames a second.

- `far-out-feel.js` on 1.1.2. Inside the game's range the height eased and the angle hardly moved (41.7 to 40 degrees
  from zoom 0.46 to 1). Past it, each notch's lens started at once and eased out, while the angle started about
  100 ms later on its own 250 ms ease and stood still for a frame or two at every notch. Scored as the gap between the
  lens's share of the way out and the tilt weight: one notch at a time averaged 0.7% (worst 6%), a fast spin of nine
  notches 150 ms apart averaged 5.5% (worst 14%) with the angle stalled on 11 frames, and coming back in fast averaged
  4.3% (worst 11%). The fast spin also ended at 1.33 on the mod's scale instead of 1.54: past the limit the zoom runs at
  most a notch ahead of the lens on screen, and the lens hadn't caught up.
- Engine checks: one `setVerticalFoV(50)` 200 ms into a zoom from 0.6 to 1 let the zoom arrive; so did one
  `setTilt(10, 0.5)`. A `setTilt` every frame held the zoom at 0.6 for the whole 1.2 s. A single tilt call eased in
  with a time constant of about 105 ms, a single lens call about 250 ms.
- `far-out-sync.js` on the engine directly, the zoom parked at 1: both calls once per notch put the angle up to a
  third ahead of the lens; tilting every frame for the lens on screen trailed by 7% on average; aiming 0.35 to 0.55 of
  the remaining way ahead kept the average gap at 0.5 to 2% with no stalls. 0.4 went into the fix.
- `far-out-feel.js` on the fix: one notch at a time averaged 0.3% (worst 3%), the fast spin 0.3% (worst 3%) with one
  stalled frame, and coming back in fast 0.8% (worst 3%). Inside the game's range nothing changed.
- `keep-angle-far-out.js` with the box ticked: at the game's angle every notch out to the 90 degree lens read 40
  degrees. From 60 degrees the notches read 60, 58.3, 53.8, 49.2, 44.6, 40 and 40 against 85 minus half the lens (60,
  58.5, 54, 49, 44.5, 40, 40). Clearing the box at the far end turned the camera to 0.5 degrees.
- Captures in `working_screenshots/ztr-far-out-2026-10-29/`, the map revealed for 05 to 10: 08 is the angle held at
  40 with the 90 degree lens (the polar ice along the top, no sky), 09 the same through the new option, 10 the fix's
  far end with the box clear.
- Seen alongside: with a player angle still settling from the panel's angle gauge, nine notches out didn't move the
  zoom (it stayed at 0.73), and after 1.5 s the far-out lens went on at that height. The gauge's chase sends a tilt
  every frame, which holds the zoom still. Fixed and watched in the next entry.

Not reached: the same with the usual mod set, a real mouse wheel or trackpad, and the new Options row on screen.

## 2026-10-29, zooming while the angle or heading moves: ZTR alone, Antiquity, seed 4242, turn 1

Same setup as the entry above, a fresh game (`run-soak.sh`, label ztr3), about 62 frames a second. The released
1.1.2 files first, then the working tree copied over them and the UI reloaded. `devtools/zoom-while-turning.js`
samples every 100 ms; the camera's own zoom is what counts, since the mod's announced zoom is taken a frame after
each notch.

- 1.1.2. Angle gauge let go, then nine notches out: the camera stayed at 0.73 throughout and the lens went on to 44
  degrees at that height. Angle key tapped, then three notches: the zoom never left 0.4. Angle key held with three
  notches: never left 0.4. Turn key tapped, then three notches: 0.4, 0.49, 0.49, 0.58, 0.67, a whole notch at a time
  with nothing in between. Compass dragged with three notches: the same notch-sized jumps. One notch past the limit
  with the gauge settling: right (zoom 1, lens 44).
- The fix. Gauge then nine notches: the zoom reached 1, the lens stayed at 35 until it did, and it ended at 90
  degrees and 1.54. Angle key tapped: 0.67. Angle key held: 0.67, and the angle glided on to 78. Turn key tapped:
  0.444, 0.487, 0.566, 0.621, 0.665, 0.67, eased; the heading waited at 1 until the zoom was in, then turned to 45.
  Compass dragged: eased the same way to 0.67; the heading paused at 20 and 31 while each notch moved and ended on
  74. One notch past the limit: unchanged.
- `far-out-feel.js` on the full fix. The fast spin of nine notches now ends at 1.54 with the 90 degree lens (1.1.2
  and the first fix ended at 1.32 to 1.33, lens 68). The gap between lens and angle averaged 0.1% on every case
  (worst 1.3%), against 0.3 to 0.8% for the first fix. Back in fast from 1.18, nine notches ended at 0.37, every
  notch kept (1.1.2 ended at 0.54). With the player's angle at 40, the spin out (on 1.1.2 stuck at 0.73, the same
  bug as the gauge) reached 1.54, the angle within 1.4 degrees of 40 times the lens's share left, worst 5.
- `keep-angle-far-out.js`: from 60 degrees the notches read 60, 58.3, 53.7, 49.2, 44.6, 40, 40, and at the game's
  angle 40 throughout, as in the entry above.
- Seen alongside, not looked into: the mod's announced zoom inside the game's range is the camera's a frame after
  each notch, so after a quick spin the last announcement trails the camera (0.512 announced, camera at 0.37; 0.614
  against 0.54 on 1.1.2). Whether the panel's zoom gauge shows that wasn't checked.

Not reached: the same with the usual mod set, and a real wheel.
