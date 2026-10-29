// A stand-in for the game the camera scripts run in: a Camera with a field of view, a tilt and a heading that the
// screen picks follow, a window that carries the scripts' events, the map and sprite grids the icon twin draws on, and
// a clock that only moves when a test says so. The game's modules come from tests/stubs/ through tests/loader.mjs.
//
// Import this first, set up the camera if the test needs a different start, then load the script under test with
// import(). A test file gets a fresh copy of everything, but the tests inside it share one.

import { register } from "node:module";

register("./loader.mjs", import.meta.url);

const GAME_FIELD_OF_VIEW = 35;
const rad = (degrees) => degrees * Math.PI / 180;

// The clock: requestAnimationFrame, setTimeout and setInterval run only from frames() and wait(), 16 ms a frame.
export const clock = { now: 1000, frame: 0, inFrame: false };
let frameQueue = [];
let timers = [];
let nextTimerId = 1;

function addTimer(callback, ms, every) {
  const id = nextTimerId++;
  timers.push({ id, callback, at: clock.now + (ms || 0), every });
  return id;
}

globalThis.requestAnimationFrame = (callback) => frameQueue.push(callback);
globalThis.cancelAnimationFrame = () => {};
globalThis.setTimeout = (callback, ms) => addTimer(callback, ms, null);
globalThis.setInterval = (callback, ms) => addTimer(callback, ms, ms);
globalThis.clearTimeout = globalThis.clearInterval = (id) => {
  timers = timers.filter((timer) => timer.id !== id);
};
Object.defineProperty(globalThis, "performance", {
  value: { now: () => clock.now }, configurable: true, writable: true,
});

export function frames(count = 1) {
  for (let i = 0; i < count; i++) {
    clock.now += 16;
    clock.frame += 1;
    swingOneFrame();
    for (const timer of timers.filter((t) => t.at <= clock.now)) {
      if (!timers.includes(timer)) continue;
      if (timer.every) timer.at += timer.every;
      else timers = timers.filter((t) => t !== timer);
      timer.callback();
    }
    const queue = frameQueue;
    frameQueue = [];
    clock.inFrame = true;
    for (const callback of queue) callback();
    clock.inFrame = false;
  }
}

export function wait(ms) {
  const end = clock.now + ms;
  while (clock.now < end) frames(1);
}

// The window: a real EventTarget, the size of the screen every in-game run so far used.
const win = new EventTarget();
win.innerWidth = 2880;
win.innerHeight = 1800;
globalThis.window = win;

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

globalThis.InputActionStatuses = { START: 0, UPDATE: 1, FINISH: 2 };

// The camera. It orbits the point it looks at, which sits at the origin on the ground (z = 0), from a distance that
// grows with the zoom, tipped from straight down by the game's own angle blended toward the custom tilt by its weight.
// Picks are made facing north; the heading only shows in getState(). Engine zooms arrive at once.
export const camera = {
  zoomLevel: 0.5,
  rotation: 0,
  customTilt: 0,
  tiltWeight: 0,
  fieldOfView: GAME_FIELD_OF_VIEW,
  // 0: a lens change lands at once. Otherwise the share of the gap the lens closes each frame, the way the engine
  // eases one (quickly at first).
  lensEase: 0,
  lensTarget: GAME_FIELD_OF_VIEW,
  // 0: a zoom lands at once. Otherwise the share of the gap the zoom closes each frame, and what the engine does to a
  // zoom on its way (devtools/zoom-freeze.js, 2026-10-29): a tilt in the frame it started cancels it, tilts in two
  // frames running hold it still for the next one, and a turn makes it jump to its end. zoomStuck holds every zoom
  // where it is, as the game can.
  zoomEase: 0,
  zoomTarget: 0.5,
  zoomStartFrame: -1,
  lastTiltFrame: -10,
  heldFrame: -1,
  zoomStuck: false,
  zoomCancels: 0,
  zoomJumps: 0,
  gameAngle: 37.3,
  zooms: [],
  pans: [],
  wheelZoomHeld: [],
  swing: null,
};

// The engine's own swing after restoreDefaults() or rotate(0, false): the heading eases to north and, from
// restoreDefaults(), the tilt weight eases to 0, both over SWING_MS. It runs from the clock, a frame at a time.
const SWING_MS = 500;
function startSwing({ rotation, tilt = false }) {
  camera.swing = {
    start: clock.now, fromRotation: camera.rotation, toRotation: rotation, tilt, fromWeight: camera.tiltWeight,
  };
}
const zoomMoving = () => camera.zoomEase > 0 && Math.abs(camera.zoomTarget - camera.zoomLevel) > 1e-4;
// The frame a call belongs to: the one running, or between frames the next one.
const callFrame = () => (clock.inFrame ? clock.frame : clock.frame + 1);

export function swingOneFrame() {
  if (camera.lensEase) camera.fieldOfView += (camera.lensTarget - camera.fieldOfView) * camera.lensEase;
  if (zoomMoving() && camera.heldFrame !== clock.frame && !camera.zoomStuck) {
    camera.zoomLevel += (camera.zoomTarget - camera.zoomLevel) * camera.zoomEase;
    if (Math.abs(camera.zoomTarget - camera.zoomLevel) < 1e-4) camera.zoomLevel = camera.zoomTarget;
  }
  const swing = camera.swing;
  if (!swing) return;
  const share = Math.min(1, (clock.now - swing.start) / SWING_MS);
  camera.rotation = swing.fromRotation + (swing.toRotation - swing.fromRotation) * share;
  if (swing.tilt) camera.tiltWeight = swing.fromWeight * (1 - share);
  if (share === 1) camera.swing = null;
}

const distance = () => 1000 + 2000 * camera.zoomLevel;
export const cameraAngle = () => camera.gameAngle + (camera.customTilt - camera.gameAngle) * camera.tiltWeight;

function eye() {
  const angle = rad(cameraAngle());
  return { x: 0, y: -distance() * Math.sin(angle), z: distance() * Math.cos(angle) };
}

// Where the line of sight through a point on the screen meets the ground, or null above the horizon.
function pickWorldPosFromPoint(x, y) {
  const angle = rad(cameraAngle());
  const from = eye();
  const halfHeight = Math.tan(rad(camera.fieldOfView) / 2);
  const across = (x / (win.innerWidth / 2) - 1) * halfHeight * win.innerWidth / win.innerHeight;
  const up = (1 - y / (win.innerHeight / 2)) * halfHeight;
  const ray = [across, Math.sin(angle) + Math.cos(angle) * up, -Math.cos(angle) + Math.sin(angle) * up];
  if (ray[2] >= 0) return null;
  const reach = -from.z / ray[2];
  return { x: from.x + ray[0] * reach, y: from.y + ray[1] * reach, z: 0 };
}

globalThis.Camera = {
  getState: () => ({
    zoomLevel: camera.zoomLevel, rotation: camera.rotation, customTilt: camera.customTilt, tiltWeight: camera.tiltWeight,
  }),
  zoom(level) {
    camera.zooms.push(level);
    if (!camera.zoomEase) {
      camera.zoomLevel = level;
      return;
    }
    camera.zoomTarget = level;
    camera.zoomStartFrame = callFrame();
  },
  setVerticalFoV(degrees) {
    camera.lensTarget = Math.min(Math.max(degrees, 1), 120);
    if (!camera.lensEase) camera.fieldOfView = camera.lensTarget;
  },
  // Camera.rotate(heading, true) jumps there and holds. Camera.rotate(0, false) lets go: the engine swings the heading
  // back to north over about half a second, as it does after restoreDefaults(). A hold or a new tilt stops the swing.
  rotate(heading, hold) {
    // The mod counts a zoom within 0.002 of where it's going as there; a jump that small doesn't show.
    if (zoomMoving()) {
      if (Math.abs(camera.zoomTarget - camera.zoomLevel) > 0.002) camera.zoomJumps += 1;
      camera.zoomLevel = camera.zoomTarget;
    }
    if (hold) {
      camera.swing = null;
      camera.rotation = heading;
    } else {
      startSwing({ rotation: 0 });
    }
  },
  setTilt(angle, weight) {
    const frame = callFrame();
    if (zoomMoving() && frame === camera.zoomStartFrame) {
      camera.zoomCancels += 1;
      camera.zoomTarget = camera.zoomLevel;
    } else if (zoomMoving() && camera.lastTiltFrame === frame - 1) {
      camera.heldFrame = frame + 1;
    }
    camera.lastTiltFrame = frame;
    if (camera.swing) camera.swing = { ...camera.swing, tilt: false };
    camera.customTilt = angle;
    camera.tiltWeight = weight;
  },
  restoreDefaults() {
    camera.fieldOfView = camera.lensTarget = GAME_FIELD_OF_VIEW;
    startSwing({ rotation: 0, tilt: true });
  },
  panFocus(step) {
    camera.pans.push(step);
  },
  setPreventMouseCameraZoom(prevent) {
    camera.wheelZoomHeld.push(prevent);
  },
  getCurrentPose: () => ({ position: eye(), subject: { x: 0, y: 0, z: 0 } }),
  pickWorldPosFromPoint,
};

// A sprite grid that keeps what's drawn on it.
export const spriteGrids = [];

function spriteGrid(name, mode) {
  const grid = {
    name, mode, visible: true, scale: 1, sprites: [],
    setVisible(visible) { this.visible = visible; },
    isVisible() { return this.visible; },
    addSprite(location, asset, position, options) { this.sprites.push({ location, asset, options }); },
    addSpriteFOW(location, asset, _fow, position, options) { this.sprites.push({ location, asset, options }); },
    addText() {},
    clearPlot(location) {
      this.sprites = this.sprites.filter((s) => s.location.x !== location.x || s.location.y !== location.y);
    },
    clear() { this.sprites = []; },
    setScale(scale) { this.scale = scale; },
    getScale() { return this.scale; },
    destroy() {},
  };
  spriteGrids.push(grid);
  return grid;
}

// A 4 by 3 map with two resources on it.
export const map = { width: 4, height: 3, resources: new Map([["1,1", 7], ["2,0", 9]]) };

globalThis.SpriteMode = { Billboard: "Billboard", FixedBillboard: "FixedBillboard" };
globalThis.WorldUI = { createSpriteGrid: spriteGrid };
globalThis.GameContext = { localPlayerID: 0 };
globalThis.Players = { get: () => ({ isDistantLands: () => false }) };
globalThis.ResourceTypes = { NO_RESOURCE: -1 };
globalThis.GameplayMap = {
  getGridWidth: () => map.width,
  getGridHeight: () => map.height,
  getResourceType: (x, y) => map.resources.get(`${x},${y}`) ?? ResourceTypes.NO_RESOURCE,
  getIndexFromXY: (x, y) => y * map.width + x,
};
globalThis.GameInfo = {
  Resources: { lookup: (type) => ({ ResourceType: `RESOURCE_${type}`, ResourceClassType: "RESOURCECLASS_BONUS" }) },
};

// Sends what the camera keys and the panel send.
export function command(action, phase, value) {
  window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, phase, value } }));
}

// What zoom-tilt-rotate.js last told the panel.
export const views = [];
window.addEventListener("zoom-tilt-rotate-view-changed", (event) => views.push(event.detail));
export const lastView = () => views.at(-1);

export const halfTan = (degrees) => Math.tan(rad(degrees) / 2);
