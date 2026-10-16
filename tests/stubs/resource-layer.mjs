// Stands in for /base-standard/ui/lenses/layer/resource-layer.js: two sprite grids drawn at one size on screen, and
// addResourceSprites drawing a resource and its class icon with the game's sizes and offset (resource-layer.js, 1.5.0).

const SPRITE_PLOT_POSITION = { x: 0, y: 25, z: 5 };
const RESOURCE_SIZE = 42;
const TYPE_SIZE = 20;
const TYPE_OFFSET = { x: 0, y: -16 };

class ResourceLensLayer {
  static instance = new ResourceLensLayer();
  resourceSpriteGrid = WorldUI.createSpriteGrid("AllResources_SpriteGroup", SpriteMode.FixedBillboard);
  resourceTypeSpriteGrid = WorldUI.createSpriteGrid("AllResourcesClassType_SpriteGroup", SpriteMode.FixedBillboard);
  suppressedPlots = new Set();

  addResourceSprites(entry) {
    this.resourceSpriteGrid.addSpriteFOW(entry.location, entry.resource, `${entry.resource}_FOW`, SPRITE_PLOT_POSITION, {
      scale: RESOURCE_SIZE,
    });
    this.resourceTypeSpriteGrid.addSpriteFOW(entry.location, entry.class, `${entry.class}_FOW`, SPRITE_PLOT_POSITION, {
      scale: TYPE_SIZE,
      offset: TYPE_OFFSET,
    });
  }
}

export { ResourceLensLayer };
