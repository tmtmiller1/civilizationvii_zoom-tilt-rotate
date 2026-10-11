// Records what happens while someone tests by hand. Paste it into `tower-bench eval`, play, then read
// window.zoomRecording back:
//
//   raw          every input event the game sends: [ms, name, status, x, y]
//   zoomInputs   the zoom, wheel and touch events that reach the camera controller
//   samples      [ms, zoom, field of view, tilt weight], whenever one of them changes
//   drags        for each left-drag: how far the map point under the cursor slipped, as a share of the screen
//
// A UI reload clears it; paste it again afterwards.
(async () => {
  if (window.zoomRecording) return "already recording";
  const controller = (await import("/core/ui/camera/camera-controller.js")).default;
  const { InputEngineEventName } = await import("/core/ui/input/input-support.js");
  const LIMIT = 20000;
  const recording = { raw: [], zoomInputs: [], samples: [], drags: [] };
  window.zoomRecording = recording;
  const started = performance.now();
  const now = () => Math.round(performance.now() - started);
  const keep = (list, entry) => { if (list.length < LIMIT) list.push(entry); };
  const width = () => window.innerWidth;
  const height = () => window.innerHeight;

  function fieldOfView() {
    const centre = Camera.pickWorldPosFromPoint(width() / 2, height() / 2);
    const beside = Camera.pickWorldPosFromPoint(width() * 0.55, height() / 2);
    if (!centre || !beside) return null;
    const eye = Camera.getCurrentPose().position;
    const a = [centre.x - eye.x, centre.y - eye.y, centre.z - eye.z];
    const b = [beside.x - eye.x, beside.y - eye.y, beside.z - eye.z];
    const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
    const angle = Math.acos(Math.min(1, cos));
    return Math.round(Math.atan(Math.tan(angle) / (0.1 * width() / height())) * 360 / Math.PI);
  }

  function screenWidthOnGround() {
    const left = Camera.pickWorldPosFromPoint(width() * 0.4, height() / 2);
    const right = Camera.pickWorldPosFromPoint(width() * 0.6, height() / 2);
    return left && right ? Math.hypot(left.x - right.x, left.y - right.y) / 0.2 : null;
  }

  window.addEventListener(InputEngineEventName, (event) => {
    const detail = event.detail || {};
    if (detail.name) keep(recording.raw, [now(), detail.name, detail.status, +detail.x || 0, +detail.y || 0]);
  });

  const prototype = Object.getPrototypeOf(controller);
  const handleInput = prototype.handleInput;
  prototype.handleInput = function (inputEvent) {
    const detail = inputEvent.detail;
    if (/zoom|pinch|wheel|touch/.test(detail.name)) {
      keep(recording.zoomInputs, [now(), detail.name, detail.status, +detail.x || 0, +detail.y || 0]);
    }
    return handleInput.call(this, inputEvent);
  };

  let lastSample = "";
  setInterval(() => {
    const state = Camera.getState();
    const sample = [+state.zoomLevel.toFixed(2), fieldOfView(), +state.tiltWeight.toFixed(2)];
    if (sample.join() !== lastSample) {
      keep(recording.samples, [now(), ...sample]);
      lastSample = sample.join();
    }
  }, 100);

  let drag = null;
  window.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    const ground = Camera.pickWorldPosFromPoint(event.clientX, event.clientY);
    drag = ground && { at: now(), ground, x: event.clientX, y: event.clientY, slip: 0, moved: 0 };
  }, true);
  window.addEventListener("mousemove", (event) => {
    if (!drag || !(event.buttons & 1)) return;
    const ground = Camera.pickWorldPosFromPoint(event.clientX, event.clientY);
    if (!ground) return;
    drag.slip = Math.max(drag.slip, Math.hypot(ground.x - drag.ground.x, ground.y - drag.ground.y));
    drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.x, event.clientY - drag.y));
  }, true);
  window.addEventListener("mouseup", (event) => {
    if (!drag || event.button !== 0) return;
    if (drag.moved > 30) {
      const slip = 100 * drag.slip / screenWidthOnGround();
      keep(recording.drags, { at: drag.at, movedPixels: Math.round(drag.moved), slipPercent: +slip.toFixed(1) });
    }
    drag = null;
  }, true);

  return "recording";
})()
