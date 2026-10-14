// zoom-tilt-rotate-settings.js - the player's choices: how close the zoom goes, the camera's angle and
// turn steps, and the camera keys.
//
// The values live in the shared "modSettings" localStorage entry under the mod's id, the store Tower's other mods
// use (settings-keeper.js makes it survive a restart). They're view preferences, so none of it goes into the save.
// That entry holds every mod's data and runs to half a megabyte or more, so a read costs several milliseconds:
// read it once, keep the values here, and read again only when told something changed. A write here sends
// SETTINGS_CHANGED_EVENT on the window so the rest of the mod picks it up.
//
// It also holds localized(), the text lookup every script here shares.

export const MOD_ID = "tmt-zoom-tilt-rotate";

/**
 * The text for a LOC tag, or the English given beside it. The game reads the mod's text file only at startup, so a
 * row added since (or a language without these lines) would otherwise show its bare tag.
 */
export function localized(tag, english, ...args) {
  try {
    const text = Locale.compose(tag, ...args);
    if (text && text !== tag) return text;
  } catch (_) {
    /* fall through to the English */
  }
  return english;
}
export const SETTINGS_CHANGED_EVENT = "zoom-tilt-rotate-settings-changed";

// The field of view at the end of the six close-up notches. The engine won't go under 1 degree.
export const CLOSE_UP_REACHES = [
  { id: "closer", fieldOfView: 5 },
  { id: "much-closer", fieldOfView: 2 },
  { id: "all-the-way", fieldOfView: 1 },
];
export const TURN_STEPS = [45, 90];
export const ANGLE_STEPS = [5, 10, 15];

// The camera keys. A binding is the held modifiers and the key's code, as the page reports them, joined by "+":
// "Shift+ArrowUp". The order of KEY_ACTIONS is the order they're listed in. The defaults use Shift: the game ignores
// Shift with these keys, Alt (Option) is the game's own camera key and letting go of it turns the view back to
// north, and on a Mac Ctrl with the arrows belongs to Mission Control.
export const KEY_ACTIONS = ["tiltUp", "tiltDown", "turnLeft", "turnRight", "backToNormal", "panel"];
export const DEFAULT_KEYS = {
  tiltUp: "Shift+ArrowUp",
  tiltDown: "Shift+ArrowDown",
  turnLeft: "Shift+ArrowLeft",
  turnRight: "Shift+ArrowRight",
  backToNormal: "Shift+Digit0",
  panel: "Shift+KeyC",
};

// The page names the modifier keys "Control", "Alt", "Shift" and "Meta"; a combination lists them in this order.
export const MODIFIERS = ["Control", "Alt", "Shift", "Meta"];

// Sent while the key editor waits for a combination, so the camera keys stand aside.
export const CAPTURING_EVENT = "zoom-tilt-rotate-capturing";

/** The combination for a key press, with the modifiers held right now. */
export function comboFor(code, modifiers) {
  return [...MODIFIERS.filter((m) => modifiers.has(m)), code].join("+");
}

const IS_MAC = (() => {
  try {
    return /mac/i.test(navigator.platform || navigator.userAgent || "");
  } catch (_) {
    return false;
  }
})();

// Keys whose printed name differs between keyboards (Ctrl is Strg on a German one), as LOC tags with the English.
const NAMED_KEYS = {
  Alt: IS_MAC ? ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_OPTION", "Option"] : ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_ALT", "Alt"],
  Control: ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_CTRL", "Ctrl"],
  Shift: ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_SHIFT", "Shift"],
  Meta: IS_MAC ? ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_CMD", "Cmd"] : ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_WIN", "Win"],
  Space: ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_SPACE", "Space"],
  Escape: ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_ESC", "Esc"],
  Backspace: ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_BACKSPACE", "Backspace"],
  Enter: ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_ENTER", "Enter"],
  Tab: ["LOC_ZOOM_TILT_ROTATE_KEY_NAME_TAB", "Tab"],
};

// Keys printed the same everywhere.
const SYMBOL_KEYS = {
  ArrowUp: "\u2191", ArrowDown: "\u2193", ArrowLeft: "\u2190", ArrowRight: "\u2192",
  Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Comma: ",", Period: ".", Slash: "/",
  Semicolon: ";", Quote: "'", Backquote: "`", Backslash: "\\",
};

function keyName(code) {
  if (NAMED_KEYS[code]) return localized(...NAMED_KEYS[code]);
  if (SYMBOL_KEYS[code]) return SYMBOL_KEYS[code];
  if (code.startsWith("Numpad")) {
    return localized("LOC_ZOOM_TILT_ROTATE_KEY_NAME_NUMPAD", `Num ${code.slice(6)}`, code.slice(6));
  }
  return code.replace(/^Key/, "").replace(/^Digit/, "");
}

/** A combination as a person reads it: "Option+\u2191". "" reads as "". */
export function describeCombo(combo) {
  if (!combo) return "";
  return combo.split("+").map(keyName).join("+");
}

const DEFAULTS = { closeUp: CLOSE_UP_REACHES[0].id, turnStep: 45, angleStep: 10 };

let cached = null;

function readSection() {
  try {
    const section = JSON.parse(localStorage.getItem("modSettings") || "null")?.[MOD_ID];
    return section && typeof section === "object" ? section : {};
  } catch (_) {
    return {};
  }
}

function section() {
  if (cached === null) cached = readSection();
  return cached;
}

/** Read the store again, for when another script context may have written it. */
export function refreshSettings() {
  cached = readSection();
}

/**
 * The shared entry, for a write. getItem() can return the first key in the store instead of the one asked for, so a
 * write goes ahead only when what came back looks like a settings root ({ "<modId>": {...}, ... }), never over
 * another mod's data.
 */
function sharedForWrite() {
  let raw = null;
  try {
    raw = localStorage.getItem("modSettings");
    if (!raw) raw = localStorage.getItem("modSettings"); // a first read can come back empty
  } catch (_) {
    return { root: {}, safe: false };
  }
  if (!raw) return { root: {}, safe: true };
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return { root: {}, safe: false };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { root: {}, safe: false };
  const root = Object.keys(parsed).every((k) => !!parsed[k] && typeof parsed[k] === "object" && !Array.isArray(parsed[k]));
  return root ? { root: parsed, safe: true } : { root: {}, safe: false };
}

function write(key, value) {
  try {
    const { root, safe } = sharedForWrite();
    if (!safe) return;
    const mine = (root[MOD_ID] ??= {});
    if (value === undefined) delete mine[key];
    else mine[key] = value;
    localStorage.setItem("modSettings", JSON.stringify(root));
    cached = { ...mine };
  } catch (_) {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: { key } }));
  } catch (_) {
    /* no window */
  }
}

/** @returns {{id: string, fieldOfView: number}} The close-up reach the player picked, else "Closer". */
export function getCloseUpReach() {
  const id = section().closeUp ?? DEFAULTS.closeUp;
  return CLOSE_UP_REACHES.find((reach) => reach.id === id) ?? CLOSE_UP_REACHES[0];
}

export function setCloseUpReach(id) {
  if (CLOSE_UP_REACHES.some((reach) => reach.id === id)) write("closeUp", id);
}

/** @returns {number} Degrees per press of a turn key. */
export function getTurnStep() {
  const step = section().turnStep;
  return TURN_STEPS.includes(step) ? step : DEFAULTS.turnStep;
}

export function setTurnStep(step) {
  if (TURN_STEPS.includes(step)) write("turnStep", step);
}

/** @returns {number} Degrees per press of an angle key. */
export function getAngleStep() {
  const step = section().angleStep;
  return ANGLE_STEPS.includes(step) ? step : DEFAULTS.angleStep;
}

export function setAngleStep(step) {
  if (ANGLE_STEPS.includes(step)) write("angleStep", step);
}

/** @returns {boolean} Whether the compass and angle dials sit on screen at the top left. */
export function getShowDials() {
  return section().showDials === true;
}

export function setShowDials(show) {
  write("showDials", !!show);
}

// Each dial on screen can be left out on its own; all three show by default.
export const SCREEN_DIALS = ["zoom", "compass", "angle"];

/** @returns {boolean} Whether this dial is among those on screen (when the dials are shown at all). */
export function getDialOnScreen(dial) {
  return section().dialsOnScreen?.[dial] !== false;
}

export function setDialOnScreen(dial, show) {
  if (!SCREEN_DIALS.includes(dial)) return;
  const dials = {};
  for (const name of SCREEN_DIALS) dials[name] = getDialOnScreen(name);
  dials[dial] = !!show;
  write("dialsOnScreen", dials);
}

/** @returns {Record<string, string>} Every action's binding; "" means the action has no key. */
export function getKeys() {
  const saved = section().keys;
  const keys = { ...DEFAULT_KEYS };
  if (saved && typeof saved === "object") {
    for (const action of KEY_ACTIONS) if (typeof saved[action] === "string") keys[action] = saved[action];
  }
  return keys;
}

/** Bind an action to a combination, taking the combination off any other action that had it. */
export function setKey(action, combo) {
  if (!KEY_ACTIONS.includes(action)) return;
  const keys = getKeys();
  for (const other of KEY_ACTIONS) if (other !== action && keys[other] === combo) keys[other] = "";
  keys[action] = combo;
  write("keys", keys);
}

export function resetKeys() {
  write("keys", undefined);
}
