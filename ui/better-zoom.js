import CameraController from '/core/ui/camera/camera-controller.js';
import { CityZoomer } from '/base-standard/ui/city-zoomer/city-zoomer.js';
import ViewManager from '/core/ui/views/view-manager.js';
import { InputHandlerState } from '/core/ui/input/input-support.js';

// The game's zoom runs from 0 (closest) to 1 (farthest). Past either end we keep
// going by changing the field of view instead, so requestedZoom runs from
// -CLOSE_UP.reach to 1 + FAR_OUT.reach. A wheel notch is 0.09 (the controller's
// 0.3 rate times 0.3), so a reach of 0.54 is six notches.
//
// Far out, the camera turns to look straight down; with the game's tilt a wide
// lens shows the sky and the edge of the map.
const GAME_FIELD_OF_VIEW = 35;
const CLOSE_UP = { fieldOfView: 5, tilt: null, reach: 0.54 };
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

let requestedZoom = Camera.getState().zoomLevel;
let lastSentZoom = requestedZoom;
let lastSentAt = 0;
let beyondLimits = false;
let zoomBeforeCityScreen = null;
let fieldOfViewWeSet = GAME_FIELD_OF_VIEW;
let lensWaitingForZoom = null;
let lensTimerRunning = false;

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
  return degrees > 1 && degrees < 150 ? degrees : null;
}

// Keyboard, edge and gamepad panning move a fixed distance on the map, which
// gets fast when the lens is narrow. Scale the step by tan(fov / 2), which is how
// the visible width scales. Mouse drag already follows the cursor.
const originalPanFocus = Camera.panFocus;
Camera.panFocus = function (distance) {
  const degrees = measureFieldOfView() ?? fieldOfViewWeSet;
  const scale = Math.tan(degrees * Math.PI / 360) / Math.tan(GAME_FIELD_OF_VIEW * Math.PI / 360);
  const scaled = Math.abs(scale - 1) < 0.01 ? distance : { x: distance.x * scale, y: distance.y * scale };
  return originalPanFocus.call(this, scaled);
};

// setVerticalFoV cancels a zoom that's still moving, and re-sending the same
// zoom every frame restarts its ease so it barely moves. So send the zoom only
// when it changes, and hold the lens until the zoom reaches the limit.
function goToZoom(zoom) {
  requestedZoom = clamp(zoom, -CLOSE_UP.reach, 1 + FAR_OUT.reach);
  if (requestedZoom < 0 || requestedZoom > 1) {
    const end = requestedZoom < 0 ? CLOSE_UP : FAR_OUT;
    const share = requestedZoom < 0 ? -requestedZoom / CLOSE_UP.reach : (requestedZoom - 1) / FAR_OUT.reach;
    lensWaitingForZoom = { fieldOfView: blend(GAME_FIELD_OF_VIEW, end.fieldOfView, share), tilt: end.tilt, share };
    beyondLimits = true;
  } else {
    returnToGameLens();
  }
  const engineZoom = clamp(requestedZoom, 0, 1);
  lastSentAt = performance.now();
  if (engineZoom !== lastSentZoom) {
    lastSentZoom = engineZoom;
    Camera.zoom(engineZoom);
  }
  if (lensWaitingForZoom) applyLensOnceZoomArrives();
}

function applyLensOnceZoomArrives() {
  if (lensTimerRunning) return;
  lensTimerRunning = true;
  const giveUpAt = performance.now() + LENS_WAIT_LIMIT_MS;
  const check = () => {
    const stillMoving = Math.abs(Camera.getState().zoomLevel - lastSentZoom) > 0.002;
    if (lensWaitingForZoom && stillMoving && performance.now() < giveUpAt) {
      requestAnimationFrame(check);
      return;
    }
    lensTimerRunning = false;
    const lens = lensWaitingForZoom;
    lensWaitingForZoom = null;
    if (!lens) return;
    if (Math.abs(lens.fieldOfView - fieldOfViewWeSet) > 0.01) setFieldOfView(lens.fieldOfView);
    // A tilt of null keeps the game's own tilt.
    if (lens.tilt === null) Camera.setTilt(0, 0);
    else Camera.setTilt(lens.tilt, lens.share);
  };
  check();
}

function returnToGameLens() {
  lensWaitingForZoom = null;
  if (!beyondLimits) return;
  setFieldOfView(GAME_FIELD_OF_VIEW);
  Camera.setTilt(0, 0);
  beyondLimits = false;
}

function catchUpWithGame() {
  const sinceSent = performance.now() - lastSentAt;
  if (sinceSent < ZOOM_SETTLE_MS) return;
  const engineZoom = Camera.getState().zoomLevel;
  if (Math.abs(engineZoom - lastSentZoom) > 0.005) {
    returnToGameLens();
    requestedZoom = lastSentZoom = engineZoom;
    return;
  }
  // Same zoom, but our lens is gone: something reset it.
  if (beyondLimits && sinceSent > LENS_SETTLE_MS) {
    const degrees = measureFieldOfView();
    if (degrees !== null && Math.abs(degrees - fieldOfViewWeSet) > 1) {
      beyondLimits = false;
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
    const share = (GAME_FIELD_OF_VIEW - degrees) / (GAME_FIELD_OF_VIEW - CLOSE_UP.fieldOfView);
    return -clamp(share, 0, 1) * CLOSE_UP.reach;
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

// A Mac trackpad scroll ends with a run of wheel events where x is 0, and the
// game reports each one as mousewheel-down, so a zoom-in springs back out. Skip
// zero events for a second after a real one; a wheel that always sends zero
// still works.
const TRACKPAD_TAIL_MS = 1000;
let lastRealScrollAt = -Infinity;

function isTrackpadTail(detail) {
  if (detail.name !== "mousewheel-up" && detail.name !== "mousewheel-down") return false;
  const now = performance.now();
  if (detail.x) {
    lastRealScrollAt = now;
    return false;
  }
  return now - lastRealScrollAt < TRACKPAD_TAIL_MS;
}

const originalHandleInput = controllerPrototype.handleInput;
controllerPrototype.handleInput = function (inputEvent) {
  const detail = inputEvent.detail;
  if (isTrackpadTail(detail)) return InputHandlerState.Handled;
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
const originalZoomToCity = CityZoomer.zoomToCity;
CityZoomer.zoomToCity = function (city) {
  catchUpWithGame();
  zoomBeforeCityScreen = requestedZoom;
  returnToGameLens();
  return originalZoomToCity(city);
};
const originalResetZoom = CityZoomer.resetZoom;
CityZoomer.resetZoom = function () {
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
