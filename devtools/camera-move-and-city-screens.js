// Game camera move: one notch out past the far limit, the game moves the camera to zoom 0.5, then one notch in.
// The notch in should step in, not jump back out.
//
// City screens: one notch out past the far limit, open the buy-tile or place-building screen, close it. The view
// should come back past the limit, where it was.
const where = () => ({ screen: InterfaceMode.getCurrent().replace("INTERFACEMODE_", ""), ...cameraState() });

await resetCamera(1);
scrollOut();
await waitMs(1500);
results.cameraMove = { pastLimit: where() };
Camera.lookAtPlot(capital.location, { zoom: 0.5 });
await waitMs(1500);
results.cameraMove.afterGameMove = where();
scrollIn();
await waitMs(1500);
results.cameraMove.afterNotchIn = where();

const monument = GameInfo.Constructibles.lookup("BUILDING_MONUMENT").$hash;
const screens = {
  ACQUIRE_TILE: { CityID: capitalId },
  PLACE_BUILDING: { CityID: capitalId, OperationArguments: { ConstructibleType: monument }, IsPurchasing: false },
};
for (const [screen, context] of Object.entries(screens)) {
  await resetCamera(1);
  scrollOut();
  await waitMs(1500);
  const visit = { before: where() };
  InterfaceMode.switchTo(`INTERFACEMODE_${screen}`, context);
  await waitMs(2000);
  visit.open = where();
  InterfaceMode.switchToDefault();
  await waitMs(2000);
  visit.afterClose = where();
  results[screen] = visit;
}
await resetCamera(0.4);
