// The resource-icon twin (ui/zoom-tilt-rotate-icons.js), against the stand-in resource layer and camera in
// camera-harness.mjs: what the twin draws in the world, when it shows, and the size it gives the icons. The tests run
// in order and share one layer.

import test from "node:test";
import assert from "node:assert/strict";
import { camera, halfTan, frames, map, spriteGrids } from "./camera-harness.mjs";

const { ResourceLensLayer } = await import("./stubs/resource-layer.mjs");
const layer = ResourceLensLayer.instance;
const screenResources = layer.resourceSpriteGrid;
const screenClasses = layer.resourceTypeSpriteGrid;

// The layer has drawn the map's resources before the mod's script runs.
for (const [plot, type] of map.resources) {
  const [x, y] = plot.split(",").map(Number);
  layer.addResourceSprites({ location: { x, y }, resource: `RESOURCE_${type}`, class: "RESOURCECLASS_BONUS" });
}

await import("../ui/zoom-tilt-rotate-icons.js");
const worldResources = spriteGrids.find((grid) => grid.name === "ZoomTiltRotate_Resources");
const worldClasses = spriteGrids.find((grid) => grid.name === "ZoomTiltRotate_ResourceClasses");

// Measured in game: the world scale, per unit of distance from the camera to the middle of the screen, that draws an
// icon there at the resource layer's own size.
const MATCH_PER_DISTANCE = 0.00085;

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} isn't within ${tolerance} of ${expected}`);
}

const shown = () => [screenResources.visible, screenClasses.visible, worldResources.visible, worldClasses.visible];
const ON_SCREEN = [true, true, false, false];
const IN_WORLD = [false, false, true, true];

test("every icon the layer draws reaches the world twin too, on the city-growth lens's scale", () => {
  assert.equal(worldResources.mode, SpriteMode.Billboard);
  const plot = { x: 0, y: 2 };
  layer.addResourceSprites({ location: plot, resource: "RESOURCE_TEST", class: "RESOURCECLASS_TEST" });
  assert.deepEqual(screenResources.sprites.at(-1).options, { scale: 42 });
  assert.deepEqual(worldResources.sprites.at(-1).options, { scale: 1 });
  const classIcon = worldClasses.sprites.at(-1).options;
  near(classIcon.scale, 20 / 42);
  assert.deepEqual(classIcon.offset, { x: 0, y: -16 * 16 / 42 });
  layer.resourceSpriteGrid.clearPlot(plot);
  layer.resourceTypeSpriteGrid.clearPlot(plot);
  assert.equal(worldResources.sprites.length, 0);
  assert.equal(screenResources.sprites.length, 2);
});

test("at the game's own tilt the game's icons show; tilted by the mod, the world twins, built once from the map", () => {
  assert.deepEqual(shown(), ON_SCREEN);
  layer.suppressedPlots.add(GameplayMap.getIndexFromXY(2, 0));
  Camera.setTilt(30, 1);
  frames(1);
  assert.deepEqual(shown(), IN_WORLD);
  assert.deepEqual(worldResources.sprites.map((sprite) => sprite.location), [{ x: 1, y: 1 }]);
  assert.deepEqual(worldClasses.sprites.map((sprite) => sprite.location), [{ x: 1, y: 1 }]);
  assert.equal(screenResources.sprites.length, 2);
  Camera.setTilt(0, 0);
  frames(1);
  assert.deepEqual(shown(), ON_SCREEN);
  Camera.setTilt(30, 1);
  frames(1);
  assert.deepEqual(shown(), IN_WORLD);
  assert.equal(worldResources.sprites.length, 1);
});

test("icons the player has switched off stay off on both grids", () => {
  layer.resourceSpriteGrid.setVisible(false);
  layer.resourceTypeSpriteGrid.setVisible(false);
  assert.deepEqual(shown(), [false, false, false, false]);
  assert.equal(layer.resourceSpriteGrid.isVisible(), false);
  layer.resourceSpriteGrid.setVisible(true);
  layer.resourceTypeSpriteGrid.setVisible(true);
  assert.deepEqual(shown(), IN_WORLD);
});

test("the world icons are sized each frame so the one in the middle of the screen matches the game's", () => {
  // Zoom 0.5 on the stand-in camera is 2000 from the middle of the screen; 0.25 is 1500.
  near(worldResources.scale, MATCH_PER_DISTANCE * 2000);
  camera.zoomLevel = 0.25;
  frames(1);
  near(worldResources.scale, MATCH_PER_DISTANCE * 1500);
  near(worldClasses.scale, MATCH_PER_DISTANCE * 1500);
  Camera.setVerticalFoV(5);
  frames(1);
  near(worldResources.scale, MATCH_PER_DISTANCE * 1500 * halfTan(5) / halfTan(35));
  layer.resourceSpriteGrid.setScale(1.5);
  frames(1);
  assert.equal(screenResources.scale, 1.5);
  near(worldResources.scale, MATCH_PER_DISTANCE * 1500 * 1.5 * halfTan(5) / halfTan(35));
  Camera.restoreDefaults();
  Camera.setTilt(30, 1);
  frames(1);
  near(worldResources.scale, MATCH_PER_DISTANCE * 1500 * 1.5);
});
