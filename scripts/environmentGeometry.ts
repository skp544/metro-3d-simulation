import type { Polygon, MultiPolygon } from "geojson";

type LngLat = [number, number];
export type OSMElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  version?: number;
  geometry?: { lon: number; lat: number }[];
  members?: {
    type: string;
    ref: number;
    role: string;
    geometry?: { lon: number; lat: number }[];
  }[];
};
const round = (n: number) => Math.round(n * 1e6) / 1e6;
export const ringCoordinates = (g: { lon: number; lat: number }[]): LngLat[] =>
  g.map((p) => [round(p.lon), round(p.lat)]);
const same = (a: LngLat, b: LngLat) => a[0] === b[0] && a[1] === b[1];
export const closedRing = (r: LngLat[]) =>
  r.length >= 4 && same(r[0], r.at(-1)!);
export function pointInRing([x, y]: number[], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

/** Join reversed/member ways by exact snapshot endpoints. Never close a missing boundary artificially. */
export function joinRings(parts: LngLat[][]) {
  const pending = parts.map((r) => r.slice()),
    rings: LngLat[][] = [];
  while (pending.length) {
    const ring = pending.pop()!;
    while (!closedRing(ring)) {
      const i = pending.findIndex(
        (p) => same(p[0], ring.at(-1)!) || same(p.at(-1)!, ring.at(-1)!),
      );
      if (i < 0) break;
      const next = pending.splice(i, 1)[0];
      if (!same(next[0], ring.at(-1)!)) next.reverse();
      ring.push(...next.slice(1));
    }
    if (!closedRing(ring)) throw new Error("Incomplete OSM multipolygon ring");
    rings.push(ring);
  }
  return rings;
}
export function osmArea(element: OSMElement): Polygon | MultiPolygon | null {
  if (element.type === "way") {
    if (!element.geometry) return null;
    const ring = ringCoordinates(element.geometry);
    return closedRing(ring) ? { type: "Polygon", coordinates: [ring] } : null;
  }
  if (element.type !== "relation") return null;
  const members =
    element.members?.filter((m) => m.type === "way" && m.geometry?.length) ??
    [];
  const outer = joinRings(
    members
      .filter((m) => m.role !== "inner")
      .map((m) => ringCoordinates(m.geometry!)),
  );
  if (!outer.length) return null;
  const inner = joinRings(
    members
      .filter((m) => m.role === "inner")
      .map((m) => ringCoordinates(m.geometry!)),
  );
  const polygons = outer.map((r) => [r]);
  for (const hole of inner) {
    const i = outer.findIndex((r) => pointInRing(hole[0], r));
    if (i < 0) throw new Error("OSM inner ring has no containing outer ring");
    polygons[i].push(hole);
  }
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}
