// Touch pinch. touch-pinch-in reaches cameraZoomIn like a scroll notch. touch-pinch-direct sets the zoom from
// where the touch began: from past the limit it should come back to a plain zoom and the game's lens, and from
// 0.1 a wide enough pinch should go past the limit.
const S = InputActionStatuses;
const touch = (name, status, x, y) => controller.handleInput({ detail: { name, status, x, y } });

await resetCamera(0.27);
for (let i = 0; i < 6; i++) {
  touch("touch-pinch-in", FINISH, 0.3, 0);
  await waitFrames(15);
}
await waitMs(1200);
results.pinchSteps = cameraState();

touch("touch-begin", S.START, 0, 0);
touch("touch-pinch-direct", S.UPDATE, 0.5, 1.0);
await waitMs(1500);
results.directPinchBackOut = cameraState();

await resetCamera(0.1);
touch("touch-begin", S.START, 0, 0);
touch("touch-pinch-direct", S.UPDATE, 0.6, 0.4);
await waitMs(1800);
results.directPinchPastLimit = cameraState();
await resetCamera(0.3);
