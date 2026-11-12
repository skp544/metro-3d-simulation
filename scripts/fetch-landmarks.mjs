// Public OSM way IDs verified against their name / Wikidata tags; snapshots are never overwritten.
import { mkdir, writeFile } from 'node:fs/promises';
const date = new Date().toISOString().slice(0, 10);
const dir = new URL(`../data/raw/landmarks/${date}/`, import.meta.url);
await mkdir(dir, { recursive: true });
for (const id of [361709652, 44827278, 369140381, 80429907]) {
  const url = `https://www.openstreetmap.org/api/0.6/way/${id}/full.json`;
  const response = await fetch(url, { headers: { 'User-Agent': 'NCRRailVisualization/1.0 landmark research' }, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const body = await response.text();
  JSON.parse(body);
  await writeFile(new URL(`way-${id}.json`, dir), body, { flag: 'wx' });
  console.log(`Saved way ${id}`);
}
