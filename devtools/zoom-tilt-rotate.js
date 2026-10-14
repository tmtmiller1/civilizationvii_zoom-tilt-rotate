// The camera's angle and heading. Taps step onto the grid, a held command glides and stops where it's let go,
// panning follows the screen when the view is turned, Camera.restoreDefaults() (closing a city screen) puts the
// angle and heading back, and Back to normal returns to north and the game's own angle. Commands are sent the way
// the keys and the panel send them.
const command = (action, phase) => window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, phase } }));
const view = () => {
  const state = Camera.getState();
  return { heading: +(+state.rotation).toFixed(1), tilt: +(+state.customTilt).toFixed(1), weight: +(+state.tiltWeight).toFixed(2) };
};
const { InputEngineEvent } = await import("/core/ui/input/input-support.js");
const arrowKey = (status) => controller.handleInput(new InputEngineEvent("keyboard-nav-right", status, 0, 0, false, false));

command("backToNormal");
await waitMs(800);
Camera.lookAtPlot({ x: Math.round(GameplayMap.getGridWidth() / 2), y: Math.round(GameplayMap.getGridHeight() / 2) }, { zoom: 0.45 });
await waitMs(1500);

command("turnRight");
await waitMs(900);
results.tapTurnRight = view();
command("turnRight", "start");
await waitMs(1350);
command("turnRight", "end");
await waitMs(300);
results.holdTurnRightOneSecond = view();
command("tiltUp");
await waitMs(900);
results.tapAngleUp = view();

// Panning while turned: the focus should move toward the screen's right, cos close to 1.
const left = Camera.pickWorldPosFromPoint(screenWidth * 0.4, screenHeight / 2);
const right = Camera.pickWorldPosFromPoint(screenWidth * 0.6, screenHeight / 2);
const before = Camera.getState().focusPoint;
arrowKey(InputActionStatuses.START);
await waitMs(300);
arrowKey(InputActionStatuses.FINISH);
await waitMs(1000);
const after = Camera.getState().focusPoint;
const moved = [after.x - before.x, after.y - before.y], screenRight = [right.x - left.x, right.y - left.y];
results.panMatchesScreenRight = +((moved[0] * screenRight[0] + moved[1] * screenRight[1])
  / (Math.hypot(...moved) * Math.hypot(...screenRight))).toFixed(3);

const kept = view();
Camera.restoreDefaults();
await waitMs(1200);
results.afterRestoreDefaults = { before: kept, after: view() };

command("backToNormal");
await waitMs(1200);
results.backToNormal = view();
await resetCamera(0.4);
