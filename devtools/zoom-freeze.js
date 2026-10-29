// Which camera calls stop a zoom that's still moving. Each case starts a zoom from 0.6 to 1 and makes its calls while
// it travels; the result is the zoom every 100 ms, [ms, zoom], with the interface mode at the end when it isn't the
// default one. Calls go straight to the camera, around the mod.

function trace(rows) {
  const out = [];
  let next = 0;
  for (const [t, z] of rows) if (t >= next) { out.push([t, +z.toFixed(3)]); next += 100; }
  out.push(rows.at(-1).map((v, i) => (i ? +v.toFixed(3) : v)));
  return out;
}

async function clean() {
  Camera.setTilt(0, 0);
  Camera.rotate(0, false);
  Camera.setVerticalFoV(35);
  await waitMs(900);
  await resetCamera(0.6);
}

// Start the zoom at 0 ms, call during(t, frame) every frame, stop sampling at durationMs.
async function run(durationMs, during, before) {
  await clean();
  const start = performance.now();
  const rows = [];
  let frame = 0;
  before?.();
  Camera.zoom(1);
  while (performance.now() - start < durationMs) {
    const t = performance.now() - start;
    during(t, frame++);
    rows.push([Math.round(t), Camera.getState().zoomLevel]);
    await nextFrame();
  }
  const out = trace(rows);
  if (InterfaceMode.getCurrent() !== "INTERFACEMODE_DEFAULT") out.push(InterfaceMode.getCurrent());
  return out;
}

const once = (at, act) => { let done = false; return (t) => { if (!done && t >= at) { done = true; act(); } }; };

const everyMs = (gap, from, act) => {
  let last = -Infinity;
  return (t) => { if (t >= from && t - last >= gap) { last = t; act(t); } };
};
const tiltTo = (t) => Camera.setTilt(0, Math.min(0.5, t / 1000));

results.alone = await run(1000, () => {});
results.oneTiltSameFrameAfter = await run(1200, once(0, () => Camera.setTilt(10, 0.5)));
results.oneTiltSameFrameBefore = await run(1200, () => {}, () => Camera.setTilt(10, 0.5));
results.oneTiltNextFrame = await run(1200, (t, f) => { if (f === 1) Camera.setTilt(10, 0.5); });
results.oneTiltAt30 = await run(1200, once(30, () => Camera.setTilt(10, 0.5)));
results.oneLensAt30 = await run(1200, once(30, () => Camera.setVerticalFoV(45)));
results.oneRotateAt30 = await run(1200, once(30, () => Camera.rotate(30, true)));
results.tiltEveryFrameFrom50 = await run(1200, (t) => { if (t >= 50) tiltTo(t); });
results.tiltEvery2ndFrameFrom50 = await run(1200, (t, f) => { if (t >= 50 && f % 2 === 0) tiltTo(t); });
results.tiltEvery3rdFrameFrom50 = await run(1200, (t, f) => { if (t >= 50 && f % 3 === 0) tiltTo(t); });
results.tiltEvery60msFrom50 = await run(1200, everyMs(60, 50, tiltTo));
results.tiltEvery100msFrom50 = await run(1200, everyMs(100, 50, tiltTo));
results.tiltEvery150msFrom50 = await run(1200, everyMs(150, 50, tiltTo));
results.lensEveryFrameFrom50 = await run(1200, (t) => {
  if (t >= 50) Camera.setVerticalFoV(35 + Math.min(10, t / 50));
});
results.rotateEveryFrameFrom50 = await run(1200, (t) => { if (t >= 50) Camera.rotate(Math.min(30, t / 20), true); });
results.rotateEvery100msFrom50 = await run(1200, everyMs(100, 50, (t) => Camera.rotate(Math.min(30, t / 20), true)));
// A tilt every frame for 300 ms, then nothing: does the zoom pick up again by itself? Then the same with the zoom sent
// again at 600 ms.
results.tiltFor300ThenStop = await run(1500, (t) => { if (t >= 50 && t < 300) tiltTo(t); });
results.tiltFor300ThenResend = await run(1500, (() => {
  let resent = false;
  return (t) => {
    if (t >= 50 && t < 300) tiltTo(t);
    else if (t >= 600 && !resent) { resent = true; Camera.zoom(1); }
  };
})());
results.aloneAtEnd = await run(1000, () => {});
await clean();
