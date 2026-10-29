// Ways to move the lens and the angle together far out, compared on the engine directly (the mod's own far-out code
// isn't used: the zoom is parked at the game's farthest view and the calls go straight to the camera). For each way,
// one notch, then a spin of six notches 150 ms apart, recorded every frame as [ms, lens progress, angle progress].
// Progress runs 0 to 1 from where the move started to where it's headed, so the two lines should lie on each other.

const GAME_LENS = 35, FAR_LENS = 90, GAME_ANGLE = 40;

function lensNow() {
  const centre = Camera.pickWorldPosFromPoint(screenWidth / 2, screenHeight / 2);
  const beside = Camera.pickWorldPosFromPoint(screenWidth * 0.55, screenHeight / 2);
  if (!centre || !beside) return null;
  const eye = Camera.getCurrentPose().position;
  const a = [centre.x - eye.x, centre.y - eye.y, centre.z - eye.z];
  const b = [beside.x - eye.x, beside.y - eye.y, beside.z - eye.z];
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
  return Math.atan(Math.tan(Math.acos(Math.min(1, cos))) / (0.1 * screenWidth / screenHeight)) * 360 / Math.PI;
}
const lensFor = (share) => GAME_LENS + (FAR_LENS - GAME_LENS) * share;
const shareForLens = (lens) => Math.min(1, Math.max(0, (lens - GAME_LENS) / (FAR_LENS - GAME_LENS)));

// Each way gets notch(share) when a notch lands, and frame() every frame.
const WAYS = {
  // Both calls once per notch, at the same moment.
  together: () => ({
    notch(share) { Camera.setVerticalFoV(lensFor(share)); Camera.setTilt(0, share); },
    frame() {},
  }),
  // The lens once per notch; the tilt every frame, for the lens on screen.
  follow: () => ({
    notch(share) { Camera.setVerticalFoV(lensFor(share)); },
    frame() { const lens = lensNow(); if (lens !== null) Camera.setTilt(0, shareForLens(lens)); },
  }),
  // The same, aimed where the lens will be a little later, to make up for the engine's smoothing of each tilt call.
  followAhead: (lead = 0.55) => {
    let target = 0;
    return {
      notch(share) { target = share; Camera.setVerticalFoV(lensFor(share)); },
      frame() {
        const lens = lensNow();
        if (lens === null) return;
        const shown = shareForLens(lens);
        Camera.setTilt(0, shown + (target - shown) * lead);
      },
    };
  },
};

async function park() {
  Camera.setVerticalFoV(GAME_LENS);
  Camera.setTilt(0, 0);
  await waitMs(1500);
}

async function run(way, shares, spacing, durationMs) {
  await park();
  const start = performance.now();
  const rows = [];
  let next = 0;
  while (performance.now() - start < durationMs) {
    const now = performance.now() - start;
    if (next < shares.length && now >= 100 + next * spacing) way.notch(shares[next++]);
    way.frame();
    const goal = shares[Math.max(0, next - 1)];
    const lensP = shareForLens(lensNow() ?? GAME_LENS) / shares[shares.length - 1];
    const tiltP = Camera.getState().tiltWeight / shares[shares.length - 1];
    rows.push([Math.round(now), +lensP.toFixed(3), +tiltP.toFixed(3), +(goal / shares[shares.length - 1]).toFixed(3)]);
    await nextFrame();
  }
  return rows;
}

await resetCamera(1);
const tries = typeof LEADS === "undefined" ? Object.entries(WAYS).map(([name, make]) => [name, () => make()])
  : LEADS.map((lead) => ["ahead" + lead, () => WAYS.followAhead(lead)]);
for (const [name, make] of tries) {
  results[name + "One"] = await run(make(), [1 / 6], 0, 1300);
  results[name + "Spin"] = await run(make(), [1, 2, 3, 4, 5, 6].map((n) => n / 6), 150, 2200);
}
await park();
