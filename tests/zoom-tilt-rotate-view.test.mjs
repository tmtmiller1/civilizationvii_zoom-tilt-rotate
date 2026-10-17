// The angle and heading (ui/zoom-tilt-rotate-view.js), driven by the commands the camera keys and the panel send to
// ui/zoom-tilt-rotate.js, against the stand-in camera in camera-harness.mjs: a tap steps onto the grid, a hold glides,
// and Back to normal puts everything back. The tests run in order and share one camera.

import test from "node:test";
import assert from "node:assert/strict";
import { camera, cameraAngle, command, frames, lastView, wait } from "./camera-harness.mjs";

await import("../ui/zoom-tilt-rotate.js");
const { setAngleStep, setTurnStep } = await import("../ui/zoom-tilt-rotate-settings.js");
const { easeView } = await import("../ui/zoom-tilt-rotate-view.js");

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} isn't within ${tolerance} of ${expected}`);
}

// A tap of the key or button, and what the panel is told straight after. Then the camera gets time to ease there.
function tap(action) {
  command(action);
  const { heading, angle } = lastView();
  wait(700);
  return { heading, angle };
}

const headingsAfter = (action, count) => Array.from({ length: count }, () => tap(action).heading);

test("a tap turns one 45-degree step onto the compass points, and carries on past south", () => {
  assert.deepEqual(headingsAfter("turnRight", 5), [45, 90, 135, 180, -135]);
  near(camera.rotation, 225);
  assert.deepEqual(headingsAfter("turnLeft", 2), [180, 135]);
  assert.deepEqual(headingsAfter("turnLeft", 3), [90, 45, 0]);
});

test("from an in-between heading, a tap lands on the next point of the step the player chose", () => {
  command("setHeading", undefined, 30);
  wait(700);
  assert.equal(tap("turnRight").heading, 45);
  setTurnStep(90);
  command("setHeading", undefined, 30);
  wait(700);
  assert.equal(tap("turnRight").heading, 90);
  command("setHeading", undefined, 30);
  wait(700);
  assert.equal(tap("turnLeft").heading, 0);
  setTurnStep(45);
});

test("a tap on the angle starts from the game's own angle and lands on the step grid", () => {
  near(cameraAngle(), 37.3);
  assert.equal(lastView().angle, null);
  assert.equal(tap("tiltUp").angle, 40);
  near(cameraAngle(), 40);
  assert.equal(tap("tiltDown").angle, 30);
  near(cameraAngle(), 30);
  tap("backToNormal");
  setAngleStep(15);
  assert.equal(tap("tiltUp").angle, 45);
  setAngleStep(10);
});

test("the angle stays between straight down and 80 degrees", () => {
  command("setAngle", undefined, 78);
  wait(700);
  assert.equal(tap("tiltUp").angle, 80);
  assert.equal(tap("tiltUp").angle, 80);
  command("setAngle", undefined, 120);
  assert.equal(lastView().angle, 80);
  command("setAngle", undefined, 4);
  wait(700);
  assert.equal(tap("tiltDown").angle, 0);
  assert.equal(tap("tiltDown").angle, 0);
  near(cameraAngle(), 0);
});

test("holding glides at 60 degrees a second and stops where it's let go; a shorter press is one step", () => {
  tap("backToNormal");
  command("turnRight", "start");
  wait(350 + 1000);
  command("turnRight", "end");
  const held = lastView().heading;
  assert.ok(held >= 58 && held <= 62, `glided to ${held}`);
  wait(700);
  assert.equal(lastView().heading, held);
  command("turnRight", "start");
  wait(100);
  command("turnRight", "end");
  assert.equal(lastView().heading, 90);
  wait(700);
  assert.equal(lastView().heading, 90);
});

test("Back to normal faces north, goes back to the game's angle and brings the zoom into the game's range", () => {
  command("setHeading", undefined, 135);
  command("setAngle", undefined, 60);
  command("setZoom", undefined, -0.27);
  wait(700);
  assert.ok(camera.fieldOfView < 20, `lens ${camera.fieldOfView}`);
  command("backToNormal");
  const { heading, angle, zoom, beyondLimits } = lastView();
  // The turn eases over 600 ms and then lets go, and the engine's own swing to north takes another half second.
  wait(1300);
  assert.deepEqual({ heading, angle, zoom, beyondLimits }, { heading: 0, angle: null, zoom: 0, beyondLimits: false });
  near(camera.fieldOfView, 35);
  near(camera.tiltWeight, 0);
  near(camera.rotation, 0);
});

// Closing the place-building or buy-tile screen calls Camera.restoreDefaults(), and the engine then swings the heading
// to north over about half a second. A player facing south saw the camera turn to north and spin back.
const offSouth = () => Math.abs(((camera.rotation - 180) % 360 + 540) % 360 - 180);

test("closing a city screen keeps the heading: the game's swing to north never shows", () => {
  command("setHeading", undefined, 180);
  wait(700);
  near(offSouth(), 0, 0.05);
  Camera.restoreDefaults();
  let strayed = 0;
  for (let i = 0; i < 60; i++) {
    frames(1);
    strayed = Math.max(strayed, offSouth());
  }
  assert.ok(strayed < 0.5, `heading strayed ${strayed} degrees`);
  near(offSouth(), 0);
});

test("the angle comes back after a city screen closes", () => {
  command("setAngle", undefined, 50);
  wait(700);
  Camera.restoreDefaults();
  wait(900);
  near(camera.customTilt, 50, 1e-3);
  near(camera.tiltWeight, 1, 1e-3);
  tap("backToNormal");
});

test("when the camera reads as already at the heading, the ease still holds it there", () => {
  command("setHeading", undefined, 90);
  wait(700);
  // The engine's release to north, read before it has moved anything: the ease has nothing to ease, and must still
  // stop the swing.
  Camera.rotate(0, false);
  near(camera.rotation, 90, 0.05);
  easeView();
  wait(700);
  near(camera.rotation, 90);
  tap("backToNormal");
});
