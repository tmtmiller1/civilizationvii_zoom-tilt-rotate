// zoom-tilt-rotate-options.js - the mod's rows in Options > Add-ons: how close the player can zoom in, how far one
// press of the angle and turn keys moves the camera, the dials on screen, and "Camera keys", which opens
// zoom-tilt-rotate-keys-editor.js. Loaded in the main menu and in a game; a change applies straight away, and Cancel
// puts back what was there on opening.

import { CategoryType, OptionType, Options } from "/core/ui/options/model-options.js";
import { CategoryData } from "/core/ui/options/options-helpers.js";
import {
  CLOSE_UP_REACHES, TURN_STEPS, ANGLE_STEPS, getCloseUpReach, setCloseUpReach, getTurnStep, setTurnStep, getAngleStep,
  setAngleStep, getShowDials, setShowDials, getDialOnScreen, setDialOnScreen, refreshSettings, localized as text
} from "/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-settings.js";
import "/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-keys-editor.js"; // defines <zoom-tilt-rotate-keys-editor> for the "Camera keys" row

// Every row sits under one header, whose text is LOC_OPTIONS_GROUP_ZOOM_TILT_ROTATE.
const GROUP = "zoom_tilt_rotate";

const reachAt = (index) => CLOSE_UP_REACHES[index] ?? CLOSE_UP_REACHES[0];
const indexOfReach = (id) => Math.max(0, CLOSE_UP_REACHES.findIndex((reach) => reach.id === id));

function addCloseUpRow() {
  Options.addOption({
    category: CategoryType.Mods,
    group: GROUP,
    type: OptionType.Dropdown,
    id: "zoom-tilt-rotate-close-up",
    label: text("LOC_ZOOM_TILT_ROTATE_OPTION_CLOSE_UP", "How close you can zoom in"),
    description: text("LOC_ZOOM_TILT_ROTATE_OPTION_CLOSE_UP_DESCRIPTION",
      "How far the six extra notches take you past the game's closest view, which counts as 1x. At 7x you " +
      "see a unit up close. At 18x a unit fills the screen. At 36x, the most the game's camera allows, " +
      "you'll see a single sword blade and the ground goes soft. Changes apply right away."),
    dropdownItems: [
      { label: text("LOC_ZOOM_TILT_ROTATE_OPTION_CLOSE_UP_CLOSER", "Closer (7x)") },
      { label: text("LOC_ZOOM_TILT_ROTATE_OPTION_CLOSE_UP_MUCH_CLOSER", "Much closer (18x)") },
      { label: text("LOC_ZOOM_TILT_ROTATE_OPTION_CLOSE_UP_ALL_THE_WAY", "All the way (36x)") }
    ],
    initListener: (/** @type {*} */ info) => {
      info.selectedItemIndex = indexOfReach(getCloseUpReach().id);
      info.valueOnOpen = info.selectedItemIndex;
    },
    updateListener: (/** @type {*} */ info, /** @type {number} */ index) => {
      info.selectedItemIndex = index;
      setCloseUpReach(reachAt(index).id);
    },
    restoreListener: (/** @type {*} */ info) => setCloseUpReach(reachAt(info.valueOnOpen).id)
  });
}

// A step list as a dropdown: "45 degrees", "90 degrees".
function addStepRow({ id, label, description, steps, get, set }) {
  Options.addOption({
    category: CategoryType.Mods,
    group: GROUP,
    type: OptionType.Dropdown,
    id,
    label,
    description,
    dropdownItems: steps.map((step) => ({ label: text("LOC_ZOOM_TILT_ROTATE_OPTION_DEGREES", `${step}°`, step) })),
    initListener: (/** @type {*} */ info) => {
      info.selectedItemIndex = Math.max(0, steps.indexOf(get()));
      info.valueOnOpen = info.selectedItemIndex;
    },
    updateListener: (/** @type {*} */ info, /** @type {number} */ index) => {
      info.selectedItemIndex = index;
      set(steps[index] ?? steps[0]);
    },
    restoreListener: (/** @type {*} */ info) => set(steps[info.valueOnOpen] ?? steps[0])
  });
}

function addStepRows() {
  addStepRow({
    id: "zoom-tilt-rotate-turn-step",
    label: text("LOC_ZOOM_TILT_ROTATE_OPTION_TURN_STEP", "Turn step"),
    description: text("LOC_ZOOM_TILT_ROTATE_OPTION_TURN_STEP_DESCRIPTION",
      "How far one press of a turn key, or the turn buttons in the camera panel, turns the view. The view " +
      "stays facing that way until you turn it again or go back to normal."),
    steps: TURN_STEPS, get: getTurnStep, set: setTurnStep
  });
  addStepRow({
    id: "zoom-tilt-rotate-angle-step",
    label: text("LOC_ZOOM_TILT_ROTATE_OPTION_ANGLE_STEP", "Angle step"),
    description: text("LOC_ZOOM_TILT_ROTATE_OPTION_ANGLE_STEP_DESCRIPTION",
      "How far one press of an angle key, or the angle buttons in the camera panel, tips the camera between " +
      "looking straight down and looking toward the horizon."),
    steps: ANGLE_STEPS, get: getAngleStep, set: setAngleStep
  });
}

// A checkbox row; Cancel puts back the value it had on opening.
function addCheckboxRow(id, label, description, get, set) {
  Options.addOption({
    category: CategoryType.Mods,
    group: GROUP,
    type: OptionType.Checkbox,
    id,
    label,
    description,
    initListener: (/** @type {*} */ info) => {
      info.currentValue = get();
      info.openValue = info.currentValue;
    },
    updateListener: (/** @type {*} */ _info, /** @type {*} */ value) => set(!!value),
    restoreListener: (/** @type {*} */ info) => set(!!info.openValue)
  });
}

// "Show the camera dials on screen", then one row per dial under it: which of them sit on screen when it's on.
function addDialRows() {
  addCheckboxRow("zoom-tilt-rotate-show-dials",
    text("LOC_ZOOM_TILT_ROTATE_OPTION_SHOW_DIALS", "Show the camera dials on screen"),
    text("LOC_ZOOM_TILT_ROTATE_OPTION_SHOW_DIALS_DESCRIPTION",
      "Keeps a small zoom gauge, compass and angle gauge at the top left, under the victories and the journal, " +
      "on a see-through backing. Drag along the zoom gauge to zoom, around the compass to turn the view, and " +
      "along the angle gauge to tip it. They step aside while a screen or popup is open."),
    getShowDials, setShowDials);
  const dialRow = (dial, label, description) => addCheckboxRow(`zoom-tilt-rotate-dial-${dial}`, label, description,
    () => getDialOnScreen(dial), (show) => setDialOnScreen(dial, show));
  dialRow("zoom",
    text("LOC_ZOOM_TILT_ROTATE_OPTION_DIAL_ZOOM", "Zoom gauge on screen"),
    text("LOC_ZOOM_TILT_ROTATE_OPTION_DIAL_ZOOM_DESCRIPTION",
      "Shows the zoom gauge among the dials on screen. Drag along it to zoom."));
  dialRow("compass",
    text("LOC_ZOOM_TILT_ROTATE_OPTION_DIAL_COMPASS", "Compass on screen"),
    text("LOC_ZOOM_TILT_ROTATE_OPTION_DIAL_COMPASS_DESCRIPTION",
      "Shows the compass among the dials on screen. Drag around it to turn the view."));
  dialRow("angle",
    text("LOC_ZOOM_TILT_ROTATE_OPTION_DIAL_ANGLE", "Angle gauge on screen"),
    text("LOC_ZOOM_TILT_ROTATE_OPTION_DIAL_ANGLE_DESCRIPTION",
      "Shows the angle gauge among the dials on screen. Drag along it to tip the camera."));
}

function addKeysRow() {
  Options.addOption({
    category: CategoryType.Mods,
    group: GROUP,
    type: OptionType.Editor,
    id: "zoom-tilt-rotate-keys",
    editorTagName: "zoom-tilt-rotate-keys-editor",
    label: text("LOC_ZOOM_TILT_ROTATE_OPTION_KEYS", "Camera keys"),
    description: text("LOC_ZOOM_TILT_ROTATE_OPTION_KEYS_DESCRIPTION",
      "The keys that tip the camera, turn the view, go back to normal and open the camera panel. Out of " +
      "the box they're Shift with the arrow keys, 0 and C."),
    caption: text("LOC_ZOOM_TILT_ROTATE_OPTION_KEYS_OPEN", "Change keys")
  });
}

// The shared "Mods" category, created the same way Tower's other mods and the community's create it. This also runs
// in the main menu, where a throw would take the menu down, so any failure only leaves the rows out.
try {
  if (!CategoryType.Mods) CategoryType.Mods = "mods";
  if (!CategoryData[CategoryType.Mods]) {
    CategoryData[CategoryType.Mods] = {
      title: "LOC_UI_CONTENT_MGR_SUBTITLE",
      description: "LOC_UI_CONTENT_MGR_SUBTITLE_DESCRIPTION"
    };
  }
  Options.addInitCallback(() => {
    refreshSettings();
    addCloseUpRow();
    addStepRows();
    addDialRows();
    addKeysRow();
  });
} catch (e) {
  console.error("[Zoom, Tilt, & Rotate] Options row not added: " + e);
}
