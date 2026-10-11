// UI reload, part 2: the camera should start fresh with the game's lens, and notches should step normally.
results.afterReload = cameraState();
scrollIn();
await waitMs(1500);
results.notchIn = cameraState();
scrollIn();
await waitMs(1500);
results.secondNotchIn = cameraState();
await resetCamera(0.3);
