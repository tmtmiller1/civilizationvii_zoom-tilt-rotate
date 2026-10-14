// The game moving the camera while the lens is past a limit. A move to a new zoom (here Camera.lookAtPlot with
// zoom 0.5) should put the game's lens back within about a second of the camera arriving, with no input. A move
// that keeps the zoom (lookAtPlot with no zoom, or jumping to a unit ten tiles away the way the action panel does)
// keeps the close-up.
async function toCloseUp() {
  await resetCamera(0.3);
  for (let i = 0; i < 10; i++) {
    scrollIn();
    await waitMs(400);
  }
  await waitMs(1500);
}

async function sampleFor(ms) {
  const samples = [];
  const start = performance.now();
  while (performance.now() - start < ms) {
    await waitMs(100);
    samples.push([Math.round(performance.now() - start), +Camera.getState().zoomLevel.toFixed(2), fieldOfView()]);
  }
  return samples;
}

await toCloseUp();
results.closeUp = cameraState();
Camera.lookAtPlot({ x: capital.location.x + 3, y: capital.location.y });
await waitMs(2500);
results.moveKeepingZoom = cameraState();

Camera.lookAtPlot(capital.location, { zoom: 0.5 });
const samples = await sampleFor(3000);
const arrived = samples.find(([, zoom]) => zoom >= 0.5);
const lensBack = samples.find(([, , degrees]) => degrees !== null && degrees >= 34);
results.moveToZoomHalf = {
  cameraArrivedMs: arrived ? arrived[0] : null,
  lensBackMs: lensBack ? lensBack[0] : null,
  end: cameraState(),
};

await toCloseUp();
const units = Players.get(0).Units.getUnitIds().map((id) => Units.get(id));
const farthest = units
  .map((unit) => [unit, Math.abs(unit.location.x - capital.location.x) + Math.abs(unit.location.y - capital.location.y)])
  .sort((a, b) => b[1] - a[1])[0];
if (farthest && farthest[1] >= 6) {
  const before = Camera.getState().focusPoint;
  UI.Player.selectUnit(farthest[0].id);
  UI.Player.lookAtID(farthest[0].id, 0);
  await waitMs(2500);
  const after = Camera.getState().focusPoint;
  results.jumpToUnit = { tiles: farthest[1], cameraMoved: Math.round(Math.hypot(after.x - before.x, after.y - before.y)), ...cameraState() };
  UI.Player.deselectAllUnits();
} else {
  results.jumpToUnit = "no unit six or more tiles from the capital; place one to run this part";
}
await resetCamera(0.4);
