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
export const clock = { now: 1000 };
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
    for (const timer of timers.filter((t) => t.at <= clock.now)) {
      if (!timers.includes(timer)) continue;
      if (timer.every) timer.at += timer.every;
      else timers = timers.filter((t) => t !== timer);
      timer.callback();
    }
    const queue = frameQueue;
    frameQueue = [];
    for (const callback of queue) callback();
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
  gameAngle: 37.3,
  zooms: [],
  pans: [],
  wheelZoomHeld: [],
};

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
    camera.zoomLevel = level;
  },
  setVerticalFoV(degrees) {
    camera.fieldOfView = Math.min(Math.max(degrees, 1), 120);
  },
  setTilt(angle, weight) {
    camera.customTilt = angle;
    camera.tiltWeight = weight;
  },
  rotate(heading) {
    camera.rotation = heading;
  },
  restoreDefaults() {
    Object.assign(camera, { fieldOfView: GAME_FIELD_OF_VIEW, customTilt: 0, tiltWeight: 0, rotation: 0 });
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
