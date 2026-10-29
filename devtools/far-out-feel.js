// How zooming out feels past the game's farthest view. Records the camera every frame (zoom, lens, the angle on
// screen, the tilt weight, the eye's height) through a run of wheel notches, inside the game's range and past it, so
// you can see whether the lens and the angle move together or one after the other. Also measures what a held angle
// would show far out: how near the top of the screen comes to the horizon at each lens.

const t0 = performance.now();
const ms = () => Math.round(performance.now() - t0);

function preciseFieldOfView() {
  const centre = Camera.pickWorldPosFromPoint(screenWidth / 2, screenHeight / 2);
  const beside = Camera.pickWorldPosFromPoint(screenWidth * 0.55, screenHeight / 2);
  if (!centre || !beside) return null;
  const eye = Camera.getCurrentPose().position;
  const a = [centre.x - eye.x, centre.y - eye.y, centre.z - eye.z];
  const b = [beside.x - eye.x, beside.y - eye.y, beside.z - eye.z];
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
  const angle = Math.acos(Math.min(1, cos));
  return +(Math.atan(Math.tan(angle) / (0.1 * screenWidth / screenHeight)) * 360 / Math.PI).toFixed(2);
}

function angleOnScreen() {
  const centre = Camera.pickWorldPosFromPoint(screenWidth / 2, screenHeight / 2);
  if (!centre) return null;
  const eye = Camera.getCurrentPose().position;
  return +(Math.atan2(Math.hypot(centre.x - eye.x, centre.y - eye.y), eye.z - centre.z) * 180 / Math.PI).toFixed(2);
}

// The mod's own zoom, from the panel's announcements.
let modZoom = null;
window.addEventListener("zoom-tilt-rotate-view-changed", (event) => { modZoom = event.detail?.zoom ?? modZoom; });

// [ms, zoom, lens, angle, tilt weight, custom tilt, eye height, mod zoom]
function sample(start) {
  const state = Camera.getState();
  const eye = Camera.getCurrentPose().position;
  return [Math.round(performance.now() - start), +state.zoomLevel.toFixed(4), preciseFieldOfView(), angleOnScreen(),
    +state.tiltWeight.toFixed(3), +state.customTilt.toFixed(2), Math.round(eye.z), modZoom];
}

// Sample every frame for durationMs while the actions run at their times.
async function record(durationMs, actions) {
  const start = performance.now();
  const rows = [];
  const pending = actions.map(([at, act]) => ({ at, act, done: false }));
  while (performance.now() - start < durationMs) {
    const now = performance.now() - start;
    for (const p of pending) if (!p.done && now >= p.at) { p.done = true; p.act(); rows.push(["act", Math.round(now)]); }
    rows.push(sample(start));
    await nextFrame();
  }
  return rows;
}

const command = (action, value) =>
  window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, value } }));

const notches = (scroll, count, spacing, from = 100) => Array.from({ length: count }, (_, i) => [from + i * spacing, scroll]);

async function startAt(zoom) {
  command("backToNormal");
  await waitMs(1500);
  await resetCamera(zoom);
  command("state");
  await waitMs(800);
}

results.screen = [screenWidth, screenHeight];

// A. Inside the game's range: six notches out from 0.46 to 1, 150 ms apart.
await startAt(0.46);
results.inRange = await record(2600, notches(scrollOut, 6, 150));

// B. A fast spin through the limit: 0.73 to the far end, nine notches 150 ms apart.
await startAt(0.73);
results.crossingFast = await record(5000, notches(scrollOut, 9, 150));

// C. The same notches, one at a time (700 ms apart).
await startAt(0.73);
results.crossingSlow = await record(8000, notches(scrollOut, 9, 700));

// D. Already at the game's farthest view: one notch out, then another 1.5 s later.
await startAt(1);
results.farSingle = await record(3500, [[100, scrollOut], [1600, scrollOut]]);

// E. Back in from the far end, nine notches 150 ms apart.
results.backInFast = await record(5000, notches(scrollIn, 9, 150));

// F. With the player's own angle (40 degrees) set, the fast spin of B.
await startAt(0.73);
command("setAngle", 40);
await waitMs(1200);
results.crossingFastAngle40 = await record(5000, notches(scrollOut, 9, 150));
command("backToNormal");
await waitMs(1500);

// G. What a held angle would show far out. At the game's farthest view, the angle on screen, then the angle and the
// distance to the top-centre of the screen at each lens with that angle held.
await startAt(1);
const gameFarAngle = angleOnScreen();
results.gameFarAngle = gameFarAngle;
const heldAngle = [];
for (const angle of [gameFarAngle, 40, 50, 60]) {
  Camera.setTilt(angle, 1);
  for (const lens of [35, 50, 60, 70, 80, 90]) {
    Camera.setVerticalFoV(lens);
    await waitMs(1300);
    const eye = Camera.getCurrentPose().position;
    const top = Camera.pickWorldPosFromPoint(screenWidth / 2, 2);
    const topRay = angleOnScreen() + preciseFieldOfView() / 2;
    heldAngle.push({ angle: +angle.toFixed(1), lens, measuredLens: preciseFieldOfView(), topRay: +topRay.toFixed(1),
      topDistance: top ? Math.round(Math.hypot(top.x - eye.x, top.y - eye.y)) : null, eyeHeight: Math.round(eye.z) });
  }
  Camera.setVerticalFoV(35);
  await waitMs(1000);
}
Camera.setTilt(0, 0);
results.heldAngle = heldAngle;
command("backToNormal");
await waitMs(1500);

// H. Engine behaviour the fix leans on. A lens change partway through a zoom: does the zoom still arrive? A tilt
// change partway through a zoom? And the shape of the engine's own lens ease, from one setVerticalFoV call.
await resetCamera(0.6);
results.lensDuringZoom = await record(2500, [[50, () => Camera.zoom(1)], [250, () => Camera.setVerticalFoV(50)]]);
Camera.setVerticalFoV(35);
await waitMs(1300);
await resetCamera(0.6);
results.lensThenZoomAgain = await record(2500, [[50, () => Camera.zoom(1)], [250, () => Camera.setVerticalFoV(50)],
  [270, () => Camera.zoom(1)]]);
Camera.setVerticalFoV(35);
await waitMs(1300);
await resetCamera(0.6);
results.tiltDuringZoom = await record(2500, [[50, () => Camera.zoom(1)], [250, () => Camera.setTilt(10, 0.5)]]);
Camera.setTilt(0, 0);
await waitMs(800);
await resetCamera(1);
results.lensEase = await record(2000, [[50, () => Camera.setVerticalFoV(62.5)]]);
// The same lens change sent a little at a time, every frame (does each call ease from where it is, or jump?).
results.lensPerFrame = await record(1500, Array.from({ length: 30 }, (_, i) => [50 + i * 17, () =>
  Camera.setVerticalFoV(62.5 + (i + 1) * (27.5 / 30))]));
Camera.setVerticalFoV(35);
await waitMs(1300);
command("backToNormal");
await waitMs(1500);
results.ms = ms();
