// Two notches at the closest zoom, sent 1 to 10 frames apart. Every spacing should end past the limit, with the
// field of view under the game's 35 degrees.
for (const gap of [1, 3, 6, 10]) {
  await resetCamera(0.05);
  scrollIn();
  await waitFrames(gap);
  scrollIn();
  await waitMs(1500);
  results[`${gap} frames apart`] = cameraState();
}
await resetCamera(0.3);
