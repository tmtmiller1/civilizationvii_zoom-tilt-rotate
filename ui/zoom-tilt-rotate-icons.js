// zoom-tilt-rotate-icons.js - the map's resource icons at angles the game never uses. The game draws them at one size
// on screen wherever their tile is, which suits its own camera, but tilted toward the horizon the far ones pile up
// into a wall. While the mod holds the camera at its own angle, the icons are drawn the way the game draws them in its
// city-growth lens instead: in the world, so they shrink with distance, and sized so the ones in the middle of the
// screen match the game's.

import { ResourceLensLayer } from "/base-standard/ui/lenses/layer/resource-layer.js";

const GAME_FIELD_OF_VIEW = 35;
const halfTan = (degrees) => Math.tan(degrees * Math.PI / 360);

// The city-growth lens's numbers: an icon the resource layer draws at 42 pixels is scale 1 in the world, and its
// offsets are scaled by 16/42 (city-growth-improvements-layer.js).
const WORLD_SCALE_PER_PIXEL = 1 / 42;
const WORLD_OFFSET_PER_PIXEL = 16 / 42;

// Measured in game: at the game's lens, a world scale of this much per unit of distance from the camera to the middle
// of the screen draws an icon there at the resource layer's own size.
const MATCH_PER_DISTANCE = 0.00085;

let fieldOfView = GAME_FIELD_OF_VIEW;
let inWorld = false;
let following = false;
let globalScale = 1;
let builtInWorld = false;

const layer = ResourceLensLayer.instance;

const toWorld = (options = {}) => {
  const world = { ...options, scale: (options.scale ?? 42) * WORLD_SCALE_PER_PIXEL };
  if (options.offset) {
    world.offset = { x: options.offset.x * WORLD_OFFSET_PER_PIXEL, y: options.offset.y * WORLD_OFFSET_PER_PIXEL };
  }
  return world;
};

// Stands in for one of the layer's sprite grids. Everything the layer draws goes to the game's grid and to one drawn in
// the world, so the two always hold the same icons, and only one of them is ever shown.
class TwinGrid {
  constructor(screenGrid, name) {
    this.screenGrid = screenGrid;
    this.worldGrid = WorldUI.createSpriteGrid(name, SpriteMode.Billboard);
    this.worldGrid.setVisible(false);
    this.wanted = screenGrid.isVisible();
    this.worldOnly = false;
  }
  show() {
    this.screenGrid.setVisible(this.wanted && !inWorld);
    this.worldGrid.setVisible(this.wanted && inWorld);
  }
  // Fill the world grid alone, from the layer's own drawing code.
  drawInWorldOnly(draw) {
    this.worldOnly = true;
    try {
      draw();
    } finally {
      this.worldOnly = false;
    }
  }
  addSprite(location, asset, position, options) {
    this.worldGrid.addSprite(location, asset, position, toWorld(options));
    if (!this.worldOnly) this.screenGrid.addSprite(location, asset, position, options);
  }
  addSpriteFOW(location, asset, assetFow, position, options) {
    this.worldGrid.addSpriteFOW(location, asset, assetFow, position, toWorld(options));
    if (!this.worldOnly) this.screenGrid.addSpriteFOW(location, asset, assetFow, position, options);
  }
  addText(...args) {
    return this.screenGrid.addText(...args);
  }
  clearPlot(location) {
    this.worldGrid.clearPlot(location);
    this.screenGrid.clearPlot(location);
  }
  clear() {
    this.worldGrid.clear();
    this.screenGrid.clear();
  }
  setScale(scale) {
    globalScale = scale;
    this.screenGrid.setScale(scale);
  }
  getScale() {
    return this.screenGrid.getScale();
  }
  setVisible(visible) {
    this.wanted = !!visible;
    this.show();
  }
  isVisible() {
    return this.wanted;
  }
  destroy() {
    this.worldGrid.destroy();
    this.screenGrid.destroy();
  }
}

const twins = [
  layer.resourceSpriteGrid = new TwinGrid(layer.resourceSpriteGrid, "ZoomTiltRotate_Resources"),
  layer.resourceTypeSpriteGrid = new TwinGrid(layer.resourceTypeSpriteGrid, "ZoomTiltRotate_ResourceClasses"),
];

// The world grids start empty: the layer drew its icons before this script ran. Draw them the first time they're
// needed, with the layer's own code, skipping the plots a lens is holding back. After that every change reaches both.
function buildWorldIcons() {
  builtInWorld = true;
  const player = Players.get(GameContext.localPlayerID);
  if (!player) return;
  const draw = () => {
    for (let x = 0; x < GameplayMap.getGridWidth(); x++) {
      for (let y = 0; y < GameplayMap.getGridHeight(); y++) {
        const resource = GameplayMap.getResourceType(x, y);
        if (resource === ResourceTypes.NO_RESOURCE) continue;
        if (layer.suppressedPlots.has(GameplayMap.getIndexFromXY(x, y))) continue;
        const definition = GameInfo.Resources.lookup(resource);
        if (!definition) continue;
        layer.addResourceSprites({
          location: { x, y },
          resource: definition.ResourceType,
          class: definition.ResourceClassType,
          isDistantLands: player.isDistantLands({ x, y }),
        });
      }
    }
  };
  // addResourceSprites draws on both grids in turn, so each twin passes through to its world grid only.
  twins[0].drawInWorldOnly(() => twins[1].drawInWorldOnly(draw));
}

// The game never tilts the camera itself, so any tilt weight is the mod's own angle (or the turn toward straight down
// going far out).
const modHoldsTheAngle = () => Camera.getState().tiltWeight > 0.001;

let lastScale = 0;

function sizeWorldIcons() {
  const { position, subject } = Camera.getCurrentPose();
  const distance = Math.hypot(position.x - subject.x, position.y - subject.y, position.z - subject.z);
  const scale = MATCH_PER_DISTANCE * distance * halfTan(fieldOfView) / halfTan(GAME_FIELD_OF_VIEW) * globalScale;
  if (Math.abs(scale - lastScale) <= lastScale * 0.002) return;
  lastScale = scale;
  for (const twin of twins) twin.worldGrid.setScale(scale);
}

function switchTo(world) {
  if (world === inWorld) return;
  if (world && !builtInWorld) buildWorldIcons();
  inWorld = world;
  if (world) sizeWorldIcons();
  for (const twin of twins) twin.show();
}

// Each frame while the mod holds the angle; it lets go once the camera is back on the game's own tilt.
function followCamera() {
  if (following) return;
  following = true;
  const frame = () => {
    const world = modHoldsTheAngle();
    switchTo(world);
    if (!world) {
      following = false;
      return;
    }
    sizeWorldIcons();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Every tilt and lens change goes through these, whoever makes it.
const originalSetTilt = Camera.setTilt;
Camera.setTilt = function (...args) {
  const result = originalSetTilt.apply(this, args);
  if (!following && modHoldsTheAngle()) followCamera();
  return result;
};

const originalSetVerticalFoV = Camera.setVerticalFoV;
Camera.setVerticalFoV = function (degrees, ...rest) {
  const result = originalSetVerticalFoV.call(this, degrees, ...rest);
  fieldOfView = degrees;
  return result;
};

const originalRestoreDefaults = Camera.restoreDefaults;
Camera.restoreDefaults = function (...args) {
  const result = originalRestoreDefaults.apply(this, args);
  fieldOfView = GAME_FIELD_OF_VIEW;
  return result;
};

// A UI reload (an age transition, among others) keeps the camera where it was.
if (modHoldsTheAngle()) followCamera();
