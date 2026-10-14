// zoom-tilt-rotate-keys-editor.js - the "Camera keys" window, opened from the mod's rows in Options > Add-ons
// the way the game opens its own remapping screen (an OptionType.Editor row). Each action shows its keys and a Change
// button; Change waits for the next combination pressed, Esc stops waiting. A combination already used by another
// action moves to the new one. Every change is saved straight away.

import Panel from "/core/ui/panel-support.js";
import { InputEngineEventName } from "/core/ui/input/input-support.js";
import { FocusManager } from "/core/ui-next/services/focus-manager.js";
import NavTray from "/core/ui/navigation-tray/model-navigation-tray.js";
import {
  KEY_ACTIONS, MODIFIERS, CAPTURING_EVENT, getKeys, setKey, resetKeys, describeCombo, comboFor, refreshSettings,
  localized as loc
} from "/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-settings.js";

const TAG = "zoom-tilt-rotate-keys-editor";

const ACTION_LABELS = {
  tiltUp: ["LOC_ZOOM_TILT_ROTATE_KEY_TILT_UP", "Angle toward the horizon"],
  tiltDown: ["LOC_ZOOM_TILT_ROTATE_KEY_TILT_DOWN", "Angle toward straight down"],
  turnLeft: ["LOC_ZOOM_TILT_ROTATE_KEY_TURN_LEFT", "Turn left"],
  turnRight: ["LOC_ZOOM_TILT_ROTATE_KEY_TURN_RIGHT", "Turn right"],
  backToNormal: ["LOC_ZOOM_TILT_ROTATE_KEY_BACK_TO_NORMAL", "Back to normal"],
  panel: ["LOC_ZOOM_TILT_ROTATE_KEY_PANEL", "Open or close the camera panel"],
};

class ZoomTiltRotateKeysEditor extends Panel {
  rows = {};
  waitingFor = null;
  held = new Set();
  closeListener = () => this.close();
  engineInputListener = this.onEngineInput.bind(this);
  keyDownListener = this.onKeyDown.bind(this);
  keyUpListener = this.onKeyUp.bind(this);

  onInitialize() {
    refreshSettings();
    this.render();
    super.onInitialize();
    this.Root.classList.add("absolute");
  }

  onAttach() {
    super.onAttach();
    this.closeBtn?.addEventListener("action-activate", this.closeListener);
    this.doneBtn?.addEventListener("action-activate", this.closeListener);
    this.Root.addEventListener(InputEngineEventName, this.engineInputListener);
    window.addEventListener("keydown", this.keyDownListener, true);
    window.addEventListener("keyup", this.keyUpListener, true);
  }

  onDetach() {
    this.stopWaiting();
    this.closeBtn?.removeEventListener("action-activate", this.closeListener);
    this.doneBtn?.removeEventListener("action-activate", this.closeListener);
    this.Root.removeEventListener(InputEngineEventName, this.engineInputListener);
    window.removeEventListener("keydown", this.keyDownListener, true);
    window.removeEventListener("keyup", this.keyUpListener, true);
    super.onDetach();
  }

  onReceiveFocus() {
    super.onReceiveFocus();
    if (this.list) FocusManager.get().setFocus(this.list);
    NavTray.addOrUpdateGenericCancel();
  }

  /** Esc or controller B: stop waiting for a key if waiting, otherwise close. */
  onEngineInput(event) {
    if (event?.detail?.status !== InputActionStatuses.FINISH || event.detail.name !== "cancel") return;
    if (this.waitingFor) this.stopWaiting();
    else this.close();
    event.stopPropagation();
    event.preventDefault();
  }

  render() {
    this.Root.innerHTML = `
      <fxs-frame style="width:56rem;">
        <fxs-header title="LOC_ZOOM_TILT_ROTATE_KEYS_TITLE" class="font-title text-xl text-center uppercase tracking-100 pt-4"
          filigree-style="h2"></fxs-header>
        <div data-keys-intro class="px-6 pt-2"></div>
        <fxs-vslot class="px-6 py-3" data-keys-list></fxs-vslot>
        <div data-keys-footer class="flex flex-row justify-center px-6 pt-2 pb-5"></div>
        <fxs-close-button></fxs-close-button>
      </fxs-frame>`;
    this.closeBtn = this.Root.querySelector("fxs-close-button");
    this.list = this.Root.querySelector("[data-keys-list]");
    const intro = this.Root.querySelector("[data-keys-intro]");
    intro.style.cssText = "color:#B9AE96;font-size:1rem;";
    intro.textContent = loc("LOC_ZOOM_TILT_ROTATE_KEYS_INTRO",
      "Press Change, then the keys you want, holding any of Ctrl, Alt (Option on a Mac) and Shift with them. Esc stops waiting.");
    for (const action of KEY_ACTIONS) this.list.appendChild(this.buildRow(action));
    const footer = this.Root.querySelector("[data-keys-footer]");
    const reset = document.createElement("fxs-button");
    reset.setAttribute("caption", loc("LOC_ZOOM_TILT_ROTATE_KEYS_RESET", "Reset keys"));
    reset.addEventListener("action-activate", () => {
      this.stopWaiting();
      resetKeys();
      this.refreshRows();
    });
    const done = document.createElement("fxs-button");
    done.setAttribute("caption", loc("LOC_OPTIONS_CONFIRM_CHANGES", "Confirm Changes"));
    done.style.marginLeft = "1rem";
    this.doneBtn = done;
    footer.append(reset, done);
    this.refreshRows();
  }

  buildRow(action) {
    const line = document.createElement("div");
    line.style.cssText = "display:flex;flex-direction:row;align-items:center;margin:0.35rem 0;";
    const name = document.createElement("div");
    name.style.cssText = "flex:1 1 auto;color:#E5D2AC;font-size:1.05rem;";
    name.textContent = loc(...ACTION_LABELS[action]);
    const combo = document.createElement("div");
    combo.style.cssText = "width:12rem;text-align:center;color:#F4EBD8;font-size:1.05rem;";
    const change = document.createElement("fxs-button");
    change.setAttribute("caption", loc("LOC_ZOOM_TILT_ROTATE_KEYS_CHANGE", "Change"));
    change.addEventListener("action-activate", () => this.startWaiting(action));
    const clear = document.createElement("fxs-button");
    clear.setAttribute("caption", loc("LOC_ZOOM_TILT_ROTATE_KEYS_CLEAR", "Clear"));
    clear.style.marginLeft = "0.5rem";
    clear.addEventListener("action-activate", () => {
      this.stopWaiting();
      setKey(action, "");
      this.refreshRows();
    });
    line.append(name, combo, change, clear);
    this.rows[action] = combo;
    return line;
  }

  refreshRows() {
    const keys = getKeys();
    for (const action of KEY_ACTIONS) {
      const text = this.waitingFor === action
        ? loc("LOC_ZOOM_TILT_ROTATE_KEYS_WAITING", "Press the keys…")
        : describeCombo(keys[action]) || loc("LOC_ZOOM_TILT_ROTATE_KEYS_NONE", "None");
      this.rows[action].textContent = text;
    }
  }

  startWaiting(action) {
    this.waitingFor = action;
    this.held.clear();
    window.dispatchEvent(new CustomEvent(CAPTURING_EVENT, { detail: { on: true } }));
    this.refreshRows();
  }

  stopWaiting() {
    if (!this.waitingFor) return;
    this.waitingFor = null;
    window.dispatchEvent(new CustomEvent(CAPTURING_EVENT, { detail: { on: false } }));
    this.refreshRows();
  }

  onKeyDown(event) {
    if (MODIFIERS.includes(event.code)) {
      this.held.add(event.code);
      return;
    }
    if (!this.waitingFor || event.code === "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    const action = this.waitingFor;
    setKey(action, comboFor(event.code, this.held));
    this.stopWaiting();
  }

  onKeyUp(event) {
    if (MODIFIERS.includes(event.code)) this.held.delete(event.code);
  }
}

Controls.define(TAG, {
  createInstance: ZoomTiltRotateKeysEditor,
  attributes: [{ name: "title" }, { name: "subtitle" }]
});
