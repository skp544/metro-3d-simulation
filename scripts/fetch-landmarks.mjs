// Capture configured OSM identities without overwriting immutable existing snapshots.
// Directory-only statue coordinates are captured separately with their source HTML; never infer a footprint.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const config = JSON.parse(await readFile(new URL('../data/manual/landmarks.json', import.meta.url), 'utf8'));
const dir = new URL(`../data/raw/landmarks/${config.snapshot}/`, import.meta.url);
await mkdir(dir, { recursive: true });
for (const landmark of config.landmarks) {
  if (landmark.pointSnapshot) {
    await readFile(new URL(landmark.pointSnapshot, dir), 'utf8');
    continue;
  }
  const type = landmark.relationId ? 'relation' : 'way';
  const id = landmark.relationId ?? landmark.wayId;
  const target = new URL(`${type}-${id}.json`, dir);
  try { await readFile(target); console.log(`Preserved ${type} ${id}`); continue; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const url = `https://www.openstreetmap.org/api/0.6/${type}/${id}/full.json`;
  const response = await fetch(url, { headers: { 'User-Agent': 'NCRRailVisualization/1.0 landmark research' }, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const body = await response.text();
  JSON.parse(body);
  await writeFile(target, body, { flag: 'wx' });
  console.log(`Saved ${type} ${id}`);
}
