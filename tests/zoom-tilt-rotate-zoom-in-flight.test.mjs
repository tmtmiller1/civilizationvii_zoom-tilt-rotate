// Zooming while the angle or heading is still moving (ui/zoom-tilt-rotate-view.js with ui/zoom-tilt-rotate.js), against
// a stand-in camera that eases its zoom and treats a zoom on its way the way the engine does (camera-harness.mjs): a
// tilt in the frame the zoom starts cancels it, tilts in frames running hold it, and a turn makes it jump. The angle
// gauge let go, an angle key tapped and held, a turn key tapped and the compass dragged, each with the wheel straight
// after: the zoom gets where the wheel sent it, smoothly, and the wide far-out lens only goes on at the far limit. The
// tests run in order and share one camera.

import test from "node:test";
import assert from "node:assert/strict";
import { camera, cameraAngle, command, frames, lastView, wait } from "./camera-harness.mjs";

camera.zoomLevel = camera.zoomTarget = 0.73;
camera.zoomEase = 0.25;
camera.lensEase = 0.15;
await import("../ui/zoom-tilt-rotate.js");
const controller = (await import("./stubs/camera-controller.mjs")).default;

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} isn't within ${tolerance} of ${expected}`);
}

const notch = (name, x) => controller.handleInput({ detail: { name, status: InputActionStatuses.FINISH, x, y: 0 } });
const notchOut = () => notch("mousewheel-down", -5);
const notchIn = () => notch("mousewheel-up", 5);

// Notches a few frames apart; each frame checks the wide lens isn't on short of the far limit.
function spin(wheel, count, framesApart) {
  for (let i = 0; i < count; i++) {
    wheel();
    for (let f = 0; f < framesApart; f++) {
      frames(1);
      if (camera.lensTarget > 35.5) {
        assert.ok(camera.zoomLevel > 0.98, `the wide lens went on at zoom ${camera.zoomLevel}`);
      }
    }
  }
}

function startFresh() {
  camera.zoomCancels = 0;
  camera.zoomJumps = 0;
}

test("the angle gauge let go just before a spin out: the zoom reaches the far limit and the lens goes on there", () => {
  startFresh();
  command("setAngle", undefined, 25);
  command("setAngle", undefined, 40);
  spin(notchOut, 9, 9);
  wait(2500);
  assert.equal(camera.zoomCancels, 0);
  near(camera.zoomLevel, 1, 1e-3);
  assert.equal(lastView().zoom, 1.54);
  near(camera.fieldOfView, 90, 0.6);
  near(cameraAngle(), 0, 0.1);
});

test("an angle key tapped, then three notches: the zoom goes all the way and the angle lands on its step", () => {
  command("backToNormal");
  wait(1500);
  command("setZoom", undefined, 0.4);
  wait(1500);
  startFresh();
  command("tiltUp");
  frames(3);
  spin(notchOut, 3, 9);
  wait(1500);
  assert.equal(camera.zoomCancels, 0);
  near(camera.zoomLevel, 0.67, 1e-3);
  near(cameraAngle(), 40, 0.05);
});

test("a turn key tapped, then three notches: the zoom eases rather than jumping, and the turn finishes after", () => {
  startFresh();
  command("turnRight");
  frames(3);
  spin(notchOut, 3, 9);
  wait(1500);
  assert.equal(camera.zoomJumps, 0);
  assert.equal(camera.zoomCancels, 0);
  near(camera.zoomLevel, 0.94, 1e-3);
  near(camera.rotation, 45, 0.05);
});

test("an angle key held while zooming: the zoom gets there and the angle ends where the key let go", () => {
  startFresh();
  command("tiltUp", "start");
  wait(500);
  spin(notchIn, 3, 9);
  wait(400);
  command("tiltUp", "end");
  wait(1000);
  assert.equal(camera.zoomCancels, 0);
  near(camera.zoomLevel, 0.67, 1e-3);
  assert.ok(lastView().angle > 40, `the angle didn't glide: ${lastView().angle}`);
  near(cameraAngle(), lastView().angle, 0.6);
});

test("the compass dragged while zooming: the zoom eases and the heading ends on the last value", () => {
  startFresh();
  for (let i = 0; i < 24; i++) {
    command("setHeading", undefined, 50 + i * 3);
    if (i === 6 || i === 12) notchOut();
    frames(1);
  }
  wait(1500);
  assert.equal(camera.zoomJumps, 0);
  assert.equal(camera.zoomCancels, 0);
  near(camera.zoomLevel, 0.85, 1e-3);
  near(camera.rotation, 119, 0.1);
});

test("a zoom something else holds still: the far-out lens stays off and the view stays where it stopped", () => {
  command("backToNormal");
  wait(1500);
  command("setZoom", undefined, 0.94);
  wait(1500);
  camera.zoomStuck = true;
  notchOut();
  wait(2000);
  camera.zoomStuck = false;
  near(camera.lensTarget, 35, 1e-6);
  assert.equal(lastView().beyondLimits, false);
  near(lastView().zoom, 0.94, 2e-3);
});
