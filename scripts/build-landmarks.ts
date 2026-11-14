import { readFileSync, writeFileSync } from "node:fs";
import { area, centerOfMass, distance, point, polygon } from "@turf/turf";
import type { LandmarksFC, PlaceCategory, PlaceRegion, StationsFC } from "../src/data/types.ts";
import { createProjection } from "../src/utils/projection.ts";
import { joinRings, pointInRing } from "./environmentGeometry.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const config = read("../data/manual/landmarks.json") as { snapshot: string; landmarks: { id: string; name: string; category?: PlaceCategory; region?: PlaceRegion; snapshot?: string; aliases?: string[]; geometryRole?: "building" | "site"; wayId?: number; relationId?: number; wikidata?: string; osmName?: string; osmTags?: Record<string, string>; pointSnapshot?: string; widthM?: number; depthM?: number; oriented?: boolean; heightM: number; heightEstimated: boolean; reference: string; scope: string; conflicts?: string[] }[] };
const stations = read("../data/processed/metro_stations.geojson") as StationsFC;
const fc: LandmarksFC = { type: "FeatureCollection", features: config.landmarks.map((l) => {
  const snapshot = l.snapshot ?? config.snapshot;
  const type = l.relationId ? "relation" : "way", id = l.relationId ?? l.wayId;
  const pointSource = l.pointSnapshot ? read(`../data/raw/landmarks/${snapshot}/${l.pointSnapshot}`) as { coordinates: [number, number]; source: string; coordinateAccuracy: string } : null;
  const raw = (pointSource ? { elements: [] } : read(`../data/raw/landmarks/${snapshot}/${type}-${id}.json`)) as { sourceSnapshot?: string; elements: { id: number; type: string; lon?: number; lat?: number; nodes?: number[]; geometry?: { lon: number; lat: number }[]; members?: { type: string; ref: number; role: string }[]; tags?: Record<string, string>; version?: number }[] };
  const entity = raw.elements.find(e => e.type === type && e.id === id);
  if (!pointSource && (!entity || (!l.wikidata && !l.osmName)
    || (l.wikidata && entity.tags?.wikidata !== l.wikidata)
    || (l.osmName && entity.tags?.name !== l.osmName)
    || Object.entries(l.osmTags ?? {}).some(([key, value]) => entity.tags?.[key] !== value))) throw new Error(`Unverified identity: ${l.id}`);
  const nodes = new Map(raw.elements.filter(e => e.type === "node").map(e => [e.id, [e.lon!, e.lat!] as [number, number]]));
  const wayGeometry = (wayId: number) => {
    const way = raw.elements.find(e => e.type === "way" && e.id === wayId);
    if (way?.geometry) return way.geometry;
    if (!way?.nodes) throw new Error(`Missing way ${wayId}`);
    return way.nodes.map(nodeId => { const p = nodes.get(nodeId); if (!p) throw new Error(`Missing node ${nodeId}`); return { lon: p[0], lat: p[1] }; });
  };
  const ringForWay = (wayId: number) => wayGeometry(wayId).map(p => [p.lon, p.lat] as [number, number]);
  const members = entity?.members?.filter(m => m.type === "way") ?? [];
  const outers = pointSource ? [] : joinRings(type === "way" ? [ringForWay(id!)] : members.filter(m => m.role === "outer").map(m => ringForWay(m.ref)));
  const holes = pointSource ? [] : joinRings(members.filter(m => m.role === "inner").map(m => ringForWay(m.ref)));
  if (!pointSource && (!outers.length || holes.some(h => !outers.some(o => pointInRing(h[0], o))))) throw new Error(`Incomplete landmark polygon: ${l.id}`);
  const footprintParts = outers.map(outer => ({ outer, holes: holes.filter(h => pointInRing(h[0], outer)) }));
  const rings = pointSource ? [] : [outers[0], ...footprintParts[0].holes];
  const ring = rings[0] ?? [];
  const masses = footprintParts.map(p => { const poly = polygon([p.outer, ...p.holes]); return { area: area(poly), center: centerOfMass(poly).geometry.coordinates }; });
  const totalArea = masses.reduce((sum, m) => sum + m.area, 0);
  const center = pointSource?.coordinates ?? (masses.length === 1 ? masses[0].center : [0, 1].map(axis => masses.reduce((sum, m) => sum + m.center[axis] * m.area, 0) / totalArea)) as [number, number];
  if (!center.every(Number.isFinite)) throw new Error(`Invalid landmark location: ${l.id}`);
  const cos = Math.cos(center[1] * Math.PI / 180);
  const pts = outers.flatMap(outer => outer.slice(0, -1)).map(([lng, lat]) => [(lng - center[0]) * 111319.49 * cos, (lat - center[1]) * 111319.49]);
  // Minimum-area oriented bounding rectangle; its long axis defines the front elevation's local +X.
  const boxes = pts.map((p, i) => {
    const next = pts[(i + 1) % pts.length];
    const a = Math.atan2(next[1] - p[1], next[0] - p[0]);
    const xs = pts.map(([x, y]) => x * Math.cos(a) + y * Math.sin(a));
    const ys = pts.map(([x, y]) => -x * Math.sin(a) + y * Math.cos(a));
    const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...ys) - Math.min(...ys);
    return { width: Math.max(w, d), depth: Math.min(w, d), yaw: a + (d > w ? Math.PI / 2 : 0), area: w * d };
  }).sort((a, b) => a.area - b.area);
  const box = boxes[0] ?? { width: l.widthM!, depth: l.depthM!, yaw: 0 };
  if (!(box.width > 0 && box.depth > 0)) throw new Error(`Missing model dimensions: ${l.id}`);
  const oriented = l.oriented || ["india-gate", "red-fort"].includes(l.id);
  const yaw = oriented ? box.yaw : 0;
  const projection = createProjection(center);
  const localRing = (ring: [number, number][]) => ring.map(coordinate => {
    const [x, z] = projection.project(coordinate);
    return [x * Math.cos(yaw) - z * Math.sin(yaw), -x * Math.sin(yaw) - z * Math.cos(yaw)] as [number, number];
  });
  const modelFootprints = footprintParts.map(p => ({ outer: localRing(p.outer), holes: p.holes.map(localRing) }));
  const nearest = stations.features.map(s => ({ stationId: s.properties.id, name: s.properties.name, distanceM: Math.round(distance(point(center), s) * 1000) })).sort((a, b) => a.distanceM - b.distanceM)[0];
  return { type: "Feature", geometry: { type: "Point", coordinates: center }, properties: {
    id: l.id, name: l.name, category: l.category ?? "monument", region: l.region ?? "Delhi", aliases: l.aliases ?? [], geometryRole: l.geometryRole ?? "building", footprint: ring, footprintParts, modelFootprints, footprintHoles: rings.slice(1), model: `/models/landmarks/${l.id}.glb`,
    widthM: box.width, depthM: box.depth, heightM: l.heightM, heightEstimated: l.heightEstimated,
    yaw,
    orientationSource: oriented ? "OSM footprint long axis; facade details approximate" : pointSource ? "nominal; statue heading not surveyed" : "nominal; radial model",
    positionSource: pointSource ? `Directory point captured ${snapshot}; ${pointSource.coordinateAccuracy}` : `OSM position and footprint snapshot ${snapshot}`,
    scope: l.scope, nearestStation: nearest, reference: l.reference, snapshot,
    source: [pointSource ? `data/raw/landmarks/${snapshot}/${l.pointSnapshot}` : `osm:${type}/${id}@${entity!.version ?? `snapshot-${snapshot}`}`, pointSource?.source ?? l.reference, ...(raw.sourceSnapshot ? [raw.sourceSnapshot] : [])], verified: false, estimated: true, conflicts: l.conflicts ?? [],
  } };
}) };
writeFileSync(new URL("../data/processed/landmarks.geojson", import.meta.url), JSON.stringify(fc, null, 2) + "\n");
console.log(fc.features.map(f => ({ name: f.properties.name, size: [f.properties.widthM, f.properties.depthM, f.properties.heightM].map(n => +n.toFixed(2)), nearest: f.properties.nearestStation })));
