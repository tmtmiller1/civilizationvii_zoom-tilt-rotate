// zoom-tilt-rotate-keys.js - the camera keys: turn the view, change its angle, go back to normal, open the panel.
//
// The game's page never sets altKey, ctrlKey or shiftKey on a key event, but the modifier keys arrive as key
// events of their own (code "Alt", "Control", "Shift", "Meta"), so the held set is tracked here. A combination
// is the held modifiers in a fixed order plus the key's code: "Shift+ArrowUp". The game ignores the arrows while
// a modifier is held, so the default combinations don't pan the map as well.

import {
  getKeys, refreshSettings, comboFor, MODIFIERS, CAPTURING_EVENT, SETTINGS_CHANGED_EVENT
} from "/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-settings.js";

const held = new Set();
let actionByCombo = new Map();
let capturing = false;
// The angle or turn key being held: it glides until the key or one of its modifiers comes up.
let holding = null;

const GLIDES = ["tiltUp", "tiltDown", "turnLeft", "turnRight"];
const send = (action, phase) =>
  window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, phase } }));

function letGo() {
  if (!holding) return;
  send(holding.action, "end");
  holding = null;
}

function loadKeys() {
  actionByCombo = new Map();
  for (const [action, combo] of Object.entries(getKeys())) if (combo) actionByCombo.set(combo, action);
}

function isTyping(target) {
  const tag = target?.tagName?.toLowerCase?.() ?? "";
  return tag === "input" || tag === "textarea" || tag === "fxs-textbox";
}

function onKeyDown(event) {
  const code = event.code;
  if (MODIFIERS.includes(code)) {
    held.add(code);
    return;
  }
  if (capturing || isTyping(event.target)) return;
  const action = actionByCombo.get(comboFor(code, held));
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) runAction(action, code);
}

function runAction(action, code) {
  if (action === "panel") {
    window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-panel-toggle"));
  } else if (GLIDES.includes(action)) {
    letGo();
    holding = { action, code, modifiers: [...held] };
    send(action, "start");
  } else {
    send(action);
  }
}

function onKeyUp(event) {
  if (MODIFIERS.includes(event.code)) held.delete(event.code);
  if (holding && (event.code === holding.code || holding.modifiers.includes(event.code))) letGo();
}

try {
  loadKeys();
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  // A modifier let go while the game was in the background never sends its key up.
  window.addEventListener("blur", () => {
    held.clear();
    letGo();
  });
  window.addEventListener(SETTINGS_CHANGED_EVENT, loadKeys);
  window.addEventListener(CAPTURING_EVENT, (event) => {
    capturing = !!event.detail?.on;
    if (!capturing) {
      refreshSettings();
      loadKeys();
    }
  });
} catch (e) {
  console.error("[Zoom, Tilt, & Rotate] Camera keys not set up: " + e);
}
