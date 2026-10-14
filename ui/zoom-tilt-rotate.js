// zoom-tilt-rotate.js - the zoom past both ends of the game's range, the lens and tilt that go with it, panning that
// keeps pace with the lens, and the commands the camera keys and the panel send. The angle and heading are in
// zoom-tilt-rotate-view.js.

import CameraController from "/core/ui/camera/camera-controller.js";
import { CityZoomer } from "/base-standard/ui/city-zoomer/city-zoomer.js";
import ViewManager from "/core/ui/views/view-manager.js";
import { InputHandlerState } from "/core/ui/input/input-support.js";
import { getCloseUpReach, SETTINGS_CHANGED_EVENT } from "/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-settings.js";
import {
  HOLD_MS, currentView, easeView, endGlide, isTurned, measureAngle, onViewMoved, resetView, setAngle,
  setFarOutShare, setHeading, startGlide, stepBy
} from "/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-view.js";

// The game's zoom runs from 0 (closest) to 1 (farthest). Past either end we keep
// going by changing the field of view instead, so requestedZoom runs from
// -CLOSE_UP.reach to 1 + FAR_OUT.reach. A wheel notch is 0.09 (the controller's
// 0.3 rate times 0.3), so a reach of 0.54 is six notches.
//
// Far out, the camera turns to look straight down; with the game's tilt a wide
// lens shows the sky and the edge of the map. How far in the lens goes is the
// player's choice in Options (zoom-tilt-rotate-settings.js), read on every zoom.
const GAME_FIELD_OF_VIEW = 35;
const CLOSE_UP = { tilt: null, reach: 0.54 };
const FAR_OUT = { fieldOfView: 90, tilt: 0, reach: 0.54 };
const BASE_ZOOM_RATE = 0.3;

// A zoom eases in over about half a second and getState() reports it mid-move.
// After this long, a zoom we didn't send means the game moved the camera.
const ZOOM_SETTLE_MS = 700;

// A field-of-view change eases in too; measure it only after this long.
const LENS_SETTLE_MS = 1000;

// Apply the lens anyway if the zoom hasn't arrived by then.
const LENS_WAIT_LIMIT_MS = 1500;

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
const blend = (from, to, share) => from + (to - from) * share;
const halfTan = (degrees) => Math.tan(degrees * Math.PI / 360);

// Going in, each notch magnifies by the same amount, so the last notch to 1 degree
// is no bigger a jump than the first. Going out, the lens and tilt move evenly.
function closeUpFieldOfView(share, end) {
  const scale = Math.pow(halfTan(end) / halfTan(GAME_FIELD_OF_VIEW), share);
  return Math.atan(halfTan(GAME_FIELD_OF_VIEW) * scale) * 360 / Math.PI;
}

function closeUpShare(degrees, end) {
  const gameHalfTan = halfTan(GAME_FIELD_OF_VIEW);
  return Math.log(halfTan(degrees) / gameHalfTan) / Math.log(halfTan(end) / gameHalfTan);
}

let requestedZoom = Camera.getState().zoomLevel;
let lastSentZoom = requestedZoom;
let lastSentAt = 0;
let beyondLimits = false;
let zoomBeforeCityScreen = null;
let fieldOfViewWeSet = GAME_FIELD_OF_VIEW;
let lensWaitingForZoom = null;
let lensTimerRunning = false;
let closeUpEnd = getCloseUpReach().fieldOfView;

function setFieldOfView(degrees) {
  fieldOfViewWeSet = degrees;
  Camera.setVerticalFoV(degrees);
}

// There's no getter for the field of view, and Camera.restoreDefaults() can reset
// it behind our back, so measure it: the angle between the lines of sight to the
// screen centre and to a point beside it, scaled by the aspect ratio. Returns
// null if a pick misses or the answer isn't plausible.
function measureFieldOfView() {
  const width = window.innerWidth, height = window.innerHeight, offset = 0.1;
  const centre = Camera.pickWorldPosFromPoint(width / 2, height / 2);
  const beside = Camera.pickWorldPosFromPoint(width / 2 * (1 + offset), height / 2);
  if (!centre || !beside) return null;
  const eye = Camera.getCurrentPose().position;
  const toCentre = [centre.x - eye.x, centre.y - eye.y, centre.z - eye.z];
  const toBeside = [beside.x - eye.x, beside.y - eye.y, beside.z - eye.z];
  const dot = toCentre[0] * toBeside[0] + toCentre[1] * toBeside[1] + toCentre[2] * toBeside[2];
  const angle = Math.acos(Math.min(1, dot / (Math.hypot(...toCentre) * Math.hypot(...toBeside))));
  const degrees = Math.atan(Math.tan(angle) / (offset * width / height)) * 360 / Math.PI;
  return degrees > 0.5 && degrees < 150 ? degrees : null;
}

// Keyboard, edge and gamepad panning move a fixed distance on the map, which
// gets fast when the lens is narrow. Scale the step by tan(fov / 2), which is how
// the visible width scales. They also move along the map, not the screen, so when
// the player has turned the view, turn the step with it. Mouse drag already
// follows the cursor.
const originalPanFocus = Camera.panFocus;
Camera.panFocus = function (distance) {
  const degrees = measureFieldOfView() ?? fieldOfViewWeSet;
  const scale = halfTan(degrees) / halfTan(GAME_FIELD_OF_VIEW);
  let { x, y } = distance;
  const heading = isTurned() ? Camera.getState().rotation : 0;
  if (heading !== 0) {
    const turn = heading * Math.PI / 180;
    [x, y] = [x * Math.cos(turn) + y * Math.sin(turn), -x * Math.sin(turn) + y * Math.cos(turn)];
  }
  if (Math.abs(scale - 1) < 0.01 && heading === 0) return originalPanFocus.call(this, distance);
  return originalPanFocus.call(this, { x: x * scale, y: y * scale });
};

// Inside its range the engine zooms on the wheel by itself, as well as passing the
// event to script. Past a limit that's wrong: a notch back toward the range would
// raise the camera and widen the lens at once. So while the lens is past a limit,
// hold the engine's own wheel zoom off. The game uses the same switch to block zoom
// in some views (ViewManager.isWorldZoomAllowed), so keep its wish and apply both.
const originalPreventWheelZoom = Camera.setPreventMouseCameraZoom;
let gamePreventsWheelZoom = false;
let modPreventsWheelZoom = false;
let wheelZoomReleaseToken = 0;

Camera.setPreventMouseCameraZoom = function (prevent) {
  gamePreventsWheelZoom = !!prevent;
  return originalPreventWheelZoom.call(this, gamePreventsWheelZoom || modPreventsWheelZoom);
};

// The engine keeps this switch through a UI reload (an age transition, among others),
// but this script starts over and wouldn't know it had left it on. Start from off;
// the game sets its own wish again on its next view change.
originalPreventWheelZoom.call(Camera, false);

function holdEngineWheelZoom() {
  wheelZoomReleaseToken++;
  if (modPreventsWheelZoom) return;
  modPreventsWheelZoom = true;
  originalPreventWheelZoom.call(Camera, true);
}

// Two frames later, so the notch that brought the view back into range doesn't
// also get the engine's own step.
function releaseEngineWheelZoom() {
  if (!modPreventsWheelZoom) return;
  const token = ++wheelZoomReleaseToken;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (token !== wheelZoomReleaseToken || beyondLimits) return;
    modPreventsWheelZoom = false;
    originalPreventWheelZoom.call(Camera, gamePreventsWheelZoom);
  }));
}

// The lens for a zoom past either limit: going in, the player's close-up reach; going out, a wider lens and the camera
// turning toward straight down.
function lensFor(zoom) {
  if (zoom < 0) {
    // Reading the setting parses the whole shared settings store (half a megabyte or more), too slow for every wheel
    // event. Read it when the close-up starts; the watcher picks up a change in Options after that.
    if (!beyondLimits) closeUpEnd = getCloseUpReach().fieldOfView;
    const share = -zoom / CLOSE_UP.reach;
    return { fieldOfView: closeUpFieldOfView(share, closeUpEnd), tilt: CLOSE_UP.tilt, share };
  }
  const share = (zoom - 1) / FAR_OUT.reach;
  return { fieldOfView: blend(GAME_FIELD_OF_VIEW, FAR_OUT.fieldOfView, share), tilt: FAR_OUT.tilt, share };
}

// setVerticalFoV cancels a zoom that's still moving, and re-sending the same
// zoom every frame restarts its ease so it barely moves. So send the zoom only
// when it changes, and hold the lens until the zoom reaches the limit.
function goToZoom(zoom) {
  requestedZoom = clamp(zoom, -CLOSE_UP.reach, 1 + FAR_OUT.reach);
  if (requestedZoom < 0 || requestedZoom > 1) {
    lensWaitingForZoom = lensFor(requestedZoom);
    beyondLimits = true;
    holdEngineWheelZoom();
  } else {
    if (beyondLimits) lensSettlesAt = performance.now() + LENS_SETTLE_MS;
    returnToGameLens();
  }
  sendEngineZoom(clamp(requestedZoom, 0, 1));
  if (lensWaitingForZoom) applyLensOnceZoomArrives();
  announceSoon();
}

function sendEngineZoom(engineZoom) {
  lastSentAt = performance.now();
  if (engineZoom === lastSentZoom) return;
  lastSentZoom = engineZoom;
  zoomUnderLens = null;
  if (performance.now() < lensSettlesAt) zoomOnceLensSettles();
  else Camera.zoom(engineZoom);
}

// Counts the frames the camera's zoom has stood still.
function stallWatch() {
  return {
    previous: null,
    frames: 0,
    see(zoom) {
      this.frames = this.previous !== null && Math.abs(zoom - this.previous) < 0.0005 ? this.frames + 1 : 0;
      this.previous = zoom;
      return this.frames;
    },
    reset() {
      this.frames = 0;
    },
  };
}

// Whether the game's lens is still easing back in, until the deadline.
function lensStillEasing(deadline) {
  const degrees = measureFieldOfView();
  return (degrees === null || Math.abs(degrees - GAME_FIELD_OF_VIEW) > 0.5) && performance.now() < deadline;
}

// Coming back from past a limit to somewhere else in the game's range in one go (the
// zoom dial does this), the game's lens is still easing back, and a zoom started now
// would be cancelled by it. Send the zoom once the lens has settled, and again if the
// camera stops short.
let lensSettlesAt = 0;
let zoomWaitRunning = false;

function zoomOnceLensSettles() {
  if (zoomWaitRunning) return;
  zoomWaitRunning = true;
  const waitForLens = () => {
    if (beyondLimits) {
      zoomWaitRunning = false;
      return;
    }
    if (lensStillEasing(lensSettlesAt)) {
      requestAnimationFrame(waitForLens);
      return;
    }
    lastSentAt = performance.now();
    Camera.zoom(lastSentZoom);
    followZoomHome();
  };
  requestAnimationFrame(waitForLens);
}

// Watch the camera until it reaches lastSentZoom, sending the zoom once more if it stops short.
function followZoomHome() {
  const stall = stallWatch();
  let resent = false;
  const check = () => {
    if (beyondLimits) {
      zoomWaitRunning = false;
      return;
    }
    const zoom = Camera.getState().zoomLevel;
    const stillFrames = stall.see(zoom);
    const arrived = Math.abs(zoom - lastSentZoom) <= 0.002;
    if (!arrived && stillFrames >= 3 && !resent) {
      resent = true;
      stall.reset();
      lastSentAt = performance.now();
      Camera.zoom(lastSentZoom);
    }
    const gaveUp = (resent && stall.frames >= 3) || performance.now() >= lensSettlesAt + 2000;
    if (!arrived && !gaveUp) {
      requestAnimationFrame(check);
      return;
    }
    zoomWaitRunning = false;
  };
  check();
}

function applyLensOnceZoomArrives() {
  if (lensTimerRunning) return;
  lensTimerRunning = true;
  const giveUpAt = performance.now() + LENS_WAIT_LIMIT_MS;
  const stall = stallWatch();
  let resends = 0;
  const check = () => {
    const zoom = Camera.getState().zoomLevel;
    const stillMoving = Math.abs(zoom - lastSentZoom) > 0.002;
    // A swipe that carries on past a limit gets the engine's own wheel step on its
    // first events, and that can replace our zoom target and leave the camera short
    // of the limit. The engine's step is held off by now, so send ours again.
    const stillFrames = stall.see(zoom);
    if (stillMoving && stillFrames >= 3 && resends < 2) {
      resends++;
      stall.reset();
      Camera.zoom(lastSentZoom);
    }
    if (lensWaitingForZoom && stillMoving && performance.now() < giveUpAt) {
      requestAnimationFrame(check);
      return;
    }
    lensTimerRunning = false;
    applyWaitingLens();
  };
  check();
}

function applyWaitingLens() {
  const lens = lensWaitingForZoom;
  lensWaitingForZoom = null;
  if (!lens) return;
  if (Math.abs(lens.fieldOfView - fieldOfViewWeSet) > 0.01) setFieldOfView(lens.fieldOfView);
  zoomUnderLens = Camera.getState().zoomLevel;
  // Going in keeps the tilt; going out turns it toward straight down.
  setFarOutShare(lens.tilt === null ? 0 : lens.share);
  watchForGameMoves();
}

function returnToGameLens() {
  lensWaitingForZoom = null;
  stopWatchingForGameMoves();
  if (!beyondLimits) return;
  releaseEngineWheelZoom();
  setFieldOfView(GAME_FIELD_OF_VIEW);
  setFarOutShare(0);
  beyondLimits = false;
}

// A lens change cancels a zoom still in motion, so when the lens goes on before the
// zoom arrives the camera stops short of lastSentZoom. Compare against where it stopped.
let zoomUnderLens = null;

function gameMovedZoom(engineZoom) {
  const expected = zoomUnderLens ?? lastSentZoom;
  return Math.abs(engineZoom - expected) > 0.005 && Math.abs(engineZoom - lastSentZoom) > 0.005;
}

// The game can move the camera to a new zoom with our lens still on (a notification,
// Camera.lookAtPlot with a zoom). Nothing tells us, so while the lens is on, check
// ten times a second. A move that keeps the zoom keeps the lens.
const WATCH_EVERY_MS = 100;
let watchTimer = null;
let lensAppliedAt = 0;

function watchForGameMoves() {
  lensAppliedAt = performance.now();
  if (watchTimer !== null) return;
  watchTimer = setInterval(() => {
    if (!beyondLimits) {
      stopWatchingForGameMoves();
      return;
    }
    // The cancelled zoom can still be coming to rest; follow it for a moment.
    if (performance.now() - lensAppliedAt < LENS_SETTLE_MS) {
      if (!lensTimerRunning && zoomUnderLens !== null) zoomUnderLens = Camera.getState().zoomLevel;
      return;
    }
    catchUpWithGame();
  }, WATCH_EVERY_MS);
}

function stopWatchingForGameMoves() {
  if (watchTimer === null) return;
  clearInterval(watchTimer);
  watchTimer = null;
}

function catchUpWithGame() {
  const sinceSent = performance.now() - lastSentAt;
  if (sinceSent < ZOOM_SETTLE_MS || lensTimerRunning) return;
  const engineZoom = Camera.getState().zoomLevel;
  if (gameMovedZoom(engineZoom)) {
    returnToGameLens();
    requestedZoom = lastSentZoom = engineZoom;
    zoomUnderLens = null;
    return;
  }
  // Same zoom, but our lens is gone: something reset it.
  if (beyondLimits && sinceSent > LENS_SETTLE_MS) {
    const degrees = measureFieldOfView();
    if (degrees !== null && Math.abs(degrees - fieldOfViewWeSet) > 1) {
      beyondLimits = false;
      releaseEngineWheelZoom();
      fieldOfViewWeSet = degrees;
      requestedZoom = lastSentZoom;
    }
  }
}

// A held trigger sends START, then UPDATE every frame, then FINISH, with x as the
// deflection. Move at a rate per second while it's held, roughly the game's own
// speed, rather than a whole step per event. The wheel sends FINISH alone and
// keeps its 0.09 notch.
const HELD_ZOOM_PER_SECOND = 4;
const FIRST_HELD_FRAME_SECONDS = 1 / 60;
const LONGEST_HELD_GAP_SECONDS = 0.1;
let inputHeld = false;
let lastHeldEventAt = 0;

function zoomAmountFor(status, deflection) {
  if (status === InputActionStatuses.START || status === InputActionStatuses.UPDATE) {
    const now = performance.now();
    const seconds = inputHeld
      ? Math.min((now - lastHeldEventAt) / 1000, LONGEST_HELD_GAP_SECONDS)
      : FIRST_HELD_FRAME_SECONDS;
    inputHeld = true;
    lastHeldEventAt = now;
    return HELD_ZOOM_PER_SECOND * seconds * (deflection === 0 ? 1 : deflection);
  }
  if (inputHeld) {
    inputHeld = false;
    return 0;
  }
  return BASE_ZOOM_RATE * deflection;
}

// Don't let the requested zoom run far ahead of what's on screen: 0.3 ahead of
// the camera, or one notch ahead of the lens past a limit. A trackpad scroll is a
// stream of full-notch wheel events and would otherwise cross the whole range in
// one swipe, then keep going after the fingers stop.
const MOST_AHEAD_OF_CAMERA = 0.3;
const MOST_AHEAD_OF_LENS = 0.09;

function zoomShownByLens() {
  const degrees = measureFieldOfView();
  if (degrees === null) return requestedZoom;
  if (requestedZoom < 0) {
    return -clamp(closeUpShare(degrees, closeUpEnd), 0, 1) * CLOSE_UP.reach;
  }
  const share = (degrees - GAME_FIELD_OF_VIEW) / (FAR_OUT.fieldOfView - GAME_FIELD_OF_VIEW);
  return 1 + clamp(share, 0, 1) * FAR_OUT.reach;
}

function keepNearView(zoom) {
  if (requestedZoom < 0 || requestedZoom > 1) {
    const shown = zoomShownByLens();
    return clamp(zoom, shown - MOST_AHEAD_OF_LENS, shown + MOST_AHEAD_OF_LENS);
  }
  const shown = Camera.getState().zoomLevel;
  const nearCamera = clamp(zoom, shown - MOST_AHEAD_OF_CAMERA, shown + MOST_AHEAD_OF_CAMERA);
  return clamp(nearCamera, -MOST_AHEAD_OF_LENS, 1 + MOST_AHEAD_OF_LENS);
}

// zoomInProgress belongs to the camera controller: 0 none, 1 in, 2 out.
function handleZoomInput(controller, status, deflection, direction) {
  const opposite = direction < 0 ? 2 : 1;
  if (!ViewManager.isWorldInputAllowed || controller.zoomInProgress === opposite) {
    return;
  }
  controller.zoomInProgress = direction < 0 ? 1 : 2;
  const amount = zoomAmountFor(status, deflection);
  if (amount !== 0) {
    catchUpWithGame();
    goToZoom(keepNearView(requestedZoom + direction * amount));
  }
  if (status === InputActionStatuses.FINISH) {
    controller.zoomInProgress = 0;
  }
}

const controllerPrototype = Object.getPrototypeOf(CameraController);
controllerPrototype.cameraZoomIn = function (status, deflection) { handleZoomInput(this, status, deflection, -1); };
controllerPrototype.cameraZoomOut = function (status, deflection) { handleZoomInput(this, status, deflection, 1); };

// The controller handles a direct pinch itself, setting the zoom from where the
// touch began. Route it through requestedZoom so it can go past the limits too.
let zoomAtPinchStart = null;

// A wheel event with x = 0 had no movement in it: a trackpad's fingers landing,
// resting or lifting, or the end of its momentum. The engine names every one of
// them mousewheel-down whichever way the scroll was going, so a zoom-in springs
// back out. Any real movement, even a fraction of a line, arrives with x of at
// least 1 in its own direction, so the zero events can all go.
function isScrollWithoutMovement(detail) {
  return (detail.name === "mousewheel-up" || detail.name === "mousewheel-down") && !detail.x;
}

const originalHandleInput = controllerPrototype.handleInput;
controllerPrototype.handleInput = function (inputEvent) {
  const detail = inputEvent.detail;
  if (isScrollWithoutMovement(detail)) return InputHandlerState.Handled;
  if (detail.name === "touch-begin") {
    catchUpWithGame();
    zoomAtPinchStart = requestedZoom;
  } else if (detail.name === "touch-pinch-direct" && zoomAtPinchStart !== null) {
    if (ViewManager.isWorldInputAllowed) goToZoom(zoomAtPinchStart + detail.y - detail.x);
    return InputHandlerState.Handled;
  }
  return originalHandleInput.call(this, inputEvent);
};

// City screens frame the city with the game's lens, and on the way out the game
// restores only the zoom level. Drop our lens going in and put it back after.
// The game works out the framing from the lens on screen, and ours takes a moment
// to ease back, so frame the city only once the lens measures as the game's.
const originalZoomToCity = CityZoomer.zoomToCity;
let pendingCityFraming = null;

CityZoomer.zoomToCity = function (city) {
  catchUpWithGame();
  zoomBeforeCityScreen = requestedZoom;
  const lensWasOn = beyondLimits;
  returnToGameLens();
  if (!lensWasOn) return originalZoomToCity(city);
  const framing = { city };
  pendingCityFraming = framing;
  const giveUpAt = performance.now() + LENS_SETTLE_MS;
  const frameOnceLensIsBack = () => {
    if (pendingCityFraming !== framing) return;
    if (lensStillEasing(giveUpAt)) {
      requestAnimationFrame(frameOnceLensIsBack);
      return;
    }
    pendingCityFraming = null;
    originalZoomToCity(city);
  };
  requestAnimationFrame(frameOnceLensIsBack);
};
const originalResetZoom = CityZoomer.resetZoom;
CityZoomer.resetZoom = function () {
  pendingCityFraming = null;
  originalResetZoom();
  const zoom = zoomBeforeCityScreen;
  zoomBeforeCityScreen = null;
  if (zoom === null) return;
  if (zoom < 0 || zoom > 1) {
    goToZoom(zoom);
  } else {
    requestedZoom = lastSentZoom = zoom;
    lastSentAt = performance.now();
  }
};

// The player changed a setting. A new close-up reach applies to the notch the view
// is already on.
window.addEventListener(SETTINGS_CHANGED_EVENT, () => {
  const end = getCloseUpReach().fieldOfView;
  if (end === closeUpEnd) return;
  closeUpEnd = end;
  if (beyondLimits && requestedZoom < 0) goToZoom(requestedZoom);
});

const VIEW_CHANGED_EVENT = "zoom-tilt-rotate-view-changed";

function announceView() {
  const zoom = beyondLimits ? requestedZoom : Camera.getState().zoomLevel;
  const { angle, heading } = currentView();
  const closeUpTimes = zoom < 0
    ? halfTan(GAME_FIELD_OF_VIEW) / halfTan(closeUpFieldOfView(-zoom / CLOSE_UP.reach, closeUpEnd))
    : null;
  window.dispatchEvent(new CustomEvent(VIEW_CHANGED_EVENT, {
    detail: {
      angle: angle === null ? null : Math.round(angle),
      // The angle on screen, the game's own included, for the panel's gauge.
      shownAngle: Math.round(angle ?? measureAngle()),
      heading: Math.round(heading),
      // The zoom on the mod's scale: 0 to 1 is the game's own range, past either end the lens.
      zoom: +zoom.toFixed(3),
      zoomMin: -CLOSE_UP.reach,
      zoomMax: 1 + FAR_OUT.reach,
      closeUpTimes: closeUpTimes === null ? null : +closeUpTimes.toFixed(1),
      beyondLimits,
    },
  }));
}

onViewMoved(announceView);

// For callers that run on every wheel event: one announcement a frame is plenty.
let announcePending = false;
function announceSoon() {
  if (announcePending) return;
  announcePending = true;
  requestAnimationFrame(() => {
    announcePending = false;
    announceView();
  });
}

// North, the game's own angle and the game's own zoom range, all at once.
function backToNormal() {
  resetView();
  if (beyondLimits) goToZoom(requestedZoom < 0 ? 0 : 1);
  easeView();
  announceView();
}

// The zoom buttons: one notch per click, the same as a wheel notch, and repeating
// while held. The dial sends a value straight out.
const ZOOM_REPEAT_MS = 140;
let zoomHold = null;

function stepZoom(direction) {
  catchUpWithGame();
  goToZoom(keepNearView(requestedZoom + direction * BASE_ZOOM_RATE * BASE_ZOOM_RATE));
}

function holdZoom(direction) {
  const token = {};
  zoomHold = token;
  const repeat = () => {
    if (zoomHold !== token) return;
    stepZoom(direction);
    setTimeout(repeat, ZOOM_REPEAT_MS);
  };
  setTimeout(repeat, HOLD_MS);
}

// A tap or a click steps one notch; holding repeats it until let go.
function zoomButton(direction, phase) {
  if (phase === "end") {
    zoomHold = null;
    return;
  }
  if (phase !== "start" && phase !== undefined) return;
  stepZoom(direction);
  if (phase === "start") holdZoom(direction);
}

const VIEW_MOVES = { tiltUp: ["tilt", 1], tiltDown: ["tilt", -1], turnLeft: ["turn", -1], turnRight: ["turn", 1] };

function moveView(action, phase) {
  const [kind, direction] = VIEW_MOVES[action];
  // "start" and "end" come from a held key or button; no phase is a single step.
  if (phase === "start") startGlide(kind, direction);
  else if (phase === "end") endGlide(kind);
  else stepBy(kind, direction);
}

// The panel's dials and sliders set a value straight out; the camera follows quickly.
const COMMANDS = {
  setAngle: (_phase, value) => Number.isFinite(value) && setAngle(value),
  setHeading: (_phase, value) => Number.isFinite(value) && setHeading(value),
  setZoom: (_phase, value) => Number.isFinite(value) && goToZoom(value),
  zoomIn: (phase) => zoomButton(-1, phase),
  zoomOut: (phase) => zoomButton(1, phase),
  backToNormal: () => backToNormal(),
  state: () => announceView(),
};

// The panel and the camera keys send commands as window events, so they never have
// to import this script (which wraps the camera, and must only run once).
window.addEventListener("zoom-tilt-rotate-command", (event) => {
  const { action, phase, value } = event.detail ?? {};
  if (!ViewManager.isWorldInputAllowed && action !== "state") return;
  if (VIEW_MOVES[action]) moveView(action, phase);
  else COMMANDS[action]?.(phase, Number(value));
});
