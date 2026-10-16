// The zoom past both ends of the game's range (ui/zoom-tilt-rotate.js), run against the stand-in camera in
// camera-harness.mjs: the lens at each notch, the pan step at each lens, and the wheel events with no movement in
// them. The tests run in order and share one camera, starting at the game's closest view.

import test from "node:test";
import assert from "node:assert/strict";
import { camera, command, frames, halfTan, lastView, wait } from "./camera-harness.mjs";

camera.zoomLevel = 0;
await import("../ui/zoom-tilt-rotate.js");
const controller = (await import("./stubs/camera-controller.mjs")).default;
const { InputHandlerState } = await import("./stubs/input-support.mjs");
const { setCloseUpReach } = await import("../ui/zoom-tilt-rotate-settings.js");

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} isn't within ${tolerance} of ${expected}`);
}

// A wheel event as the game sends it to the camera controller. A real notch carries a distance of 5.
function wheel(name, x) {
  const answer = controller.handleInput({ detail: { name, status: InputActionStatuses.FINISH, x, y: 0 } });
  frames(2);
  return answer;
}
const notchIn = () => wheel("mousewheel-up", 5);
const notchOut = () => wheel("mousewheel-down", -5);

function lensesAfter(notch, count) {
  const lenses = [];
  for (let i = 0; i < count; i++) {
    notch();
    lenses.push(camera.fieldOfView);
  }
  return lenses;
}

const lastPan = () => camera.pans.at(-1);
let closeUpLenses = [];

test("at the game's lens, facing north, a pan step goes through unchanged", () => {
  const step = { x: 3, y: -4 };
  Camera.panFocus(step);
  assert.equal(lastPan(), step);
});

test("six notches in each magnify by the same amount and end at the chosen lens", () => {
  closeUpLenses = lensesAfter(notchIn, 6);
  const perNotch = (halfTan(5) / halfTan(35)) ** (1 / 6);
  let previous = 35;
  for (const lens of closeUpLenses) {
    near(halfTan(lens) / halfTan(previous), perNotch, 1e-9);
    previous = lens;
  }
  near(closeUpLenses[5], 5);
  assert.deepEqual(lensesAfter(notchIn, 1).map(Math.round), [5]);
  assert.equal(lastView().zoom, -0.54);
  assert.equal(lastView().closeUpTimes, 7.2);
  // The engine's own wheel zoom: let go when the script loads, held off once the lens is past the limit.
  assert.deepEqual(camera.wheelZoomHeld, [false, true]);
});

test("a different close-up reach applies to the notch the view is already on", () => {
  setCloseUpReach("all-the-way");
  frames(1);
  near(camera.fieldOfView, 1);
  assert.equal(lastView().closeUpTimes, 36.1);
  setCloseUpReach("much-closer");
  frames(1);
  near(camera.fieldOfView, 2);
  assert.equal(lastView().closeUpTimes, 18.1);
  setCloseUpReach("closer");
  frames(1);
  near(camera.fieldOfView, 5);
});

test("in the close-up, a pan step shrinks with the lens", () => {
  const scale = halfTan(5) / halfTan(35);
  Camera.panFocus({ x: 3, y: -4 });
  near(lastPan().x, 3 * scale);
  near(lastPan().y, -4 * scale);
});

test("wheel events with no distance in them never reach the camera, however late they come", () => {
  wait(1500);
  const before = controller.passedOn.length;
  for (let i = 0; i < 6; i++) assert.equal(wheel("mousewheel-down", 0), InputHandlerState.Handled);
  assert.equal(wheel("mousewheel-up", 0), InputHandlerState.Handled);
  assert.equal(wheel("mousewheel-down", undefined), InputHandlerState.Handled);
  assert.equal(controller.passedOn.length, before);
  near(camera.fieldOfView, 5);
  controller.handleInput({ detail: { name: "keyboard-nav-up", status: InputActionStatuses.START, x: 0, y: 0 } });
  assert.deepEqual(controller.passedOn.slice(before), ["keyboard-nav-up"]);
});

test("scrolling back out steps the lens back one notch at a time, then the game's zoom takes over", () => {
  const back = lensesAfter(notchOut, 6);
  const expected = [...closeUpLenses.slice(0, 5).reverse(), 35];
  back.forEach((lens, i) => near(lens, expected[i]));
  notchOut();
  near(camera.zoomLevel, 0.09, 1e-9);
  assert.equal(lastView().beyondLimits, false);
  assert.equal(camera.wheelZoomHeld.at(-1), false);
});

test("six notches out widen the lens evenly to 90 degrees and turn the camera to look straight down", () => {
  command("setZoom", undefined, 1);
  frames(3);
  near(camera.zoomLevel, 1);
  for (let notch = 1; notch <= 6; notch++) {
    notchOut();
    wait(300);
    near(camera.fieldOfView, 35 + (90 - 35) * notch / 6, 1e-6);
    near(camera.tiltWeight, notch / 6, 1e-9);
    near(camera.customTilt, 0);
  }
  notchOut();
  near(camera.fieldOfView, 90, 1e-6);
  assert.equal(lastView().zoom, 1.54);
});

test("far out, a pan step grows with the lens", () => {
  const scale = halfTan(90) / halfTan(35);
  Camera.panFocus({ x: 2, y: 1 });
  near(lastPan().x, 2 * scale);
  near(lastPan().y, 1 * scale);
});

test("with the view turned, a pan step turns with it", () => {
  command("setHeading", undefined, 90);
  wait(1000);
  near(camera.rotation, 90, 0.05);
  const scale = halfTan(90) / halfTan(35);
  Camera.panFocus({ x: 1, y: 0 });
  near(lastPan().x, 0, 0.002 * scale);
  near(lastPan().y, -scale, 0.002 * scale);
  command("setHeading", undefined, 0);
  wait(1000);
  near(camera.rotation, 0);
});
