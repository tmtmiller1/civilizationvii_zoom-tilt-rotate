// UI reload, as at an age transition. Part 1 goes two notches past the far limit and reloads the UI; run
// reload-part-2.js once the game is back.
await resetCamera(1);
scrollOut();
await waitFrames(20);
scrollOut();
await waitMs(1500);
results.beforeReload = cameraState();
setTimeout(() => UI.reloadUI(), 300);
