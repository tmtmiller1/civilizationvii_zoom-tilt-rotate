// A trackpad's two-finger scroll arrives as a stream of wheel events, about 140 a second. A swipe should follow the
// camera instead of jumping to the end of the range, and reversing in the middle of a stream should land where the
// last events point.
async function stream(scroll, count, ms) {
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    scroll();
    while (performance.now() < start + (i + 1) * ms / count) await nextFrame();
  }
}

await resetCamera(0.4);
await stream(scrollOut, 214, 1500);
results.afterSwipeOut = cameraState();
await stream(scrollIn, 84, 600);
await waitMs(1500);
results.afterShortSwipeIn = cameraState();
await stream(scrollIn, 214, 1500);
await waitMs(2000);
results.afterLongSwipeIn = cameraState();

await resetCamera(0.4);
await stream(scrollOut, 30, 300);
scrollIn();
scrollOut();
scrollOut();
await waitMs(3000);
results.afterReversal = cameraState();
await resetCamera(0.4);
