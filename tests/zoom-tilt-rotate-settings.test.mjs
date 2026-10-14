import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

// A plain in-memory localStorage; the game's own store is patched by settings-keeper.js, which has its own tests.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key)
};
const changes = [];
globalThis.window = { dispatchEvent: (event) => changes.push(event.detail.key) };
globalThis.CustomEvent = class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

const settings = await import("../ui/zoom-tilt-rotate-settings.js");
const {
  MOD_ID, DEFAULT_KEYS, comboFor, describeCombo, getCloseUpReach, setCloseUpReach, getTurnStep, setTurnStep,
  getAngleStep, setAngleStep, getDialOnScreen, setDialOnScreen, getKeys, setKey, resetKeys, refreshSettings, localized
} = settings;

beforeEach(() => {
  store.clear();
  changes.length = 0;
  refreshSettings();
});

test("with nothing stored, every setting has its default", () => {
  assert.equal(getCloseUpReach().id, "closer");
  assert.equal(getTurnStep(), 45);
  assert.equal(getAngleStep(), 10);
  assert.deepEqual(getKeys(), DEFAULT_KEYS);
  for (const dial of ["zoom", "compass", "angle"]) assert.equal(getDialOnScreen(dial), true);
});

test("a setting is saved, read back, and announced", () => {
  setCloseUpReach("all-the-way");
  setTurnStep(90);
  assert.equal(getCloseUpReach().fieldOfView, 1);
  assert.equal(getTurnStep(), 90);
  refreshSettings();
  assert.equal(getCloseUpReach().id, "all-the-way");
  assert.deepEqual(changes, ["closeUp", "turnStep"]);
});

test("a value outside the choices on offer is ignored", () => {
  setAngleStep(7);
  setCloseUpReach("closest");
  assert.equal(getAngleStep(), 10);
  assert.equal(getCloseUpReach().id, "closer");
  assert.equal(store.size, 0);
});

test("other mods' sections in modSettings are kept", () => {
  store.set("modSettings", JSON.stringify({ "other-mod": { a: 1 } }));
  setTurnStep(90);
  const root = JSON.parse(store.get("modSettings"));
  assert.deepEqual(root["other-mod"], { a: 1 });
  assert.equal(root[MOD_ID].turnStep, 90);
});

test("a store that isn't a settings root is left alone", () => {
  store.set("modSettings", JSON.stringify({ notASection: 5 }));
  setTurnStep(90);
  assert.equal(store.get("modSettings"), JSON.stringify({ notASection: 5 }));
});

test("leaving one dial out keeps the others on", () => {
  setDialOnScreen("compass", false);
  assert.equal(getDialOnScreen("compass"), false);
  assert.equal(getDialOnScreen("zoom"), true);
  assert.equal(getDialOnScreen("angle"), true);
});

test("a combination moves off the action that had it", () => {
  setKey("turnLeft", "Shift+ArrowUp");
  const keys = getKeys();
  assert.equal(keys.turnLeft, "Shift+ArrowUp");
  assert.equal(keys.tiltUp, "");
  resetKeys();
  assert.deepEqual(getKeys(), DEFAULT_KEYS);
});

test("a combination lists its modifiers in a fixed order", () => {
  assert.equal(comboFor("KeyC", new Set(["Shift", "Control"])), "Control+Shift+KeyC");
  assert.equal(describeCombo("Shift+Digit0"), "Shift+0");
  assert.equal(describeCombo("Control+ArrowLeft"), "Ctrl+←");
  assert.equal(describeCombo(""), "");
});

test("text falls back to the English when the tag isn't loaded", () => {
  globalThis.Locale = { compose: (tag) => tag };
  assert.equal(localized("LOC_MISSING", "Fallback"), "Fallback");
  globalThis.Locale = { compose: (_tag, step) => `${step} degrees` };
  assert.equal(localized("LOC_ZOOM_TILT_ROTATE_OPTION_DEGREES", "45°", 45), "45 degrees");
  delete globalThis.Locale;
  assert.equal(localized("LOC_ANYTHING", "Plain"), "Plain");
});
