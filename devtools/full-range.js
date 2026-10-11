// Ten notches in from 0.27 and ten out from 0.73, one at a time. The zoom stops at 0 and 1, then the field of view
// carries on for six notches to 5 degrees going in and 90 going out, and stops there.
async function notch(scroll) {
  scroll();
  await waitMs(1300);
  const { zoom, fieldOfView, tilt } = cameraState();
  return [zoom, fieldOfView, tilt];
}

await resetCamera(0.27);
results.in = [];
for (let i = 0; i < 10; i++) results.in.push(await notch(scrollIn));

await resetCamera(0.73);
results.out = [];
for (let i = 0; i < 10; i++) results.out.push(await notch(scrollOut));

await resetCamera(0.4);
