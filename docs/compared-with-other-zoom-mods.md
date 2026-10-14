# Compared with other zoom mods

Before building Zoom, Tilt, & Rotate, I tested the two zoom mods already on the Workshop. Each does some things well
(see the end of its section), but neither went as far in or out as I wanted, and neither let you set the camera angle or
keep a heading other than north. One of them described its limits as limits of the game engine: that the engine forces
the close-up to snap back, and that it can't report or set a heading. So I measured the engine. It holds a narrow lens
for as long as you like, takes a field of view anywhere from 1 to 120 degrees, and reports and holds any heading you
give it.

This page is what I measured. The other mods aren't named; they're Mod A and Mod B. It's meant as a reference for what
each mod does and what the engine allows, not a knock on anyone's work.

## How it was tested

Game 1.5.0 on macOS, a 2880 x 1800 window, a seeded game (Antiquity, turn 1, capital founded), every other mod
switched off, one zoom mod at a time. Wheel and trackpad tests used real input posted through macOS, not calls into
the mod, because inside the game's own range the engine zooms on the wheel by itself and a script-sent wheel event
doesn't zoom at all. The gamepad trigger and keyboard panning went through the game's own input handler, which moves
the camera normally in the unmodded game. A script in the page read the camera every 100 ms:

- **Lens**: the field of view, measured from where two screen points land on the map, since the engine has no getter
  for it.
- **Span**: map distance across the middle fifth of the screen. Smaller means closer.
- **Pan speed**: how far the ground moves during half a second of a held arrow key, in screen widths, added up frame
  by frame (the map wraps east to west, so a start-to-end measurement reads wrong once it crosses the seam).

## Side by side

The unmodded game's lens is 35 degrees at both ends, with a span of 43.7 at its closest and 231 at its farthest.

| | Unmodded | Mod A | Mod B | Zoom, Tilt, & Rotate |
| --- | --- | --- | --- | --- |
| Closest lens | 35° | 25°, for 4 seconds | 15°, tilted | 5° by default, 2° or 1° in Options |
| How much closer than unmodded | 1x | 1.4x for 4 s, then 0.76x | 2.3x | 7.2x, 18x or 36x |
| Farthest lens | 35° | 60°, for 4 seconds | 60°, tilted | 90°, looking straight down |
| Farthest span (bigger is farther) | 231 | 423, then 304 | 401 | 565 |
| Steps past each end | — | one, eased in over 3 s | one | six |
| Close-up holds | — | no, released after 4 s | yes | yes |
| Trackpad swipe keeps the close-up | — | no | no | yes |
| Gamepad trigger zooms | yes | no | yes | yes |
| Pan speed at the closest view (screens per 0.5 s) | 1.56 | 2.24 | 3.61 | 1.58 |
| Pan speed at the farthest view | 0.80 | not measured | about 0.45 | 0.97 to 1.03 |
| Set the camera angle | — | no | fixed tilt at each end only | 0 to 80°, held |
| Face any heading and keep it | — | turns, then swings back to north | no | any heading, held |

## The claims, and what the engine actually does

**"The snap-back on full zoom-in is a system override that can only be delayed."** Mod A's author said this, and later
called it a limitation of the engine and said snap-backs are unavoidable with field of view. What I saw: Mod A holds its
close-up for 4 seconds and then puts the lens back itself, on a timer it ships with a slider for (1 to 20 seconds).
Raising the timer to 20 seconds kept the close-up for 20 seconds. Mod B held 15 degrees and Zoom, Tilt, & Rotate holds
5, 2 or 1 degree for as long as you leave it, with no timer at all. The engine only drops a narrow lens when the game
resets the camera (closing a city screen, for one), and a mod can put it straight back.

**The closest view stops at 25 degrees.** That's a constant in Mod A's code, and its own field-of-view setter clamps
to it, whatever camera profile or range the player picks. The engine takes anything from 1 to 120 degrees and holds
every value in between. At 1 degree you can see the edge of a single sword.

**"The engine can't expose an absolute heading."** Mod A reports this to its players as a capability check, and its
turn keys peek a little way and swing back. The camera's state, the same one Mod A reads its zoom from, includes the
rotation. Turning the camera to a heading with the engine's own rotate call holds it there through zooming and
panning, and when the game resets the camera a mod can turn it straight back. This mod reads the heading to
draw its compass, eases to any heading you pick, and keeps it until you turn it again. When a player asked Mod A for
a camera rotation that stays put, as earlier Civ games had through mods, the answer was that snap-backs can't be
avoided.

**Angle.** Neither mod lets the player set the camera's angle. Mod B tips the camera to a fixed tilt at each end of
its range and Mod A doesn't touch the tilt. The engine's tilt call takes anything from straight down to 80 degrees
toward the horizon and holds it.

Mod B doesn't make any claims about the engine. It's a small, tidy mod that goes one step past each end, to a 15-degree
close-up, without a way to set the angle or keep a heading. Its problems are below.

## Other problems found

**Mod A**

- It assumes the game's lens is 45 degrees (it can't read the real one, which is 35) and sets 45 on the first zoom.
  Once the close-up has snapped back, its closest view shows about a third more ground than the unmodded game's.
- The normal view flips between 35 and 45 degrees depending on whether the game reset the camera last.
- A trackpad swipe springs back out within a second. A Mac trackpad ends every swipe with a run of scroll events that
  have no movement in them, and the game names every one "scroll down"; Mod A zooms out on them.
- The gamepad triggers don't zoom. The same input moved the unmodded game from mid zoom to its closest in about 10
  frames.
- Panning gets faster the closer you are, because the pan step isn't scaled with the lens.
- At 60 degrees, with no tilt, the top of the screen is sky and haze.
- It replaces the game's whole camera controller file, so it conflicts with any other mod that touches the camera, and
  any change the game makes to that file in a patch is hidden while it's installed.

**Mod B**

- One notch past each end goes straight to the full effect, and the next notch back jumps all the way out again.
- A trackpad swipe springs back out, for the same reason as Mod A.
- When the game moves the camera, the lens and tilt stay on at the wrong height, and the next notch in sends the camera
  to the farthest view. Getting back to the close-up then took 16 notches instead of 6.
- Panning isn't scaled: 3.6 screen widths per half second close in, about half the game's speed far out.
- Opening a city screen from the close-up frames the city like the game does, but closing it leaves you at the
  game's normal view.

## What they do well

Mod A is the most configurable of the three, with camera profiles, a range editor, a key to get back to the game's
own range and several optional extras. Mod B's tilted close-up looks good, its gamepad trigger works at both ends,
and it doesn't replace any game file.

## Not covered

A physical mouse wheel, a real gamepad and a touch screen weren't available, so all input was posted through macOS or
the game's input handler. Mod A's optional features weren't tested, and nothing here was run on Windows.
