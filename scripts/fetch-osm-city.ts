// Downloads the real surroundings of every DMRC station (OSM buildings, green areas, roads within
// RADIUS_M) into data/raw/osm-city/<date>.json. Context for the 3D view only; not part of the network data.
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const RADIUS_M = 300;

const query = `
[out:json][timeout:600][maxsize:536870912];
nwr["railway"="station"]["network"="Delhi Metro"]->.s;
(
  way["building"](around.s:${RADIUS_M});
  way["leisure"~"^(park|garden|playground|pitch)$"](around.s:${RADIUS_M});
  way["landuse"~"^(grass|forest|recreation_ground|village_green|meadow|cemetery)$"](around.s:${RADIUS_M});
  way["natural"~"^(wood|scrub|grassland)$"](around.s:${RADIUS_M});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|motorway_link|trunk_link|primary_link|secondary_link)$"](around.s:${RADIUS_M});
);
out tags geom;
`;

type Response = { osm3s: { timestamp_osm_base: string }; elements: unknown[]; remark?: string };

async function overpass(): Promise<Response> {
  // The public server answers 429/502/503/504 when busy and asks clients to back off exponentially.
  for (let attempt = 1, wait = 15_000; ; attempt++, wait *= 2) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "User-Agent": "metro-route-dataset/0.1", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
    });
    if (res.ok) return (await res.json()) as Response;
    const body = (await res.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300);
    if (![429, 502, 503, 504].includes(res.status) || attempt === 6) throw new Error(`Overpass HTTP ${res.status}: ${body}`);
    console.log(`Overpass busy (HTTP ${res.status}); retrying in ${wait / 1000}s`);
    await sleep(wait);
  }
}

const json = await overpass();
if (json.remark) throw new Error(`Overpass remark (likely timeout): ${json.remark}`);
const date = json.osm3s.timestamp_osm_base.slice(0, 10);
await mkdir("data/raw/osm-city", { recursive: true });
const path = `data/raw/osm-city/${date}.json`;
await writeFile(path, JSON.stringify({ query: query.trim(), endpoint: ENDPOINT, radiusM: RADIUS_M, ...json }));
console.log(`Saved ${json.elements.length} elements (OSM base ${json.osm3s.timestamp_osm_base}) to ${path}`);
