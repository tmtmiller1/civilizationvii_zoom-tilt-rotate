// "Keep the angle when zoomed far out": with the box ticked, the angle on screen and the lens after each notch out
// from the game's farthest view, at the game's own angle and then at 60 degrees (which has to tip down near the far
// end to keep the sky off the screen), and clearing the box while far out. Leaves the box as it found it.

const settings = await import("/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-settings.js");
const wasKept = settings.getKeepAngleFarOut();

function angleOnScreen() {
  const centre = Camera.pickWorldPosFromPoint(screenWidth / 2, screenHeight / 2);
  if (!centre) return null;
  const eye = Camera.getCurrentPose().position;
  return +(Math.atan2(Math.hypot(centre.x - eye.x, centre.y - eye.y), eye.z - centre.z) * 180 / Math.PI).toFixed(1);
}
const command = (action, value) =>
  window.dispatchEvent(new CustomEvent("zoom-tilt-rotate-command", { detail: { action, value } }));

async function notchesOut() {
  const rows = [];
  for (let n = 1; n <= 7; n++) {
    scrollOut();
    await waitMs(1400);
    rows.push({ notch: n, lens: fieldOfView(), angle: angleOnScreen(), expected: null });
  }
  return rows;
}

settings.setKeepAngleFarOut(true);
command("backToNormal");
await waitMs(1500);
await resetCamera(1);
results.gameAngle = { start: angleOnScreen(), notches: await notchesOut() };

command("backToNormal");
await waitMs(1500);
await resetCamera(1);
command("setAngle", 60);
await waitMs(2500);
const steep = { start: angleOnScreen(), notches: await notchesOut() };
for (const row of steep.notches) row.expected = Math.min(60, 85 - row.lens / 2);
results.angle60 = steep;

settings.setKeepAngleFarOut(false);
await waitMs(1200);
results.afterClearing = { lens: fieldOfView(), angle: angleOnScreen() };

settings.setKeepAngleFarOut(wasKept);
command("backToNormal");
await waitMs(1500);
