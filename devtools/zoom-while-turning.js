// Zooming while the angle or heading is still on the move: the angle gauge just let go, an angle key just tapped, a
// turn key just tapped, an angle key held, and the compass being dragged. Each case starts at a zoom, makes the move
// through the mod's own commands, then sends wheel notches. The zoom should reach what the wheel asked for, and past
// the far limit the wide lens should only go on once the camera is at the limit. Rows are [ms, zoom, lens, angle,
// heading, mod zoom] every 100 ms.

let modZoom = null;
window.addEventListener("zoom-tilt-rotate-view-changed", (event) => { modZoom = event.detail?.zoom ?? modZoom; });
const command = (action, value, phase) =>
  window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, value, phase } }));

function angleOnScreen() {
  const centre = Camera.pickWorldPosFromPoint(screenWidth / 2, screenHeight / 2);
  if (!centre) return null;
  const eye = Camera.getCurrentPose().position;
  return +(Math.atan2(Math.hypot(centre.x - eye.x, centre.y - eye.y), eye.z - centre.z) * 180 / Math.PI).toFixed(1);
}

async function startAt(zoom) {
  command("backToNormal");
  await waitMs(1500);
  await resetCamera(zoom);
  command("state");
  await waitMs(600);
}

async function record(durationMs, actions) {
  const start = performance.now();
  const rows = [];
  const pending = actions.map(([at, act]) => ({ at, act, done: false }));
  let next = 0;
  while (performance.now() - start < durationMs) {
    const now = performance.now() - start;
    for (const p of pending) if (!p.done && now >= p.at) { p.done = true; p.act(); }
    if (now >= next) {
      const state = Camera.getState();
      const zoom = +state.zoomLevel.toFixed(3);
      rows.push([Math.round(now), zoom, fieldOfView(), angleOnScreen(), Math.round(state.rotation), modZoom]);
      next += 100;
    }
    await nextFrame();
  }
  const state = Camera.getState();
  return { rows, end: { zoom: +state.zoomLevel.toFixed(3), lens: fieldOfView(), angle: angleOnScreen(),
    heading: Math.round(state.rotation), modZoom } };
}

const notches = (count, from, spacing = 150) =>
  Array.from({ length: count }, (_, i) => [from + i * spacing, scrollOut]);

// The angle gauge let go at 40 just before a spin out through the far limit (the 2026-10-29 case).
await startAt(0.73);
results.gaugeThenSpin = await record(4000, [[0, () => command("setAngle", 25)], [40, () => command("setAngle", 40)],
  ...notches(9, 100)]);

// An angle key tapped (one 10-degree step, a 600 ms ease), then three notches out inside the range.
await startAt(0.4);
results.angleKeyThenZoom = await record(2500, [[0, () => command("tiltUp")], ...notches(3, 60)]);

// A turn key tapped (45 degrees, a 600 ms ease), then three notches out inside the range.
await startAt(0.4);
results.turnKeyThenZoom = await record(2500, [[0, () => command("turnRight")], ...notches(3, 60)]);

// An angle key held, and three notches while it glides.
await startAt(0.4);
results.angleHeldWhileZooming = await record(3000, [[0, () => command("tiltUp", undefined, "start")],
  ...notches(3, 600), [1800, () => command("tiltUp", undefined, "end")]]);

// The compass dragged a step a frame for 400 ms, three notches out in the middle of it.
await startAt(0.4);
results.compassDragWhileZooming = await record(2500, [
  ...Array.from({ length: 24 }, (_, i) => [i * 17, () => command("setHeading", 5 + i * 3)]), ...notches(3, 150)]);

// One notch past the far limit while the angle gauge chase is still settling, starting right at the limit.
await startAt(1);
results.gaugeThenFarNotch = await record(2500, [[0, () => command("setAngle", 50)], [30, scrollOut]]);

command("backToNormal");
await waitMs(1500);
