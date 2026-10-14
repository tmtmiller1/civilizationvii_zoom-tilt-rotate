// zoom-tilt-rotate-view.js - the player's angle and heading: easing the camera to them, a tap that steps and a hold
// that glides, the dials' quick follow, and putting them back when the game resets the camera. zoom-tilt-rotate.js
// imports it, passes it the commands, and tells it how far past the far limit the zoom is, since going far out turns
// the camera toward straight down.

import CameraController from "/core/ui/camera/camera-controller.js";
import { getTurnStep, getAngleStep } from "/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-settings.js";

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
const blend = (from, to, share) => from + (to - from) * share;

export const MOST_ANGLE = 80;

// The player's own view: an angle (degrees from straight down, null for the game's own tilt) and a heading (degrees
// turned from north). Going far out still turns the camera toward straight down; farOutShare is how far along that
// it is.
let viewAngle = null;
let viewHeading = 0;
let farOutShare = 0;

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
// The engine jumps straight to a new tilt or rotation, so ease there over a few hundred milliseconds, starting from
// what the camera reports now (which is also right after the game has reset it). A new target picks up from
// mid-move.
const TURN_EASE_MS = 600;
const FOLLOW_EASE_MS = 250;
let easing = null;
let follow = null;
let glide = null;

/** Whether the view is turned from north, or on its way somewhere. */
export function isTurned() {
  return viewHeading !== 0 || easing !== null;
}

function viewTarget() {
  return viewAngle === null
    ? { angle: 0, weight: farOutShare, heading: viewHeading }
    : { angle: viewAngle * (1 - farOutShare), weight: 1, heading: viewHeading };
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
    if (to.heading === 0 && from.heading !== 0) Camera.rotate(0, false);
    return;
  }
  const start = performance.now();
  const token = {};
  easing = token;
  follow = null;
  const step = () => {
    if (easing !== token) return;
    const t = Math.min(1, (performance.now() - start) / durationMs);
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    if (tilts) Camera.setTilt(blend(from.angle, to.angle, eased), blend(from.weight, to.weight, eased));
    if (Math.abs(turn) >= 0.05) {
      if (t === 1 && to.heading === 0) Camera.rotate(0, false);
      else Camera.rotate(from.heading + turn * eased, true);
    }
    if (t < 1) requestAnimationFrame(step);
    else easing = null;
  };
  requestAnimationFrame(step);
}

/** How far past the far limit the zoom is, from 0 to 1. Zooming moves it in small steps, so follow it quickly. */
export function setFarOutShare(share) {
  farOutShare = share;
  easeView(FOLLOW_EASE_MS);
}

/** The game's own tilt has no getter, so measure it: how far the line of sight to the middle of the screen leans. */
export function measureAngle() {
  const centre = Camera.pickWorldPosFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  if (!centre) return 45;
  const eye = Camera.getCurrentPose().position;
  return Math.atan2(Math.hypot(centre.x - eye.x, centre.y - eye.y), eye.z - centre.z) * 180 / Math.PI;
}

// A dial or slider being dragged sends a new value every frame. Restarting an ease each time starts slow every time,
// which lurches, so instead the camera chases the latest value: each frame it closes a share of the gap.
const FOLLOW_SHARE = 0.3;

// One frame of the chase. Returns whether anything is still moving.
function followOneFrame() {
  const state = Camera.getState();
  let moving = false;
  const turn = ((viewHeading - state.rotation) % 360 + 540) % 360 - 180;
  if (Math.abs(turn) > 0.05) {
    Camera.rotate(state.rotation + turn * FOLLOW_SHARE, true);
    moving = true;
  }
  if (viewAngle === null) return moving;
  const gap = viewAngle * (1 - farOutShare) - state.customTilt;
  const weightGap = 1 - state.tiltWeight;
  if (Math.abs(gap) > 0.05 || Math.abs(weightGap) > 0.002) {
    Camera.setTilt(state.customTilt + gap * FOLLOW_SHARE, state.tiltWeight + weightGap * FOLLOW_SHARE);
    moving = true;
  }
  return moving;
}

function followTo() {
  if (follow) return;
  easing = null;
  glide = null;
  const token = {};
  follow = token;
  const frame = () => {
    if (follow !== token) return;
    if (followOneFrame()) {
      requestAnimationFrame(frame);
      return;
    }
    follow = null;
    if (viewHeading === 0) Camera.rotate(0, false);
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
      viewHeading = normalHeading(viewHeading + direction * TURN_DEGREES_PER_SECOND * seconds);
      Camera.rotate(viewHeading, true);
    } else {
      viewAngle = clamp(viewAngle + direction * ANGLE_DEGREES_PER_SECOND * seconds, 0, MOST_ANGLE);
      Camera.setTilt(viewAngle * (1 - farOutShare), 1);
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
  if (gliding) announce();
  else stepBy(kind, direction);
}

// Camera.restoreDefaults() (closing a city screen, among others) drops the angle and the heading along with the
// lens. Put the player's back.
const originalRestoreDefaults = Camera.restoreDefaults;
Camera.restoreDefaults = function (...args) {
  const result = originalRestoreDefaults.apply(this, args);
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
