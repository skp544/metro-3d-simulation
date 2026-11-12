import { readFileSync, writeFileSync } from "node:fs";
import { centerOfMass, distance, point, polygon } from "@turf/turf";
import type { LandmarksFC, StationsFC } from "../src/data/types.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const config = read("../data/manual/landmarks.json") as { snapshot: string; landmarks: { id: string; name: string; wayId: number; wikidata: string; heightM: number; heightEstimated: boolean; reference: string; scope: string }[] };
const stations = read("../data/processed/metro_stations.geojson") as StationsFC;
const fc: LandmarksFC = { type: "FeatureCollection", features: config.landmarks.map((l) => {
  const raw = read(`../data/raw/landmarks/${config.snapshot}/way-${l.wayId}.json`) as { elements: { id: number; type: string; lon?: number; lat?: number; nodes?: number[]; tags?: Record<string, string>; version: number }[] };
  const way = raw.elements.find(e => e.type === "way" && e.id === l.wayId)!;
  if (way.tags?.wikidata !== l.wikidata || !way.nodes || way.nodes[0] !== way.nodes.at(-1)) throw new Error(`Unverified identity / open ring: ${l.id}`);
  const nodes = new Map(raw.elements.filter(e => e.type === "node").map(e => [e.id, [e.lon!, e.lat!] as [number, number]]));
  const ring = way.nodes.map(id => nodes.get(id)!);
  const center = centerOfMass(polygon([ring])).geometry.coordinates as [number, number];
  const cos = Math.cos(center[1] * Math.PI / 180);
  const pts = ring.slice(0, -1).map(([lng, lat]) => [(lng - center[0]) * 111319.49 * cos, (lat - center[1]) * 111319.49]);
  // Minimum-area oriented bounding rectangle; its long axis defines the front elevation's local +X.
  const boxes = pts.map((p, i) => {
    const next = pts[(i + 1) % pts.length];
    const a = Math.atan2(next[1] - p[1], next[0] - p[0]);
    const xs = pts.map(([x, y]) => x * Math.cos(a) + y * Math.sin(a));
    const ys = pts.map(([x, y]) => -x * Math.sin(a) + y * Math.cos(a));
    const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...ys) - Math.min(...ys);
    return { width: Math.max(w, d), depth: Math.min(w, d), yaw: a + (d > w ? Math.PI / 2 : 0), area: w * d };
  }).sort((a, b) => a.area - b.area);
  const box = boxes[0];
  const nearest = stations.features.map(s => ({ stationId: s.properties.id, name: s.properties.name, distanceM: Math.round(distance(point(center), s) * 1000) })).sort((a, b) => a.distanceM - b.distanceM)[0];
  return { type: "Feature", geometry: { type: "Point", coordinates: center }, properties: {
    id: l.id, name: l.name, footprint: ring, model: `/models/landmarks/${l.id}.glb`,
    widthM: box.width, depthM: box.depth, heightM: l.heightM, heightEstimated: l.heightEstimated,
    yaw: ["india-gate", "red-fort"].includes(l.id) ? box.yaw : 0,
    orientationSource: ["india-gate", "red-fort"].includes(l.id) ? "OSM footprint long axis (front/back symmetric approximation)" : "nominal; radial model",
    scope: l.scope, nearestStation: nearest, reference: l.reference, snapshot: config.snapshot,
    source: [`osm:way/${l.wayId}@${way.version}`, l.reference], verified: false, estimated: true, conflicts: [],
  } };
}) };
writeFileSync(new URL("../data/processed/landmarks.geojson", import.meta.url), JSON.stringify(fc, null, 2) + "\n");
console.log(fc.features.map(f => ({ name: f.properties.name, size: [f.properties.widthM, f.properties.depthM, f.properties.heightM].map(n => +n.toFixed(2)), nearest: f.properties.nearestStation })));
