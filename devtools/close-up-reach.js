// The "How close you can zoom in" option. For each reach, eight notches in from zoom 0.2: the lens should step down
// to 5, 2 or 1 degrees in six notches and stop there. Then, sitting at the 1 degree close-up, switch the option to
// "Closer": within about two seconds the lens should ease out to 5 degrees with the zoom unchanged. The option is
// put back the way it was at the end.
const settings = await import("/tmt-zoom-tilt-rotate/ui/zoom-tilt-rotate-settings.js");
const original = settings.getCloseUpReach().id;
const measure = () => +(fieldOfView() ?? 0);

for (const reach of settings.CLOSE_UP_REACHES) {
  settings.setCloseUpReach(reach.id);
  await resetCamera(0.2);
  const steps = [];
  for (let i = 0; i < 8; i++) {
    scrollIn();
    await waitMs(1300);
    steps.push(measure());
  }
  results[reach.id] = steps;
}

settings.setCloseUpReach("closer");
await waitMs(2500);
results.switchedToCloserAtOneDegree = cameraState();

settings.setCloseUpReach(original);
await resetCamera(0.4);
