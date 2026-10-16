// Stands in for /base-standard/ui/city-zoomer/city-zoomer.js. The mod calls the originals unbound, so they record into
// a list of their own rather than through `this`.
export const cityZoomerCalls = [];

export const CityZoomer = {
  zoomToCity(city) {
    cityZoomerCalls.push(["zoomToCity", city]);
  },
  resetZoom() {
    cityZoomerCalls.push(["resetZoom"]);
  },
};
