// Dated, immutable OSM API snapshot for the regional networks. The main DMRC snapshot stays intact.
import { mkdir, writeFile, access, readFile } from "node:fs/promises";

type El = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  members?: { type: string; ref: number; role: string }[];
};
const base = "https://api.openstreetmap.org/api/0.6";
const elements = new Map<string, El>();
async function get(path: string): Promise<El[]> {
  const res = await fetch(`${base}/${path}.json`, {
    headers: { "User-Agent": "metro-route-dataset/0.1" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OSM ${path}: HTTP ${res.status}`);
  const json = (await res.json()) as { elements: El[] };
  for (const el of json.elements) elements.set(`${el.type}/${el.id}`, el);
  return json.elements;
}
// Canonical and reverse passenger services, including the Duhai Depot branch.
const config = JSON.parse(
  await readFile("data/manual/regional-lines.json", "utf8"),
) as { lines: { branches: { osmRoute: number; osmReverse: number }[] }[] };
const routes = [
  ...new Set(
    config.lines.flatMap((l) =>
      l.branches.flatMap((b) => [b.osmRoute, b.osmReverse]),
    ),
  ),
];
for (const id of routes) {
  await get(`relation/${id}/full`);
  await get(`relation/${id}/relations`);
  console.log(`Fetched route ${id}`);
}
const stops = [
  ...new Set(
    routes.flatMap((id) =>
      elements
        .get(`relation/${id}`)!
        .members!.filter((m) => m.type === "node" && m.role.startsWith("stop"))
        .map((m) => m.ref),
    ),
  ),
];
for (const id of stops) await get(`node/${id}/relations`);
const areas = [...elements.values()].filter(
  (el) => el.tags?.public_transport === "stop_area",
);
for (const area of areas) await get(`relation/${area.id}/full`);
const nodes = new Map(
  [...elements.values()]
    .filter((el) => el.type === "node")
    .map((el) => [el.id, el]),
);
const enriched = [...elements.values()].map((el) => {
  if (el.type !== "way" || !el.nodes?.length) return el;
  const points = el.nodes.map((id) => nodes.get(id));
  if (points.some((p) => !p)) throw new Error(`Missing nodes for way ${el.id}`);
  const geometry = points.map((p) => ({ lat: p!.lat!, lon: p!.lon! }));
  return {
    ...el,
    geometry,
    center: {
      lat: geometry.reduce((a, p) => a + p.lat, 0) / geometry.length,
      lon: geometry.reduce((a, p) => a + p.lon, 0) / geometry.length,
    },
  };
});
const fetchedAt = new Date().toISOString();
const path = `data/raw/regional/${fetchedAt.replace(/[:.]/g, "-")}.json`;
await mkdir("data/raw/regional", { recursive: true });
try {
  await access(path);
  throw new Error(`Snapshot already exists: ${path}`);
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
await writeFile(
  path,
  JSON.stringify({
    endpoint: base,
    fetchedAt,
    routes,
    osm3s: { timestamp_osm_base: fetchedAt },
    elements: enriched,
  }),
);
console.log(
  `Saved ${enriched.length} elements, ${stops.length} stops, ${areas.length} stop areas to ${path}`,
);
