// Stands in for /core/ui/camera/camera-controller.js. Like the game's, it's a singleton whose handlers sit on its
// class's prototype, and its handleInput passes a wheel notch on to cameraZoomIn or cameraZoomOut at the controller's
// 0.3 rate. passedOn lists every event that reached it.

import { InputHandlerState } from "./input-support.mjs";

const ZOOM_RATE = 0.3;

class CameraControllerSingleton {
  zoomInProgress = 0;
  passedOn = [];

  cameraZoomIn() {}

  cameraZoomOut() {}

  cameraRotate() {}

  handleInput(inputEvent) {
    const { name, status } = inputEvent.detail;
    this.passedOn.push(name);
    if (name === "mousewheel-up" && status === InputActionStatuses.FINISH) this.cameraZoomIn(status, ZOOM_RATE);
    if (name === "mousewheel-down" && status === InputActionStatuses.FINISH) this.cameraZoomOut(status, ZOOM_RATE);
    return name.startsWith("mousewheel") ? InputHandlerState.Handled : InputHandlerState.Active;
  }
}

export default new CameraControllerSingleton();
