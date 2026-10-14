// zoom-tilt-rotate-panel.js - the camera panel: a compass and an angle gauge showing where the view faces and how far
// it tips, buttons and sliders to change them, "Back to normal", and the keys that do the same. A camera button joins
// the minimap's button row (the lens and radial buttons); the panel key (Shift+C by default) opens it too. It sits
// beside the minimap, built from the same pieces as the game's own lens panel there: its frame, fxs-header section
// titles with the fleur filigree, fxs-slider, fxs-button and fxs-close-button.
//
// It never touches the camera itself: controls send the same "zoom-tilt-rotate-command" events the keys send, and
// zoom-tilt-rotate.js answers with "zoom-tilt-rotate-view-changed".

import ViewManager from "/core/ui/views/view-manager.js";
import { ContextManager } from "/core/ui/context-manager/context-manager.js";
import {
  getTurnStep, getAngleStep, getShowDials, getDialOnScreen, localized as loc, SCREEN_DIALS, SETTINGS_CHANGED_EVENT
} from "/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-settings.js";

const BUTTON_ID = "zoom-tilt-rotate-camera-button";
const PANEL_ID = "zoom-tilt-rotate-camera-panel";
const HUD_ID = "zoom-tilt-rotate-camera-dials";
const MOST_ANGLE = 80;

const command = (action, detail = {}) =>
  window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, ...detail } }));
const GLIDES = ["tiltUp", "tiltDown", "turnLeft", "turnRight", "zoomIn", "zoomOut"];

// Drawn in the game's cream and gold. The page doesn't draw inline SVG images, and its font has no turn arrows, so
// these are files.
const ICONS = "fs://game/tmt-zoom-tilt-rotate/icons/";

// The eight compass points, clockwise from north.
const HEADINGS = [
  ["LOC_ZOOM_TILT_ROTATE_FACING_NORTH", "Facing north"],
  ["LOC_ZOOM_TILT_ROTATE_FACING_NORTH_EAST", "Facing north-east"],
  ["LOC_ZOOM_TILT_ROTATE_FACING_EAST", "Facing east"],
  ["LOC_ZOOM_TILT_ROTATE_FACING_SOUTH_EAST", "Facing south-east"],
  ["LOC_ZOOM_TILT_ROTATE_FACING_SOUTH", "Facing south"],
  ["LOC_ZOOM_TILT_ROTATE_FACING_SOUTH_WEST", "Facing south-west"],
  ["LOC_ZOOM_TILT_ROTATE_FACING_WEST", "Facing west"],
  ["LOC_ZOOM_TILT_ROTATE_FACING_NORTH_WEST", "Facing north-west"],
];

const degreesText = (degrees) => loc("LOC_ZOOM_TILT_ROTATE_OPTION_DEGREES", `${degrees}\u00b0`, degrees);

function headingText(heading) {
  if (heading % 45 !== 0) return degreesText((heading + 360) % 360);
  return loc(...HEADINGS[((Math.round(heading / 45) % 8) + 8) % 8]);
}

// The angle on screen: the player's, or the game's own as measured when the player hasn't set one.
function shownAngle() {
  return view.angle ?? view.shownAngle;
}

function angleText() {
  const angle = shownAngle();
  return loc("LOC_ZOOM_TILT_ROTATE_ANGLE_FROM_DOWN", `${angle}° (from straight down)`, angle);
}

let panel = null;
let view = { angle: null, shownAngle: 45, heading: 0, zoom: 0.5, zoomMin: -0.54, zoomMax: 1.54, closeUpTimes: null };

function zoomText() {
  if (view.zoom < 0 && view.closeUpTimes) {
    return loc("LOC_ZOOM_TILT_ROTATE_ZOOM_CLOSER", `${view.closeUpTimes}x closer`, view.closeUpTimes);
  }
  if (view.zoom > 1) return loc("LOC_ZOOM_TILT_ROTATE_ZOOM_FAR", "Far out");
  return loc("LOC_ZOOM_TILT_ROTATE_ZOOM_NORMAL", "Normal zoom");
}

function element(tag, classes = "", text = null) {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text !== null) node.textContent = text;
  return node;
}

function picture(file, size) {
  const node = element("div", "pointer-events-none");
  node.style.cssText = `width:${size}rem;height:${size}rem;background-image:url("${ICONS}${file}");` +
    "background-size:contain;background-repeat:no-repeat;background-position:center;";
  return node;
}

// A round button in the style of the minimap's own: the game's button background with a glyph or an icon on it.
// The four angle and turn buttons glide while pressed and step on a click.
function roundButton(action, tooltip, glyph = null, iconFile = null) {
  const button = element("fxs-activatable", "relative pointer-events-auto cursor-pointer");
  button.setAttribute("data-tooltip-content", tooltip);
  button.style.cssText = "width:2.6rem;height:2.6rem;display:flex;align-items:center;justify-content:center;";
  const background = element("div", "mini-map__lens-button__bg pointer-events-none absolute inset-0");
  button.appendChild(background);
  if (iconFile) {
    // Above the background, which is positioned and would otherwise draw over it.
    const icon = picture(iconFile, 1.35);
    icon.style.position = "relative";
    button.appendChild(icon);
  } else {
    button.appendChild(element("div", "relative font-title text-lg text-secondary pointer-events-none", glyph));
  }
  if (GLIDES.includes(action)) glideWhilePressed(button, action);
  else button.addEventListener("action-activate", () => command(action));
  return button;
}

// Pressing the button starts a glide and letting go ends it. A mouse click also sends action-activate, so skip that
// one; a controller or keyboard activation still steps.
function glideWhilePressed(button, action) {
  let pressed = false, lastMouseAt = -Infinity;
  const release = () => {
    if (!pressed) return;
    pressed = false;
    lastMouseAt = performance.now();
    command(action, { phase: "end" });
  };
  button.addEventListener("mousedown", () => {
    pressed = true;
    command(action, { phase: "start" });
  });
  button.addEventListener("mouseup", release);
  button.addEventListener("mouseleave", release);
  button.addEventListener("action-activate", () => {
    if (performance.now() - lastMouseAt > 500) command(action);
  });
}

// The game's section title: the title font in gold, with the fleur filigree either side.
function sectionTitle(tag, fallback) {
  const header = element("fxs-header", "mb-2 mt-1 font-title-base text-secondary uppercase tracking-100 text-center justify-center");
  header.setAttribute("title", loc(tag, fallback));
  header.setAttribute("filigree-style", "h4");
  return header;
}

// The game's slider. Moving it sends a value. The slider also reports its own starting value when it's added to
// the page, and reports a value it's given from the camera a moment later as if it had been moved; neither may act
// as the player's input. So it stays quiet until it has been shown a value, and ignores any value it was shown in
// the last second.
function slider(min, max, onChange) {
  const control = element("fxs-slider", "pointer-events-auto");
  control.setAttribute("min", String(min));
  control.setAttribute("max", String(max));
  control.setAttribute("steps", "0");
  control.style.width = "15rem";
  let ready = false;
  const shown = [];
  control.addEventListener("component-value-changed", (event) => {
    const value = Math.round(event.detail?.value);
    if (!ready || !Number.isFinite(value)) return;
    const now = performance.now();
    if (shown.some((entry) => entry.value === value && now - entry.at < 1000)) return;
    onChange(value);
  });
  control.show = (value) => {
    ready = true;
    const now = performance.now();
    while (shown.length && now - shown[0].at > 1000) shown.shift();
    shown.push({ value, at: now });
    control.setAttribute("value", String(value));
  };
  return control;
}

// Press on a dial and drag to set it; a click sets it where you click. Points are sent at most once a frame, and the
// map below never sees the press because the dial is UI.
function dragOn(node, onPoint) {
  node.classList.remove("pointer-events-none");
  node.classList.add("pointer-events-auto", "cursor-pointer");
  let dragging = false, pending = null;
  const flush = () => {
    if (pending) onPoint(...pending);
    pending = null;
  };
  const point = (event) => {
    if (!pending) requestAnimationFrame(flush);
    pending = [event.clientX, event.clientY, node.getBoundingClientRect()];
  };
  node.addEventListener("mousedown", (event) => {
    dragging = true;
    point(event);
    event.stopPropagation();
  });
  window.addEventListener("mousemove", (event) => {
    if (dragging) point(event);
  }, true);
  window.addEventListener("mouseup", () => {
    dragging = false;
  }, true);
}

// The compass: the needle points where the view faces. Drag around it to turn the view.
function compassDial(size) {
  const dial = element("div", "relative pointer-events-none");
  dial.style.cssText = `width:${size}rem;height:${size}rem;`;
  const ring = picture("compass-ring.png", size);
  ring.style.position = "absolute";
  const needle = picture("compass-needle.png", size);
  needle.style.position = "absolute";
  dial.append(ring, needle);
  dial.setAttribute("data-tooltip-content", loc("LOC_ZOOM_TILT_ROTATE_TIP_COMPASS", "Drag around the compass to turn the view."));
  dragOn(dial, (x, y, rect) => {
    const dx = x - (rect.left + rect.width / 2), dy = y - (rect.top + rect.height / 2);
    if (Math.hypot(dx, dy) < rect.width * 0.08) return;
    command("setHeading", { value: Math.round(Math.atan2(dx, -dy) * 180 / Math.PI) });
  });
  dial.update = () => {
    needle.style.transform = `rotate(${view.heading}deg)`;
  };
  return dial;
}

// The angle gauge: a quarter arc from straight down to the horizon. Drag along it to tip the camera.
function angleDial(size) {
  const dial = element("div", "relative pointer-events-none");
  dial.style.cssText = `width:${size}rem;height:${size}rem;`;
  const arc = picture("angle-gauge.png", size);
  arc.style.position = "absolute";
  const pointer = picture("angle-needle.png", size);
  pointer.style.position = "absolute";
  // The needle image hangs from the gauge's pivot, 110/512 of the way across and down.
  pointer.style.transformOrigin = "21.5% 21.5%";
  dial.append(arc, pointer);
  dial.setAttribute("data-tooltip-content", loc("LOC_ZOOM_TILT_ROTATE_TIP_GAUGE", "Drag along the gauge to tip the camera."));
  dragOn(dial, (x, y, rect) => {
    const dx = x - (rect.left + rect.width * 0.215), dy = y - (rect.top + rect.height * 0.215);
    if (Math.hypot(dx, dy) < rect.width * 0.08) return;
    const degrees = Math.atan2(Math.max(dx, 0), Math.max(dy, 0)) * 180 / Math.PI;
    command("setAngle", { value: Math.round(Math.min(Math.max(degrees, 0), MOST_ANGLE)) });
  });
  dial.update = () => {
    pointer.style.transform = `rotate(${-view.shownAngle}deg)`;
  };
  return dial;
}

// The zoom gauge: a half arc from the closest close-up (left) to the farthest view (right), the game's own range
// in gold in the middle. Drag along it to zoom.
function zoomDial(size) {
  const dial = element("div", "relative pointer-events-none");
  dial.style.cssText = `width:${size}rem;height:${size}rem;`;
  const arc = picture("zoom-gauge.png", size);
  arc.style.position = "absolute";
  const pointer = picture("zoom-needle.png", size);
  pointer.style.position = "absolute";
  // The needle stands on the gauge's pivot, halfway across and 70% of the way down.
  pointer.style.transformOrigin = "50% 70%";
  dial.append(arc, pointer);
  dial.setAttribute("data-tooltip-content", loc("LOC_ZOOM_TILT_ROTATE_TIP_ZOOM_GAUGE", "Drag along the gauge to zoom."));
  dragOn(dial, (x, y, rect) => {
    const dx = x - (rect.left + rect.width / 2), dy = y - (rect.top + rect.height * 0.7);
    if (Math.hypot(dx, dy) < rect.width * 0.08) return;
    const degrees = Math.min(Math.max(Math.atan2(dx, -dy) * 180 / Math.PI, -90), 90);
    command("setZoom", { value: view.zoomMin + (degrees + 90) / 180 * (view.zoomMax - view.zoomMin) });
  });
  dial.update = () => {
    const share = (view.zoom - view.zoomMin) / (view.zoomMax - view.zoomMin);
    pointer.style.transform = `rotate(${-90 + Math.min(Math.max(share, 0), 1) * 180}deg)`;
  };
  return dial;
}

// A dial with its step buttons either side.
function dialRow(minus, dial, plus) {
  const row = element("div");
  row.style.cssText = "display:flex;flex-direction:row;align-items:center;justify-content:center;";
  dial.style.margin = "0 1.1rem";
  row.append(minus, dial, plus);
  return row;
}

// The game's quiet text button (title font, a soft glow on hover), for actions that shouldn't shout.
function textButton(caption, tooltip, onActivate, fontSize = "0.85rem") {
  const button = element("fxs-text-button", "uppercase pointer-events-auto");
  button.setAttribute("caption", caption);
  button.setAttribute("data-tooltip-content", tooltip);
  button.style.cssText = `font-size:${fontSize};padding:0.15rem 0.6rem;`;
  button.addEventListener("action-activate", onActivate);
  return button;
}

function backToNormalButton(fontSize) {
  return textButton(loc("LOC_ZOOM_TILT_ROTATE_BACK_TO_NORMAL", "Back to normal"),
    loc("LOC_ZOOM_TILT_ROTATE_BACK_TO_NORMAL_TIP", "Face north, use the game's own angle, and come back inside the game's zoom range."),
    () => command("backToNormal"), fontSize);
}

// The game's text button gives its caption a minimum width and wide letter spacing meant for the main menu. In
// this panel two of them sit side by side, so size them to their words.
function addPanelStyle() {
  if (document.getElementById(`${PANEL_ID}-style`)) return;
  const style = document.createElement("style");
  style.id = `${PANEL_ID}-style`;
  style.textContent = `#${PANEL_ID} .text-button__label, #${HUD_ID} .text-button__label ` +
    "{ min-width: 0 !important; letter-spacing: 0.1rem !important; }";
  document.head.appendChild(style);
}

// One of the panel's three sections: its title, the dial between its step buttons, what it reads, and its slider.
function panelSection(titleTag, titleText, [minus, dial, plus], control) {
  const value = element("div", "font-body text-base text-accent-1 text-center");
  value.style.marginTop = "0.35rem";
  control.style.alignSelf = "center";
  return { value, parts: [sectionTitle(titleTag, titleText), dialRow(minus, dial, plus), value, control] };
}

// Back to normal and Camera keys side by side under a thin gold rule.
function panelFooter() {
  const normal = backToNormalButton();
  // The keys live in their own window, where they can also be changed.
  const keys = textButton(loc("LOC_ZOOM_TILT_ROTATE_OPTION_KEYS", "Camera keys"),
    loc("LOC_ZOOM_TILT_ROTATE_PANEL_KEYS_TIP", "See the keys for turning, tipping, going back to normal and this panel, and change them."),
    () => ContextManager.push("zoom-tilt-rotate-keys-editor", { singleton: true, createMouseGuard: true }));
  const rule = element("div");
  rule.style.cssText = "height:0.0625rem;margin:0.9rem 1.5rem 0.5rem 1.5rem;" +
    "background-image:linear-gradient(to right, rgba(196,163,98,0), rgba(196,163,98,0.55), rgba(196,163,98,0));";
  const divider = element("div", "font-title text-secondary", "\u00b7");
  divider.style.cssText = "margin:0 0.3rem;opacity:0.7;";
  const row = element("div");
  row.style.cssText = "display:flex;flex-direction:row;align-items:center;justify-content:center;";
  row.append(normal, divider, keys);
  const footer = element("div");
  footer.style.cssText = "display:flex;flex-direction:column;";
  footer.append(rule, row);
  return footer;
}

function panelBox() {
  const box = element("div", "pointer-events-auto");
  box.id = PANEL_ID;
  box.style.cssText = "position:absolute;z-index:10;width:22rem;padding:1.3rem 1.4rem 1.1rem 1.4rem;" +
    "border:0.0625rem solid rgba(196,163,98,0.45);border-radius:0.35rem;" +
    "background-image:linear-gradient(to bottom, rgba(35,37,43,0.95), rgba(18,21,31,0.92));";
  const close = element("fxs-close-button");
  close.style.cssText = "position:absolute;top:0.3rem;right:0.3rem;";
  close.addEventListener("action-activate", () => togglePanel(false));
  box.appendChild(close);
  return box;
}

function buildPanel() {
  addPanelStyle();
  const angleStep = getAngleStep(), turnStep = getTurnStep();
  const zoomGauge = zoomDial(6.5), compass = compassDial(6.5), gauge = angleDial(6.5);
  const zoomSlider = slider(-54, 154, (value) => command("setZoom", { value: value / 100 }));
  const headingSlider = slider(-180, 180, (value) => command("setHeading", { value }));
  const angleSlider = slider(0, MOST_ANGLE, (value) => command("setAngle", { value }));

  // Zoom: the whole range, the mod's close-up and far-out ends included.
  const zoom = panelSection("LOC_ZOOM_TILT_ROTATE_PANEL_ZOOM", "Zoom", [
    roundButton("zoomIn", loc("LOC_ZOOM_TILT_ROTATE_TIP_ZOOM_IN", "Zoom in one notch. Hold to keep zooming."), "+"),
    zoomGauge,
    roundButton("zoomOut", loc("LOC_ZOOM_TILT_ROTATE_TIP_ZOOM_OUT", "Zoom out one notch. Hold to keep zooming."), "\u2212")
  ], zoomSlider);
  // Heading: a compass whose needle shows where the view faces.
  const heading = panelSection("LOC_ZOOM_TILT_ROTATE_PANEL_HEADING", "Heading", [
    roundButton("turnLeft", loc("LOC_ZOOM_TILT_ROTATE_TIP_TURN_LEFT", `Turn ${turnStep}° left. Hold to keep turning.`, turnStep), null, "turn-left.png"),
    compass,
    roundButton("turnRight", loc("LOC_ZOOM_TILT_ROTATE_TIP_TURN_RIGHT", `Turn ${turnStep}° right. Hold to keep turning.`, turnStep), null, "turn-right.png")
  ], headingSlider);
  // Angle: a quarter arc from straight down to the horizon, with a needle at the camera's angle.
  const angle = panelSection("LOC_ZOOM_TILT_ROTATE_PANEL_ANGLE", "Angle", [
    roundButton("tiltDown", loc("LOC_ZOOM_TILT_ROTATE_TIP_TILT_DOWN", `Look ${angleStep}° more straight down. Hold to keep going.`, angleStep), "−"),
    gauge,
    roundButton("tiltUp", loc("LOC_ZOOM_TILT_ROTATE_TIP_TILT_UP", `Look ${angleStep}° more toward the horizon. Hold to keep going.`, angleStep), "+")
  ], angleSlider);

  const body = element("div");
  body.style.cssText = "display:flex;flex-direction:column;";
  body.append(...zoom.parts, ...heading.parts, ...angle.parts, panelFooter());
  const box = panelBox();
  box.insertBefore(body, box.firstChild);

  box.refresh = () => {
    zoomGauge.update();
    compass.update();
    gauge.update();
    zoom.value.textContent = zoomText();
    zoomSlider.show(Math.round(view.zoom * 100));
    heading.value.textContent = headingText(view.heading);
    angle.value.textContent = angleText();
    headingSlider.show(view.heading);
    angleSlider.show(view.shownAngle);
  };
  return box;
}

function placePanel() {
  const map = document.querySelector("panel-mini-map .mini-map__main") ?? document.querySelector("panel-mini-map");
  const rect = map?.getBoundingClientRect();
  if (!rect || !rect.width) {
    panel.style.left = "1rem";
    panel.style.bottom = "1rem";
    return;
  }
  panel.style.left = `${Math.round(rect.right + 12)}px`;
  panel.style.bottom = `${Math.round(window.innerHeight - rect.bottom + 12)}px`;
}

function togglePanel(open = !panel) {
  if (!open) {
    panel?.remove();
    panel = null;
    return;
  }
  if (panel) return;
  panel = buildPanel();
  document.body.appendChild(panel);
  placePanel();
  panel.refresh();
  command("state");
}

// The dials on screen, when the player turns them on in Options: under the victories and the journal at the top
// left, below the quest list when there is one, on a see-through backing. They step aside while a screen or popup
// has the game's input, and follow the quest list down as it grows.
let hud = null;
let shownDials = dialsOnScreen();

// Which dials sit on screen: none unless the player shows them, then each one the player hasn't left out.
function dialsOnScreen() {
  return getShowDials() ? SCREEN_DIALS.filter((dial) => getDialOnScreen(dial)) : [];
}

function buildHud(dials) {
  addPanelStyle();
  const box = element("div", "pointer-events-auto");
  box.id = HUD_ID;
  box.style.cssText = "position:absolute;z-index:1;display:flex;flex-direction:column;align-items:center;" +
    "padding:0.45rem 0.6rem 0.35rem 0.6rem;border:0.0625rem solid rgba(196,163,98,0.28);border-radius:0.35rem;" +
    "background-color:rgba(14,16,22,0.42);";
  // Each gauge: its title (the same words as the panel's sections), the dial, and what it reads.
  const makers = {
    zoom: () => [loc("LOC_ZOOM_TILT_ROTATE_PANEL_ZOOM", "Zoom"), zoomDial(4.6), () => zoomText()],
    compass: () => [loc("LOC_ZOOM_TILT_ROTATE_PANEL_HEADING", "Heading"), compassDial(4.6), () => headingText(view.heading)],
    angle: () => [loc("LOC_ZOOM_TILT_ROTATE_PANEL_ANGLE", "Angle"), angleDial(4.6), () => degreesText(shownAngle())],
  };
  const row = element("div");
  row.style.cssText = "display:flex;flex-direction:row;align-items:flex-start;";
  const parts = dials.map((name) => {
    const [titleText, dial, caption] = makers[name]();
    const title = element("div", "font-title text-secondary uppercase text-center", titleText);
    title.style.cssText = "font-size:0.68rem;letter-spacing:0.12rem;margin-bottom:0.1rem;";
    const label = element("div", "font-body text-xs text-accent-2 text-center");
    label.style.marginTop = "0.15rem";
    const col = element("div");
    col.style.cssText = "display:flex;flex-direction:column;align-items:center;margin:0 0.3rem;";
    col.append(title, dial, label);
    row.appendChild(col);
    return { dial, label, caption };
  });
  const normal = backToNormalButton("0.7rem");
  normal.style.marginTop = "0.2rem";
  box.append(row, normal);
  box.dials = dials.join(",");
  box.refresh = () => {
    for (const part of parts) {
      part.dial.update();
      part.label.textContent = part.caption();
    }
  };
  return box;
}

function placeHud() {
  const bottomOf = (selector) => {
    const node = document.querySelector(selector);
    const rect = node?.getBoundingClientRect();
    return rect && rect.height > 0 ? rect : null;
  };
  const dock = bottomOf("panel-sub-system-dock");
  const quests = bottomOf("quest-list");
  const top = Math.max(dock?.bottom ?? 150, quests?.bottom ?? 0) + 10;
  hud.style.left = `${Math.round(quests?.left ?? 40)}px`;
  hud.style.top = `${Math.round(top)}px`;
  hud.style.visibility = ViewManager.isWorldInputAllowed ? "visible" : "hidden";
}

function keepHud() {
  // The game moves the camera without telling anyone; while dials are showing, ask for the state.
  if (hud || panel) command("state");
  if (!shownDials.length) {
    hud?.remove();
    hud = null;
    return;
  }
  if (hud && hud.dials !== shownDials.join(",")) {
    hud.remove();
    hud = null;
  }
  if (!hud) {
    hud = buildHud(shownDials);
    document.body.appendChild(hud);
    hud.refresh();
    command("state");
  }
  placeHud();
}

function addCameraButton() {
  if (document.getElementById(BUTTON_ID)) return;
  const row = document.querySelector("panel-mini-map .mini-map__button-row");
  if (!row) return;
  const button = element("fxs-activatable", "mini-map__lens-button mx-1 pointer-events-auto cursor-pointer");
  button.id = BUTTON_ID;
  button.setAttribute("data-tooltip-content", loc("LOC_ZOOM_TILT_ROTATE_CAMERA_BUTTON", "Camera: zoom, angle and heading"));
  const background = element("div", "mini-map__lens-button__bg pointer-events-none");
  const icon = element("div", "mini-map__lens-button__icon pointer-events-none");
  icon.style.backgroundImage = `url("${ICONS}camera.png")`;
  icon.style.backgroundSize = "contain";
  icon.style.backgroundRepeat = "no-repeat";
  icon.style.backgroundPosition = "center";
  button.append(background, icon);
  button.addEventListener("action-activate", () => togglePanel());
  row.appendChild(button);
}

// What zoom-tilt-rotate.js reports, with the last known value kept for anything it leaves out.
function viewFrom(detail) {
  return {
    angle: detail.angle ?? null,
    shownAngle: detail.shownAngle ?? view.shownAngle,
    heading: detail.heading ?? 0,
    zoom: detail.zoom ?? view.zoom,
    zoomMin: detail.zoomMin ?? view.zoomMin,
    zoomMax: detail.zoomMax ?? view.zoomMax,
    closeUpTimes: detail.closeUpTimes ?? null,
  };
}

try {
  window.addEventListener("zoom-tilt-rotate-view-changed", (event) => {
    view = viewFrom(event.detail ?? {});
    panel?.refresh();
    hud?.refresh();
  });
  window.addEventListener("zoom-tilt-rotate-panel-toggle", () => togglePanel());
  window.addEventListener(SETTINGS_CHANGED_EVENT, () => {
    shownDials = dialsOnScreen();
    keepHud();
    if (!panel) return;
    togglePanel(false);
    togglePanel(true);
  });
  window.addEventListener("resize", () => panel && placePanel());
  // The minimap is built after the scripts load, and rebuilt by some screens; keep the button in its row.
  addCameraButton();
  setInterval(addCameraButton, 1000);
  // The dials follow the quest list and step aside for screens; checking four times a second is cheap.
  keepHud();
  setInterval(keepHud, 250);
} catch (e) {
  console.error("[Zoom, Tilt, & Rotate] Camera panel not set up: " + e);
}
