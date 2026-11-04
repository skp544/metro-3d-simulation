// data/raw/osm-city (latest) → data/processed/city_{buildings,roads,green,trees}.geojson + data/metadata/city_report.json.
// Real OSM surroundings of the stations, for the 3D view only. Nothing here is network data.
import { readdir, readFile, writeFile } from "node:fs/promises";

type Tags = Record<string, string>;
type Way = { type: "way"; id: number; tags: Tags; geometry?: { lat: number; lon: number }[] };
type LngLat = [number, number];

const ROAD_KEEP_M = 400; // road pieces further than this from every station are dropped
const LEVEL_M = 3.2;
// Nominal heights (m) by OSM building type when neither height nor building:levels is tagged.
const NOMINAL_HEIGHT: Record<string, number> = {
  house: 7, detached: 7, residential: 12, apartments: 15, commercial: 12, retail: 8, office: 15, industrial: 9,
  warehouse: 9, school: 10, college: 12, university: 12, hospital: 15, hotel: 18, roof: 4, garage: 3, garages: 3,
  shed: 3, hut: 3, temple: 10, mosque: 12, church: 12, yes: 9,
};
// Station buildings are drawn by the network's station boxes, not as city buildings.
const SKIP_BUILDING = new Set(["transportation", "train_station"]);
const ROAD_WIDTH: Record<string, number> = {
  motorway: 22, trunk: 20, primary: 16, secondary: 12, tertiary: 9, motorway_link: 8, trunk_link: 8,
  primary_link: 8, secondary_link: 7, residential: 6, unclassified: 6,
}; // service roads (parking aisles, lanes) are left out: clutter at this scale, and ~25% of the road data
const TREES_PER_M2 = 1 / 300;
const MAX_TREES_PER_AREA = 40;

const latest = async (dir: string) => `${dir}/${(await readdir(dir)).filter((f) => f.endsWith(".json")).sort().at(-1)}`;
const rawPath = await latest("data/raw/osm-city");
const raw = JSON.parse(await readFile(rawPath, "utf8"));
const ways = (raw.elements as Way[]).filter((e) => e.type === "way" && e.geometry && e.geometry.length > 1);
const stations = JSON.parse(await readFile("data/processed/metro_stations.geojson", "utf8")).features as { geometry: { coordinates: LngLat } }[];

// Local metres around the network (equirectangular is plenty for distances of a few hundred metres).
const lat0 = stations.reduce((a, s) => a + s.geometry.coordinates[1], 0) / stations.length;
const KX = 111_320 * Math.cos((lat0 * Math.PI) / 180);
const KY = 110_950;
const m = ([lng, lat]: LngLat) => [lng * KX, lat * KY];

// Grid index of stations for "near any station" tests.
const CELL = ROAD_KEEP_M;
const grid = new Map<string, number[][]>();
for (const s of stations) {
  const [x, y] = m(s.geometry.coordinates);
  const k = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  grid.set(k, [...(grid.get(k) ?? []), [x, y]]);
}
const nearStation = (p: LngLat) => {
  const [x, y] = m(p);
  const [cx, cy] = [Math.floor(x / CELL), Math.floor(y / CELL)];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (const [sx, sy] of grid.get(`${cx + dx},${cy + dy}`) ?? []) if (Math.hypot(x - sx, y - sy) <= ROAD_KEEP_M) return true;
  return false;
};

// 5 decimals ≈ 1 m: enough for context buildings and keeps the files ~25% smaller.
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
const coords = (w: Way): LngLat[] => w.geometry!.map((p) => [r5(p.lon), r5(p.lat)]);
const closed = (cs: LngLat[]) => cs.length >= 4 && cs[0][0] === cs.at(-1)![0] && cs[0][1] === cs.at(-1)![1];
const areaM2 = (cs: LngLat[]) => {
  let a = 0;
  for (let i = 1; i < cs.length; i++) {
    const [[x0, y0], [x1, y1]] = [m(cs[i - 1]), m(cs[i])];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
};
// Deterministic pseudo-random numbers per OSM id, so a rebuild places everything identically.
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const inside = ([x, y]: LngLat, ring: LngLat[]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

// ---------- buildings ----------
const heightSources = { "osm:height": 0, "osm:levels": 0, nominal: 0 };
const buildings: object[] = [];
for (const w of ways) {
  const kind = w.tags.building;
  if (!kind || SKIP_BUILDING.has(kind) || w.tags.railway === "station" || w.tags.public_transport === "station") continue;
  const ring = coords(w);
  if (!closed(ring)) continue;
  const tagged = Number.parseFloat(w.tags.height ?? "");
  const levels = Number.parseFloat(w.tags["building:levels"] ?? "");
  let h: number;
  let src: keyof typeof heightSources;
  if (Number.isFinite(tagged) && tagged > 0) [h, src] = [tagged, "osm:height"];
  else if (Number.isFinite(levels) && levels > 0) [h, src] = [levels * LEVEL_M, "osm:levels"];
  else {
    // Untagged: the type's nominal height ±25%, varied per building only so the skyline isn't flat.
    [h, src] = [(NOMINAL_HEIGHT[kind] ?? NOMINAL_HEIGHT.yes) * (0.75 + rng(w.id)() * 0.5), "nominal"];
  }
  heightSources[src]++;
  buildings.push({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: { id: `osm:way/${w.id}`, kind, height: Math.round(Math.min(h, 200) * 10) / 10, heightSource: src },
  });
}

// ---------- roads (clipped to the station neighbourhoods) ----------
const roads: object[] = [];
for (const w of ways) {
  const cls = w.tags.highway;
  if (!cls || !ROAD_WIDTH[cls] || w.tags.tunnel === "yes" || w.tags.area === "yes") continue;
  const cs = coords(w);
  let piece: LngLat[] = [];
  const flush = () => {
    if (piece.length > 1)
      roads.push({ type: "Feature", geometry: { type: "LineString", coordinates: piece }, properties: { id: `osm:way/${w.id}`, class: cls, width: ROAD_WIDTH[cls] } });
    piece = [];
  };
  cs.forEach((p) => (nearStation(p) ? piece.push(p) : flush()));
  flush();
}

// ---------- green areas + trees inside them ----------
const green: object[] = [];
const trees: object[] = [];
for (const w of ways) {
  const kind = w.tags.leisure ?? w.tags.landuse ?? w.tags.natural;
  if (!kind || w.tags.building || w.tags.highway) continue;
  const ring = coords(w);
  if (!closed(ring)) continue;
  green.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { id: `osm:way/${w.id}`, kind } });
  if (kind === "pitch") continue; // sports pitches are open ground
  const want = Math.min(MAX_TREES_PER_AREA, Math.floor(areaM2(ring) * TREES_PER_M2));
  const rand = rng(w.id);
  const [minX, maxX] = [Math.min(...ring.map((p) => p[0])), Math.max(...ring.map((p) => p[0]))];
  const [minY, maxY] = [Math.min(...ring.map((p) => p[1])), Math.max(...ring.map((p) => p[1]))];
  for (let tries = 0, placed = 0; placed < want && tries < want * 20; tries++) {
    const p: LngLat = [r5(minX + rand() * (maxX - minX)), r5(minY + rand() * (maxY - minY))];
    if (!inside(p, ring)) continue;
    placed++;
    trees.push({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: { variant: Math.floor(rand() * 4), area: `osm:way/${w.id}` } });
  }
}

// ---------- write ----------
const fc = (features: unknown[]) => `{"type":"FeatureCollection","features":[\n${features.map((f) => JSON.stringify(f)).join(",\n")}\n]}\n`;
await writeFile("data/processed/city_buildings.geojson", fc(buildings));
await writeFile("data/processed/city_roads.geojson", fc(roads));
await writeFile("data/processed/city_green.geojson", fc(green));
await writeFile("data/processed/city_trees.geojson", fc(trees));
const report = {
  generatedAt: new Date().toISOString(),
  source: { file: rawPath, osmSnapshot: raw.osm3s.timestamp_osm_base, radiusM: raw.radiusM, licence: "ODbL-1.0", attribution: "© OpenStreetMap contributors" },
  counts: { buildings: buildings.length, roads: roads.length, greenAreas: green.length, trees: trees.length },
  buildingHeightSources: heightSources,
  notes: [
    "Context for the 3D view only; not validated network data.",
    "Untagged building heights are nominal by type ±25% (heightSource: nominal).",
    "Trees are generated positions inside real OSM green areas (decorative placement, real areas).",
    `Station buildings (building=${[...SKIP_BUILDING].join("/")}, railway=station) are skipped; the network's station boxes stand in for them.`,
  ],
};
await writeFile("data/metadata/city_report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ counts: report.counts, buildingHeightSources: heightSources }, null, 2));
