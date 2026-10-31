// Downloads a dated OSM snapshot of the DMRC network into data/raw/osm/<date>.json.
// Raw snapshots are never edited; build-dataset.ts reads the latest one.
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const BBOX = "28.2,76.7,28.9,77.6"; // Delhi NCR

const query = `
[out:json][timeout:300];
relation["type"="route_master"]["network"="Delhi Metro"]->.masters;
relation(r.masters)->.routes;
way(r.routes)->.ways;
node(r.routes)->.stops;
rel(bn.stops)["public_transport"="stop_area"]->.areas;
nwr(r.areas)["railway"="station"]->.areaStations;
nwr["railway"="station"]["network"="Delhi Metro"](${BBOX})->.stations;
way["railway"="construction"]["construction"~"^(subway|light_rail)$"](${BBOX})->.construction;
(.masters; .routes; .areas;); out body;
(.ways; .construction;); out tags geom;
.stops out body;
(.stations; .areaStations;); out tags center;
`;

type OverpassResponse = { osm3s: { timestamp_osm_base: string }; elements: unknown[]; remark?: string };

async function overpass(): Promise<OverpassResponse> {
  // The public server answers 429/502/503/504 when busy and asks clients to back off exponentially.
  for (let attempt = 1, wait = 10_000; ; attempt++, wait *= 2) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      // Overpass rejects requests without a User-Agent (HTTP 406).
      headers: { "User-Agent": "metro-route-dataset/0.1", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
    });
    if (res.ok) return (await res.json()) as OverpassResponse;
    const body = (await res.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300);
    if (![429, 502, 503, 504].includes(res.status) || attempt === 5) throw new Error(`Overpass HTTP ${res.status}: ${body}`);
    console.log(`Overpass busy (HTTP ${res.status}); retrying in ${wait / 1000}s`);
    await sleep(wait);
  }
}

const json = await overpass();
if (json.remark) throw new Error(`Overpass remark (likely timeout): ${json.remark}`);

const date = json.osm3s.timestamp_osm_base.slice(0, 10);
await mkdir("data/raw/osm", { recursive: true });
const path = `data/raw/osm/${date}.json`;
await writeFile(path, JSON.stringify({ query: query.trim(), endpoint: ENDPOINT, ...json }));
console.log(`Saved ${json.elements.length} elements (OSM base ${json.osm3s.timestamp_osm_base}) to ${path}`);
