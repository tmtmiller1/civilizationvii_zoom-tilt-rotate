// A reveal with the lens past a limit and the view turned, then restoreDefaults. Revealing the whole map can start the
// game's own wonder and natural-wonder reveal moves, which take the camera; the samples show what the camera did while
// that ran. Then Camera.restoreDefaults() (what closing a city screen calls): the lens should be back at the game's
// 35 degrees and stay there; once it was read at 25.6 degrees 2.5 s after the call. This reveals the whole map, so run
// it in a lab game.
const command = (action, phase) => window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, phase } }));
const view = () => {
  const state = Camera.getState();
  return { zoom: +state.zoomLevel.toFixed(2), fov: fieldOfView(), heading: +(+state.rotation).toFixed(1), tilt: +(+state.customTilt).toFixed(1) };
};

command("backToNormal");
await waitMs(800);
await resetCamera(0.3);
for (let i = 0; i < 10; i++) {
  scrollIn();
  await waitMs(400);
}
await waitMs(1500);
command("turnRight");
await waitMs(1200);
results.beforeReveal = view();

Visibility.revealAllPlots(GameContext.localPlayerID);
const during = [];
const start = performance.now();
while (performance.now() - start < 8000) {
  await waitMs(250);
  during.push([Math.round(performance.now() - start), view()]);
}
results.duringReveal = during.filter((s, i) => i % 4 === 0 || i === during.length - 1);
results.afterReveal = view();

Camera.restoreDefaults();
const restore = [];
const t0 = performance.now();
while (performance.now() - t0 < 3200) {
  await waitMs(100);
  restore.push([Math.round(performance.now() - t0), fieldOfView()]);
}
results.afterRestore = restore.filter((s, i) => i % 5 === 0);
results.restoreAt2500 = restore.find(([ms]) => ms >= 2500);
results.restoreMinFov = Math.min(...restore.map(([, fov]) => fov ?? 99));
results.end = view();
command("backToNormal");
