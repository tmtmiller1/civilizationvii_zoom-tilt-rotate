// Replays a zoom-in gesture recorded from a Mac trackpad (gesture-zoom-in.json: [ms, event, x]), with its original
// timing. The scroll ends in a run of events with x = 0 that the game names mousewheel-down. Played whole, the
// view should end at the same place as when only the non-zero events are played: no spring back.
async function replay(events) {
  const start = performance.now();
  const end = events[events.length - 1][0] + 2500;
  let next = 0;
  let closest = Infinity;
  while (performance.now() - start < end) {
    const now = performance.now() - start;
    while (next < events.length && events[next][0] <= now) {
      const [, name, x] = events[next++];
      controller.handleInput({ detail: { name, status: FINISH, x, y: 0 } });
    }
    closest = Math.min(closest, fieldOfView() ?? Infinity);
    await nextFrame();
  }
  return { closestFieldOfView: closest, end: cameraState() };
}

await resetCamera(0.4);
results.wholeGesture = await replay(recordedGesture);
await resetCamera(0.4);
results.withoutZeroEvents = await replay(recordedGesture.filter((event) => event[2] !== 0));
await resetCamera(0.4);

// A tail on its own at the close-up, more than a second after any real scroll: six zero events over 120 ms. A
// trackpad sends this when the fingers rest and lift without moving. The lens should stay at the close-up (0.1 eased
// out to 13 degrees).
await resetCamera(0.3);
for (let i = 0; i < 10; i++) {
  scrollIn();
  await waitMs(400);
}
await waitMs(2500);
results.lateTail = { before: cameraState() };
for (let i = 0; i < 6; i++) {
  controller.handleInput({ detail: { name: "mousewheel-down", status: FINISH, x: 0, y: 0 } });
  await waitMs(20);
}
await waitMs(2000);
results.lateTail.after = cameraState();
await resetCamera(0.4);
