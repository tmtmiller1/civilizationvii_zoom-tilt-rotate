// Node module hooks for the camera tests. The camera scripts import the game's modules and each other by absolute
// path; this maps the mod's own paths onto the repo and the game's onto the stand-ins in tests/stubs/, so the shipped
// scripts load unchanged. camera-harness.mjs registers it.

const ROOT = new URL("../", import.meta.url);
const STUBS = new URL("./stubs/", import.meta.url);
const MOD_PREFIX = "/tmt-zoom-tilt-rotate/";

const GAME_MODULES = {
  "/core/ui/camera/camera-controller.js": "camera-controller.mjs",
  "/core/ui/input/input-support.js": "input-support.mjs",
  "/core/ui/views/view-manager.js": "view-manager.mjs",
  "/base-standard/ui/city-zoomer/city-zoomer.js": "city-zoomer.mjs",
  "/base-standard/ui/lenses/layer/resource-layer.js": "resource-layer.mjs",
};

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(MOD_PREFIX)) {
    return { url: new URL(specifier.slice(MOD_PREFIX.length), ROOT).href, shortCircuit: true };
  }
  if (GAME_MODULES[specifier]) {
    return { url: new URL(GAME_MODULES[specifier], STUBS).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
