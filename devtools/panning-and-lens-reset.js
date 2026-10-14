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

// Held arrow key, half a second, measured as the distance the focus travels frame by frame over the screen's width
// on the ground. The map wraps, so a before-and-after distance reads as the map width minus the real one once a pan
// crosses the seam; a jump of more than 800 world units between frames is the seam and counts as the previous step.
// The game's own range is about 1.56 screens at its closest view and 0.80 at its farthest; every point past the
// limits should land in that band.
const { InputEngineEvent } = await import("/core/ui/input/input-support.js");
const arrowKey = (status) => controller.handleInput(new InputEngineEvent("keyboard-nav-right", status, 0, 0, false, false));

async function heldPan() {
  const left = Camera.pickWorldPosFromPoint(screenWidth * 0.45, screenHeight / 2);
  const right = Camera.pickWorldPosFromPoint(screenWidth * 0.55, screenHeight / 2);
  const width = Math.hypot(left.x - right.x, left.y - right.y) / 0.1;
  let previous = Camera.getState().focusPoint, path = 0, lastStep = 0;
  arrowKey(InputActionStatuses.START);
  const start = performance.now();
  let released = false;
  while (performance.now() - start < 2000) {
    if (!released && performance.now() - start >= 500) {
      arrowKey(InputActionStatuses.FINISH);
      released = true;
    }
    await nextFrame();
    const focus = Camera.getState().focusPoint;
    const dx = focus.x - previous.x, dy = focus.y - previous.y;
    if (Math.abs(dx) < 800) lastStep = Math.hypot(dx, dy);
    path += lastStep;
    previous = focus;
  }
  return { ...cameraState(), screensIn500ms: +(path / width).toFixed(2) };
}

async function panAfterNotches(zoom, scroll, count) {
  await resetCamera(zoom);
  for (let i = 0; i < count; i++) {
    scroll();
    await waitMs(400);
  }
  await waitMs(1500);
  return heldPan();
}

results.heldPan = {
  gameClosest: await panAfterNotches(0, scrollIn, 0),
  threeIn: await panAfterNotches(0, scrollIn, 3),
  sixIn: await panAfterNotches(0, scrollIn, 6),
  gameFarthest: await panAfterNotches(1, scrollOut, 0),
  threeOut: await panAfterNotches(1, scrollOut, 3),
  sixOut: await panAfterNotches(1, scrollOut, 6),
};
await resetCamera(0.4);
