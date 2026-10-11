// Shared setup for the tests. run.sh pastes this file and then a test into one async function, runs it in the
// game, and prints `results` when the test finishes.

const controller = (await import("/core/ui/camera/camera-controller.js")).default;
const { InterfaceMode } = await import("/core/ui/interface-modes/interface-modes.js");

const results = {};
const FINISH = InputActionStatuses.FINISH;
const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight;

const capitalId = Players.get(0).Cities.getCityIds()[0];
const capital = Cities.get(capitalId);

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFrames(count) {
  for (let i = 0; i < count; i++) await nextFrame();
}

// Ground covered by the middle fifth of the screen, near the bottom. Smaller means closer.
function groundSpan() {
  const left = Camera.pickWorldPosFromPoint(screenWidth * 0.4, screenHeight * 0.8);
  const right = Camera.pickWorldPosFromPoint(screenWidth * 0.6, screenHeight * 0.8);
  return left && right ? Math.round(Math.hypot(left.x - right.x, left.y - right.y)) : null;
}

// The camera's vertical field of view, measured the same way the mod measures it.
function fieldOfView() {
  const centre = Camera.pickWorldPosFromPoint(screenWidth / 2, screenHeight / 2);
  const beside = Camera.pickWorldPosFromPoint(screenWidth * 0.55, screenHeight / 2);
  if (!centre || !beside) return null;
  const eye = Camera.getCurrentPose().position;
  const a = [centre.x - eye.x, centre.y - eye.y, centre.z - eye.z];
  const b = [beside.x - eye.x, beside.y - eye.y, beside.z - eye.z];
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
  const angle = Math.acos(Math.min(1, cos));
  return Math.round(Math.atan(Math.tan(angle) / (0.1 * screenWidth / screenHeight)) * 360 / Math.PI);
}

function cameraState() {
  const state = Camera.getState();
  return {
    zoom: +state.zoomLevel.toFixed(2),
    fieldOfView: fieldOfView(),
    tilt: `${Math.round(state.customTilt)}/${state.tiltWeight.toFixed(2)}`,
    span: groundSpan(),
  };
}

// Back to the default screen and lens, centred on the capital at the given zoom.
async function resetCamera(zoom) {
  InterfaceMode.switchToDefault();
  Camera.setVerticalFoV(35);
  Camera.setTilt(0, 0);
  controller.zoomInProgress = 0;
  Camera.lookAtPlot(capital.location, { zoom });
  await waitMs(1200);
}

// One mouse-wheel notch, through the controller the way the game delivers it.
const scrollIn = () => controller.handleInput({ detail: { name: "mousewheel-up", status: FINISH, x: 5, y: 0 } });
const scrollOut = () => controller.handleInput({ detail: { name: "mousewheel-down", status: FINISH, x: -5, y: 0 } });
