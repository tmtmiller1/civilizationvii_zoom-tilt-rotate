// Past the game's farthest view (ui/zoom-tilt-rotate.js and ui/zoom-tilt-rotate-view.js), with the stand-in lens easing
// the way the engine's does: the angle moves with the lens as it eases, never behind it and never back, and "Keep the
// angle when zoomed far out" holds the angle, tipping down only as far as keeps the top of the screen off the sky. The
// tests run in order and share one camera, starting at the game's farthest view.

import test from "node:test";
import assert from "node:assert/strict";
import { camera, cameraAngle, command, frames, lastView, wait } from "./camera-harness.mjs";

camera.zoomLevel = 1;
camera.lensEase = 0.15;
await import("../ui/zoom-tilt-rotate.js");
const controller = (await import("./stubs/camera-controller.mjs")).default;
const { setKeepAngleFarOut } = await import("../ui/zoom-tilt-rotate-settings.js");

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} isn't within ${tolerance} of ${expected}`);
}

const notch = (name, x) => controller.handleInput({ detail: { name, status: InputActionStatuses.FINISH, x, y: 0 } });
const notchOut = () => notch("mousewheel-down", -5);
const notchIn = () => notch("mousewheel-up", 5);
const lensShare = () => (camera.fieldOfView - 35) / 55;

// Frame by frame: the tilt weight is at or ahead of the lens on screen, never past where it's headed, and never goes
// back the way it came.
function watchFollow(frameCount, goal, direction) {
  let previous = camera.tiltWeight;
  for (let i = 0; i < frameCount; i++) {
    frames(1);
    const weight = camera.tiltWeight;
    if (direction > 0) {
      assert.ok(weight >= lensShare() - 1e-9, `the angle fell behind the lens: ${weight} < ${lensShare()}`);
      assert.ok(weight <= goal + 1e-9 && weight >= previous - 1e-9, `the angle overshot or turned back: ${weight}`);
    } else {
      assert.ok(weight <= Math.max(lensShare(), 0) + 1e-9, `the angle fell behind the lens: ${weight} > ${lensShare()}`);
      assert.ok(weight >= goal - 1e-9 && weight <= previous + 1e-9, `the angle overshot or turned back: ${weight}`);
    }
    previous = weight;
  }
}

test("one notch out: the angle starts with the lens, keeps pace and stops where it stops", () => {
  notchOut();
  watchFollow(60, 1 / 6, 1);
  near(camera.tiltWeight, 1 / 6, 1e-9);
  near(camera.fieldOfView, 35 + 55 / 6, 0.6);
});

test("a fast spin to the far end: the angle keeps pace the whole way", () => {
  for (let i = 0; i < 12; i++) {
    notchOut();
    watchFollow(9, 1, 1);
  }
  watchFollow(90, 1, 1);
  near(camera.tiltWeight, 1, 1e-9);
  near(camera.fieldOfView, 90, 0.6);
});

test("coming back in, the angle comes back with the lens", () => {
  for (let i = 0; i < 6; i++) {
    notchIn();
    watchFollow(9, 0, -1);
  }
  watchFollow(90, 0, -1);
  near(camera.tiltWeight, 0, 1e-9);
  near(camera.fieldOfView, 35, 0.6);
});

test("a quick spin, a notch every 50 ms, keeps every notch", () => {
  for (let i = 0; i < 6; i++) {
    notchOut();
    frames(3);
  }
  assert.equal(lastView().zoom, 1.54);
  wait(1500);
  near(camera.fieldOfView, 90, 0.6);
  near(camera.tiltWeight, 1, 1e-9);
});

test("a stream of notches, one a frame as a trackpad sends them, runs at most three notches ahead of the lens", () => {
  for (let i = 0; i < 30; i++) {
    notchIn();
    frames(1);
    const shown = 1 + Math.max(lensShare(), 0) * 0.54;
    assert.ok(shown - lastView().zoom <= 0.27 + 1e-9, `${lastView().zoom} ran ahead of the lens at ${shown}`);
  }
  wait(1500);
  near(camera.fieldOfView, 35, 0.6);
  near(camera.tiltWeight, 0, 1e-9);
});

test("keeping the angle, the game's own angle holds all the way out", () => {
  command("setZoom", undefined, 1);
  wait(1500);
  setKeepAngleFarOut(true);
  for (let i = 0; i < 7; i++) {
    notchOut();
    wait(1000);
    near(cameraAngle(), camera.gameAngle, 1e-9);
  }
  near(camera.fieldOfView, 90, 0.6);
});

test("keeping the angle, a steep one tips down only as far as keeps the sky off the screen", () => {
  command("backToNormal");
  wait(1500);
  command("setAngle", undefined, 60);
  wait(1500);
  // The dial's chase settles within a tenth of a degree.
  near(cameraAngle(), 60, 0.1);
  for (let n = 1; n <= 6; n++) {
    notchOut();
    wait(1000);
    const lens = 35 + 55 * n / 6;
    near(cameraAngle(), Math.min(60, 85 - lens / 2), 0.1);
  }
});

test("clearing the box while far out turns the camera to look straight down", () => {
  setKeepAngleFarOut(false);
  wait(1000);
  near(cameraAngle(), 0, 0.1);
});
