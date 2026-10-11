// A held trigger sends camera-zoom-in every frame with x = how far it is pressed. This compares the mod with the
// base game's formula (cameraZoomIn in core/ui/camera/camera-controller.js) at full and light press, then holds
// the trigger past the limit to check the lens follows and stops close to where the trigger is let go.
const S = InputActionStatuses;
const throughMod = (status, x) => controller.handleInput({ detail: { name: "camera-zoom-in", status, x } });

function baseGameFormula(status, x) {
  const press = (status === S.START || status === S.UPDATE) && x === 0 ? 1 : x;
  Camera.zoom(Math.max(Camera.getState().zoomLevel - 0.3 * press, 0));
}

async function hold(send, press, frames) {
  const zooms = [];
  send(S.START, press);
  for (let i = 0; i < frames; i++) {
    await nextFrame();
    send(S.UPDATE, press);
    if (i % 3 === 2) zooms.push(+Camera.getState().zoomLevel.toFixed(2));
  }
  send(S.FINISH, press);
  await waitMs(900);
  return { whileHeld: zooms, settled: cameraState() };
}

for (const press of [1, 0.3]) {
  await resetCamera(1);
  results[`base game, press ${press}`] = await hold(baseGameFormula, press, 18);
  await resetCamera(1);
  results[`mod, press ${press}`] = await hold(throughMod, press, 18);
}

await resetCamera(0.2);
results["mod, held past the limit"] = await hold(throughMod, 1, 24);
await resetCamera(0.3);
