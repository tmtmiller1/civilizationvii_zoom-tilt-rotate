// zoom-tilt-rotate-view.js - the player's angle and heading: easing the camera to them, a tap that steps and a hold
// that glides, the dials' quick follow, and putting them back when the game resets the camera. zoom-tilt-rotate.js
// imports it, passes it the commands, and tells it how far past the far limit the zoom is, since going far out turns
// the camera toward straight down.

import CameraController from "/core/ui/camera/camera-controller.js";
import {
  getTurnStep, getAngleStep, getKeepAngleFarOut, SETTINGS_CHANGED_EVENT
} from "/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-settings.js";

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
const blend = (from, to, share) => from + (to - from) * share;

export const MOST_ANGLE = 80;

// The player's own view: an angle (degrees from straight down, null for the game's own tilt) and a heading (degrees
// turned from north). Going far out still turns the camera toward straight down; farOutShare is how far along that
// it is.
let viewAngle = null;
let viewHeading = 0;
let farOutShare = 0;

// The lens past the far limit, from zoom-tilt-rotate.js: the lens at a share of the way out, and the share the lens on
// screen shows right now (null when it can't be measured).
let lens = { degreesAt: (share) => 35 + 55 * share, shareOnScreen: () => null };

export function useLens(reader) {
  lens = reader;
}

// With "Keep the angle when zoomed far out", the camera holds its angle and tips down only as far as keeps the top of
// the screen within HORIZON_LIMIT degrees of straight down. Measured in game at the far limit, the top of the screen
// at 85 degrees lands on the map about twelve camera heights out; past 90 it's sky. The game's own angle there is
// 40 degrees, so at the widest lens (90) it doesn't tip at all.
const HORIZON_LIMIT = 85;
let gameAngle = 40;

// The tilt a share of the way past the far limit.
function farOutTilt(share) {
  if (getKeepAngleFarOut()) {
    const limit = HORIZON_LIMIT - lens.degreesAt(share) / 2;
    if ((viewAngle ?? gameAngle) > limit) return { angle: limit, weight: 1 };
    return viewAngle === null ? { angle: 0, weight: 0 } : { angle: viewAngle, weight: 1 };
  }
  return viewAngle === null ? { angle: 0, weight: share } : { angle: viewAngle * (1 - share), weight: 1 };
}

// Ticking or clearing it in Options applies to the view already past the far limit.
window.addEventListener(SETTINGS_CHANGED_EVENT, (event) => {
  if (event.detail?.key === "keepAngleFarOut" && farOutShare > 0) easeView(FOLLOW_EASE_MS);
});

// zoom-tilt-rotate.js reports the view to the panel; it hands that function over here.
let announce = () => {};

export function onViewMoved(callback) {
  announce = callback;
}

export function currentView() {
  return { angle: viewAngle, heading: viewHeading };
}

// Going far out blends the angle toward straight down, the way the game's own tilt is blended when there's no angle
// set.
//
// The engine jumps straight to a new rotation and smooths a new tilt only a little, so ease there over a few hundred
// milliseconds, starting from what the camera reports now (which is also right after the game has reset it). A new
// target picks up from mid-move.
const TURN_EASE_MS = 600;
const FOLLOW_EASE_MS = 250;
let easing = null;
let follow = null;
let glide = null;
let lensFollow = null;

// What a camera call does to a zoom still on its way, measured 2026-10-29 (devtools/zoom-freeze.js): a tilt in the
// frame the zoom started cancels it for good; tilts every frame or two hold it still until they stop; tilts 60 ms or
// more apart leave it alone, and the engine smooths the angle in between; a turn of any size makes the zoom jump
// straight to its end. So while a zoom the mod sent is on its way, tilts skip the frame it started in and go out at
// most every TILT_GAP_WHILE_ZOOMING_MS, and turns wait for it to arrive.
const TILT_GAP_WHILE_ZOOMING_MS = 60;
let lastTilt = { angle: null, weight: null, at: -Infinity };
let tiltWaiting = null;

// Every zoom the mod sends goes through sendZoom, so the eases know when one is on its way.
const ZOOM_TRAVEL_MS = 1500;
let zoomInFlight = null;

export function sendZoom(zoom) {
  const flight = { to: zoom, since: performance.now(), fresh: true };
  zoomInFlight = flight;
  Camera.zoom(zoom);
  // Frame callbacks already queued for this frame run before this one, so they still see the zoom as fresh.
  requestAnimationFrame(() => {
    flight.fresh = false;
  });
}

// The zoom on its way, or null once it has arrived.
function zoomOnItsWay() {
  if (!zoomInFlight) return null;
  const arrived = Math.abs(Camera.getState().zoomLevel - zoomInFlight.to) <= 0.002;
  if (arrived || performance.now() - zoomInFlight.since > ZOOM_TRAVEL_MS) zoomInFlight = null;
  return zoomInFlight;
}

// Send a tilt if a zoom on its way allows it now. Returns whether it went.
function sendTilt(angle, weight) {
  const zoom = zoomOnItsWay();
  const now = performance.now();
  if (zoom && (zoom.fresh || now - lastTilt.at < TILT_GAP_WHILE_ZOOMING_MS)) return false;
  lastTilt = { angle, weight, at: now };
  tiltWaiting = null;
  Camera.setTilt(angle, weight);
  return true;
}

// Send a tilt as soon as a zoom on its way allows it. A newer tilt replaces one still waiting.
function sendTiltSoon(angle, weight) {
  const token = {};
  tiltWaiting = token;
  const attempt = () => {
    if (tiltWaiting === token && !sendTilt(angle, weight)) requestAnimationFrame(attempt);
  };
  attempt();
}

const turnsWait = () => zoomOnItsWay() !== null;

/** Whether the view is turned from north, or on its way somewhere. */
export function isTurned() {
  return viewHeading !== 0 || easing !== null;
}

function viewTarget() {
  return { ...farOutTilt(farOutShare), heading: viewHeading };
}

// The camera reads as already at the view. The engine may still be on its way elsewhere, though: after
// Camera.restoreDefaults() or Camera.rotate(0, false) it swings the heading to north and the tilt to the game's own
// over about half a second, and a read taken before that swing has moved anything looks like "nothing to do". Telling
// the engine the view once more stops the swing; when it was holding still anyway, it changes nothing.
function holdView(from, to) {
  if (to.heading === 0) {
    if (from.heading !== 0) Camera.rotate(0, false);
  } else {
    Camera.rotate(to.heading, true);
  }
  if (viewAngle !== null) sendTilt(to.angle, to.weight);
}

// Holding the view turns the camera, which would make a zoom on its way jump: hold it once the zoom is there.
let holdLater = null;

function holdViewWhenFree(from, to, durationMs) {
  if (!turnsWait()) {
    holdView(from, to);
    return;
  }
  holdLater ??= requestAnimationFrame(() => {
    holdLater = null;
    easeView(durationMs);
  });
}

/** Ease the camera to the player's view. With no duration it takes the slower ease the angle and turn keys get. */
export function easeView(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 2000) durationMs = TURN_EASE_MS;
  const state = Camera.getState();
  const from = { angle: state.customTilt, weight: state.tiltWeight, heading: state.rotation };
  const to = viewTarget();
  const turn = ((to.heading - from.heading) % 360 + 540) % 360 - 180;
  const tilts = Math.abs(to.angle - from.angle) > 0.05 || Math.abs(to.weight - from.weight) > 0.002;
  if (!tilts && Math.abs(turn) < 0.05) {
    holdViewWhenFree(from, to, durationMs);
    return;
  }
  const ease = { from, to, turn, tilts, durationMs, start: performance.now(), lastFrame: performance.now() };
  const token = {};
  easing = token;
  follow = null;
  const step = () => {
    if (easing !== token) return;
    if (easeOneFrame(ease)) requestAnimationFrame(step);
    else easing = null;
  };
  requestAnimationFrame(step);
}

// One frame of an ease. Returns whether there's more to do.
function easeOneFrame(ease) {
  const { from, to, turn, tilts, durationMs } = ease;
  const now = performance.now();
  const turns = Math.abs(turn) >= 0.05;
  // A turn would make a zoom on its way jump to its end, so an ease that turns waits for the zoom.
  if (turns && turnsWait()) {
    ease.start += now - ease.lastFrame;
    ease.lastFrame = now;
    return true;
  }
  ease.lastFrame = now;
  const t = Math.min(1, (now - ease.start) / durationMs);
  const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  // While the angle rides on the lens far out, the lens has the tilt; the ease only turns.
  const tilted = !tilts || lensFollow !== null
    || sendTilt(blend(from.angle, to.angle, eased), blend(from.weight, to.weight, eased));
  if (turns) {
    if (t === 1 && to.heading === 0) Camera.rotate(0, false);
    else Camera.rotate(from.heading + turn * eased, true);
  }
  // The last tilt may have had to wait for a zoom; carry on until it goes.
  return t < 1 || !tilted;
}

/** How far past the far limit the zoom is, from 0 to 1. zoom-tilt-rotate.js sets the lens for it at the same time. */
export function setFarOutShare(share) {
  if (share === farOutShare && !lensFollow) {
    easeView(FOLLOW_EASE_MS);
    return;
  }
  if (farOutShare === 0 && viewAngle === null && Camera.getState().tiltWeight < 0.01) gameAngle = measureAngle();
  farOutShare = share;
  followLens();
}

// Far out, the angle rides on the lens. The engine eases a lens change, quickly at first, and smooths each tilt call
// too, so a tilt eased on its own clock trails the lens and stops and starts at every notch. Instead, each frame, aim
// the tilt at the lens on screen plus LENS_LEAD of the way the lens still has to go. In game that kept the angle within
// about 1% of the lens all the way, at one notch and at a fast spin (devtools/far-out-sync.js). The zoom stands at the
// far limit meanwhile, and on the way back in it waits for the lens, so no zoom is on its way to be held up.
const LENS_LEAD = 0.4;
// About half a degree of lens.
const LENS_ARRIVED = 0.01;
const LENS_FOLLOW_MS = 2000;

function followLens() {
  const giveUpAt = performance.now() + LENS_FOLLOW_MS;
  if (lensFollow) {
    lensFollow.giveUpAt = giveUpAt;
    return;
  }
  const token = { giveUpAt };
  lensFollow = token;
  const frame = () => {
    if (lensFollow !== token) return;
    const shown = lens.shareOnScreen();
    if (shown === null || Math.abs(shown - farOutShare) < LENS_ARRIVED || performance.now() > token.giveUpAt) {
      lensFollow = null;
      settleTilt();
      return;
    }
    // A dial being dragged or an angle key held sets the tilt itself.
    if (!follow && !glide?.gliding) {
      const to = farOutTilt(shown + (farOutShare - shown) * LENS_LEAD);
      sendTilt(to.angle, to.weight);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// The lens has arrived: one last tilt call for where it ended, or a short ease when a turn was under way.
function settleTilt() {
  if (follow || glide?.gliding) return;
  if (easing) {
    easeView(FOLLOW_EASE_MS);
    return;
  }
  const to = viewTarget();
  sendTiltSoon(to.angle, to.weight);
}

/** The game's own tilt has no getter, so measure it: how far the line of sight to the middle of the screen leans. */
export function measureAngle() {
  const centre = Camera.pickWorldPosFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  if (!centre) return 45;
  const eye = Camera.getCurrentPose().position;
  return Math.atan2(Math.hypot(centre.x - eye.x, centre.y - eye.y), eye.z - centre.z) * 180 / Math.PI;
}

// A dial or slider being dragged sends a new value every frame. Restarting an ease each time starts slow every time,
// which lurches, so instead the heading chases the latest value: each frame it closes a share of the gap. The angle
// goes straight to the latest value, since the engine smooths a tilt itself; chasing on top of that took a second and
// a half to settle the last few degrees.
const FOLLOW_SHARE = 0.3;

// One frame of the chase. Returns whether anything is still moving.
function followOneFrame() {
  const state = Camera.getState();
  let moving = false;
  const turn = ((viewHeading - state.rotation) % 360 + 540) % 360 - 180;
  if (Math.abs(turn) > 0.05) {
    moving = true;
    if (!turnsWait()) {
      Camera.rotate(state.rotation + turn * FOLLOW_SHARE, true);
      follow.turned = true;
    }
  }
  if (viewAngle === null) return moving;
  const angle = farOutTilt(farOutShare).angle;
  if ((Math.abs(angle - lastTilt.angle) > 0.01 || lastTilt.weight !== 1) && !sendTilt(angle, 1)) moving = true;
  return moving;
}

function followTo() {
  if (follow) return;
  easing = null;
  glide = null;
  const token = { turned: false };
  follow = token;
  const frame = () => {
    if (follow !== token) return;
    // Letting go of north turns the camera too, so it waits for a zoom on its way.
    if (followOneFrame() || (viewHeading === 0 && token.turned && turnsWait())) {
      requestAnimationFrame(frame);
      return;
    }
    follow = null;
    if (viewHeading === 0 && token.turned) Camera.rotate(0, false);
  };
  requestAnimationFrame(frame);
}

/** A dial or slider set the angle. */
export function setAngle(degrees) {
  viewAngle = clamp(degrees, 0, MOST_ANGLE);
  followTo();
  announce();
}

/** A dial or slider set the heading. */
export function setHeading(degrees) {
  viewHeading = normalHeading(degrees);
  followTo();
  announce();
}

/** North and the game's own angle. zoom-tilt-rotate.js brings the zoom back into range and eases the camera after. */
export function resetView() {
  glide = null;
  viewAngle = null;
  viewHeading = 0;
}

const normalHeading = (degrees) => {
  const wrapped = ((degrees % 360) + 540) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
};

// A tap moves one step, onto the step grid, so the four compass points and round angles are always a tap away.
// Holding the key (or a panel button) past HOLD_MS glides at a steady speed and stops wherever it's let go, so any
// heading and any angle in range is possible. Nothing moves before HOLD_MS, so a tap that reaches the page a little
// late is still a step, never a small glide.
export const HOLD_MS = 350;
const TURN_DEGREES_PER_SECOND = 60;
const ANGLE_DEGREES_PER_SECOND = 25;

function nextOnGrid(value, direction, step) {
  const along = direction > 0 ? Math.floor(value / step + 1e-6) + 1 : Math.ceil(value / step - 1e-6) - 1;
  return along * step;
}

/** One step: kind is "turn" or "tilt", direction 1 or -1. */
export function stepBy(kind, direction) {
  if (kind === "turn") {
    viewHeading = normalHeading(nextOnGrid(viewHeading, direction, getTurnStep()));
  } else {
    viewAngle = clamp(nextOnGrid(viewAngle ?? measureAngle(), direction, getAngleStep()), 0, MOST_ANGLE);
  }
  easeView(TURN_EASE_MS);
  announce();
}

export function startGlide(kind, direction) {
  const token = { kind, direction, gliding: false, lastFrame: 0, announcedAt: 0 };
  glide = token;
  setTimeout(() => {
    if (glide !== token) return;
    token.gliding = true;
    easing = null;
    // Start from what's on screen, which may be partway through an ease.
    if (kind === "turn") viewHeading = normalHeading(Camera.getState().rotation);
    else if (viewAngle === null) viewAngle = measureAngle();
    token.lastFrame = performance.now();
    requestAnimationFrame(frame);
  }, HOLD_MS);
  const frame = () => {
    if (glide !== token) return;
    const now = performance.now();
    const seconds = Math.min((now - token.lastFrame) / 1000, 0.1);
    token.lastFrame = now;
    if (kind === "turn") {
      // A turn would make a zoom on its way jump to its end, so the glide waits for the zoom.
      if (!turnsWait()) {
        viewHeading = normalHeading(viewHeading + direction * TURN_DEGREES_PER_SECOND * seconds);
        Camera.rotate(viewHeading, true);
      }
    } else {
      viewAngle = clamp(viewAngle + direction * ANGLE_DEGREES_PER_SECOND * seconds, 0, MOST_ANGLE);
      sendTilt(farOutTilt(farOutShare).angle, 1);
    }
    if (now - token.announcedAt > 100) {
      token.announcedAt = now;
      announce();
    }
    requestAnimationFrame(frame);
  };
}

/** The key or button came up: a glide stops where it is, and a press too short to glide is one step. */
export function endGlide(kind) {
  if (!glide || glide.kind !== kind) return;
  const { direction, gliding } = glide;
  glide = null;
  if (!gliding) {
    stepBy(kind, direction);
    return;
  }
  // The last frame's tilt may have had to wait for a zoom.
  const angle = farOutTilt(farOutShare).angle;
  if (kind === "tilt" && angle !== lastTilt.angle) sendTiltSoon(angle, 1);
  announce();
}

// Camera.restoreDefaults() (closing the place-building and buy-tile screens, among others) drops the lens at once
// and starts the engine swinging the heading to north and the tilt to the game's own over about half a second. Hold
// the player's heading again in the same frame, before that swing has moved anything, and it never shows; the tilt
// eases back from the next frame.
const originalRestoreDefaults = Camera.restoreDefaults;
Camera.restoreDefaults = function (...args) {
  const result = originalRestoreDefaults.apply(this, args);
  lastTilt = { angle: null, weight: null, at: lastTilt.at };
  if (viewHeading !== 0) Camera.rotate(viewHeading, true);
  if (viewAngle !== null || viewHeading !== 0) {
    requestAnimationFrame(() => easeView());
  }
  return result;
};

// Alt (Option on a Mac) is the game's camera key: hold it and drag (or two-finger drag on a trackpad) to peek around,
// and the view swings back to north when it's let go. That's the game's own behaviour and the mod leaves it alone:
// while Alt is held its own easing stands aside, and once Alt is up the heading it keeps is north again.
window.addEventListener("keydown", (event) => {
  if (event.code !== "Alt" || event.repeat) return;
  easing = null;
  glide = null;
  follow = null;
}, true);

window.addEventListener("keyup", (event) => {
  if (event.code !== "Alt") return;
  viewHeading = 0;
  announce();
}, true);

// The game's own rotate (a gamepad stick, or a drag with the camera key held) lets go back to north. Go back to the
// player's heading instead.
const controllerPrototype = Object.getPrototypeOf(CameraController);
const originalCameraRotate = controllerPrototype.cameraRotate;
controllerPrototype.cameraRotate = function (status, x) {
  const result = originalCameraRotate.call(this, status, x);
  if (status === InputActionStatuses.FINISH && viewHeading !== 0) easeView();
  return result;
};
