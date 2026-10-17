// What Camera.restoreDefaults() does to the heading on its own. The mod's put-back only runs when it holds a
// heading, so turn the camera with Camera.rotate directly (the mod's heading stays north) and watch the engine.
const rotation = () => +Camera.getState().rotation.toFixed(1);
async function sampleFrames(ms) {
  const out = [];
  const start = performance.now();
  while (performance.now() - start < ms) {
    out.push([Math.round(performance.now() - start), rotation()]);
    await nextFrame();
  }
  return out;
}
const command = (action, value) =>
  window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, value } }));

await resetCamera(0.4);
command("backToNormal");
await waitMs(1200);
results.start = rotation();

// Is rotate(x, true) instant or eased?
Camera.rotate(-180, true);
results.rotateHold = await sampleFrames(400);

// The engine's reset on its own.
Camera.restoreDefaults();
results.restoreAlone = await sampleFrames(1500);

// Reset, then one hold call on the next frame.
Camera.rotate(-180, true);
await waitMs(500);
Camera.restoreDefaults();
await nextFrame();
Camera.rotate(-180, true);
results.restoreThenOneHold = await sampleFrames(1500);

// Reset, then a hold call every frame for 1.2 s.
Camera.rotate(-180, true);
await waitMs(500);
Camera.restoreDefaults();
{
  const out = [];
  const start = performance.now();
  while (performance.now() - start < 1200) {
    Camera.rotate(-180, true);
    out.push([Math.round(performance.now() - start), rotation()]);
    await nextFrame();
  }
  results.restoreThenHoldEveryFrame = out;
  results.afterHoldStops = await sampleFrames(800);
}

// rotate(0, false): the game's own release to north.
Camera.rotate(-180, true);
await waitMs(500);
Camera.rotate(0, false);
results.releaseToNorth = await sampleFrames(1500);

command("backToNormal");
await waitMs(1200);
results.end = rotation();
