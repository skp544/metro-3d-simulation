// lng/lat → local 3D ground coordinates. The only way geographic data enters the 3D scene.
//
// Web Mercator, the same projection as the Leaflet map, so the 3D network has exactly the 2D map's
// shape. Scaled by cos(origin latitude), so one unit ≈ one metre near the origin (scale error ≤ ~0.3% at the
// network's edges, ~35 km out). Three.js axes: x = east, y = up, z = south (north is −z).
type LngLat = [number, number];

const R = 6378137; // WGS84 / Web Mercator sphere radius, metres
const RAD = Math.PI / 180;
const mercX = (lng: number) => R * lng * RAD;
const mercY = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));

export interface Projection {
  origin: LngLat;
  /** [lng, lat] → [x, z] in metres from the origin. */
  project: (p: LngLat) => [number, number];
  unproject: (xz: [number, number]) => LngLat;
}

export function createProjection(origin: LngLat): Projection {
  const k = Math.cos(origin[1] * RAD);
  const [x0, y0] = [mercX(origin[0]), mercY(origin[1])];
  return {
    origin,
    project: ([lng, lat]) => [(mercX(lng) - x0) * k, -(mercY(lat) - y0) * k],
    unproject: ([x, z]) => [(x / k + x0) / R / RAD, (2 * Math.atan(Math.exp((-z / k + y0) / R)) - Math.PI / 2) / RAD],
  };
}

/** Centre of the bounding box of every coordinate in the collection: the scene origin, read from the data. */
export function boundsCentre(fc: { features: { geometry: { coordinates: unknown } }[] }): LngLat {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (c: unknown): void => {
    if (typeof (c as number[])[0] === "number") {
      const [x, y] = c as LngLat;
      [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    } else (c as unknown[]).forEach(visit);
  };
  fc.features.forEach((f) => visit(f.geometry.coordinates));
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}
