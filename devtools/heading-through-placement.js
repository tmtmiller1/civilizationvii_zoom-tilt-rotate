// Face south, open and close the place-building screen, and sample the heading every frame: it should hold.
// Three ways in: the game's lens, with the angle tipped to 50, and from the close-up lens.
const state = () => {
  const s = Camera.getState();
  return { screen: InterfaceMode.getCurrent().replace("INTERFACEMODE_", ""), rotation: +s.rotation.toFixed(1), zoom: +s.zoomLevel.toFixed(2), tilt: `${Math.round(s.customTilt)}/${s.tiltWeight.toFixed(2)}`, fov: fieldOfView() };
};
const offSouth = (r) => Math.abs(((r - 180) % 360 + 540) % 360 - 180);
async function watchHeading(ms) {
  const start = performance.now();
  let strayed = 0, first = null, last = null;
  while (performance.now() - start < ms) {
    const r = Camera.getState().rotation;
    if (first === null) first = +r.toFixed(1);
    last = +r.toFixed(1);
    strayed = Math.max(strayed, offSouth(r));
    await nextFrame();
  }
  return { first, last, strayedDegrees: +strayed.toFixed(1) };
}
const command = (action, value) =>
  window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, value } }));
const monument = GameInfo.Constructibles.lookup("BUILDING_MONUMENT").$hash;
const placeBuilding = { CityID: capitalId, OperationArguments: { ConstructibleType: monument }, IsPurchasing: false };

async function visit(name) {
  const out = { before: state() };
  InterfaceMode.switchTo("INTERFACEMODE_PLACE_BUILDING", placeBuilding);
  out.opening = await watchHeading(2000);
  out.open = state();
  InterfaceMode.switchToDefault();
  out.closing = await watchHeading(2000);
  out.after = state();
  results[name] = out;
}

await resetCamera(0.4);
command("backToNormal");
await waitMs(1200);
command("setHeading", 180);
await waitMs(1500);
await visit("gameLens");

command("setAngle", 50);
await waitMs(1500);
await visit("tipped50");

command("backToNormal");
await waitMs(1200);
await resetCamera(0.3);
command("setHeading", 180);
for (let i = 0; i < 10; i++) { scrollIn(); await waitMs(400); }
await waitMs(1500);
await visit("closeUp");

command("backToNormal");
await waitMs(1500);
results.end = state();
