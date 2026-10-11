// Keyboard panning should cross the same share of the screen at any zoom, and stay right after something else
// resets the lens (Camera.restoreDefaults() leaves the zoom where it is). After the reset, one notch out should
// go to a plain zoom of 0.09.
function screenWidthOnGround() {
  const left = Camera.pickWorldPosFromPoint(screenWidth * 0.4, screenHeight / 2);
  const right = Camera.pickWorldPosFromPoint(screenWidth * 0.6, screenHeight / 2);
  return Math.hypot(left.x - right.x, left.y - right.y) / 0.2;
}

async function panStep() {
  const width = screenWidthOnGround();
  const before = Camera.getState().focusPoint;
  Camera.panFocus({ x: 10, y: 0 });
  await waitMs(600);
  const after = Camera.getState().focusPoint;
  const moved = Math.hypot(after.x - before.x, after.y - before.y);
  return { ...cameraState(), panPercentOfScreen: +(100 * moved / width).toFixed(1) };
}

await resetCamera(0);
results.normal = await panStep();
for (let i = 0; i < 4; i++) {
  scrollIn();
  await waitFrames(5);
}
await waitMs(1500);
results.pastLimit = await panStep();
Camera.restoreDefaults();
await waitMs(1500);
results.afterLensReset = await panStep();
scrollOut();
await waitMs(1500);
results.notchOut = cameraState();
await resetCamera(0.4);
