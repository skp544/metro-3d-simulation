// node --test: the 3D network built from the real data is continuous, stations sit on their track at
// the right level, and the structure counts stay in budget (Phase 6 exit criteria).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { LEVEL_HEIGHT, STRUCTURE, VERTICAL_EXAGGERATION as VE } from "../../constants/scene.ts";
import { buildStructures } from "./buildStructures.ts";
import { buildScene3D, type V3 } from "./geometry.ts";

const read = async (f: string) => JSON.parse(await readFile(`data/processed/${f}.geojson`, "utf8"));
const network = {
  lines: await read("metro_lines"),
  routes: await read("metro_routes"),
  segments: await read("metro_segments"),
  stations: await read("metro_stations"),
};
const scene = buildScene3D(network);
const planar = (a: V3, b: V3) => Math.hypot(b[0] - a[0], b[2] - a[2]);

test("one continuous path per route, no height jumps (max grade < 8%)", () => {
  assert.equal(scene.paths.length, network.routes.features.length);
  let worst = { grade: 0, at: "" };
  for (const p of scene.paths)
    for (let i = 1; i < p.points.length; i++) {
      const d = planar(p.points[i - 1], p.points[i]);
      if (d < 1) continue;
      const grade = Math.abs(p.points[i][1] - p.points[i - 1][1]) / VE / d;
      if (grade > worst.grade) worst = { grade, at: `${p.routeId} #${i}` };
    }
  console.log(`  steepest modelled grade: ${(worst.grade * 100).toFixed(2)}% at ${worst.at}`);
  assert.ok(worst.grade < 0.08, `grade ${(worst.grade * 100).toFixed(1)}% at ${worst.at}`);
});

test("every platform sits on its line's track (< 1 m)", () => {
  for (const s of scene.stations.filter((x) => x.lineId)) {
    let best = Infinity;
    for (const p of scene.paths.filter((x) => x.lineId === s.lineId))
      for (let i = 1; i < p.points.length; i++) {
        const [a, b] = [p.points[i - 1], p.points[i]];
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
        const t = Math.max(0, Math.min(1, ((s.position[0] - a[0]) * ab[0] + (s.position[1] - a[1]) * ab[1] + (s.position[2] - a[2]) * ab[2]) / len2));
        best = Math.min(best, Math.hypot(s.position[0] - a[0] - t * ab[0], s.position[1] - a[1] - t * ab[1], s.position[2] - a[2] - t * ab[2]));
      }
    assert.ok(best < 1, `${s.stationId} ${s.lineId}: ${best.toFixed(1)} m off its track`);
  }
});

test("platform level matches its data type (elevated above, underground below ground)", () => {
  const types = new Map<string, string>();
  for (const f of network.stations.features)
    for (const pl of f.properties.platforms) types.set(`${f.properties.id}|${pl.lineId}`, pl.trackType);
  const wrong: string[] = [];
  for (const s of scene.stations.filter((x) => x.lineId)) {
    const type = types.get(`${s.stationId}|${s.lineId}`);
    const y = s.position[1] / VE;
    const ok =
      type === "elevated" ? y > STRUCTURE.levelThreshold : type === "underground" ? y < -STRUCTURE.levelThreshold : type === "at_grade" ? Math.abs(y) <= LEVEL_HEIGHT.elevated : true;
    if (!ok) wrong.push(`${s.stationId}|${s.lineId} ${type} at ${y.toFixed(1)} m`);
  }
  assert.deepEqual(wrong, []);
});

test("structure budget: merged/instanced, counts reported", () => {
  const colors = new Map<string, string>(network.lines.features.map((f: { properties: { id: string; color: string } }) => [f.properties.id, f.properties.color]));
  const b = buildStructures(scene, colors, { hiddenLines: [], hiddenTrackTypes: [], hiddenStationTypes: [], showStations: true });
  const tris = (g: { getIndex(): { count: number } | null } | null) => (g ? g.getIndex()!.count / 3 : 0);
  const total = tris(b.deck) + tris(b.tunnel) + tris(b.ribbon) + 12 * (b.pillars.length + b.aboveStations.length + b.belowStations.length);
  console.log(
    `  pillars ${b.pillars.length}, station boxes ${b.aboveStations.length} above + ${b.belowStations.length} below,` +
      ` triangles: deck ${tris(b.deck)}, tunnel ${tris(b.tunnel)}, ribbon ${tris(b.ribbon)}, total ≈ ${total}`,
  );
  assert.ok(b.pillars.length > 5000 && b.pillars.length < 15000, "about one pillar per 30 m of viaduct");
  assert.equal(b.aboveStations.length + b.belowStations.length, scene.stations.filter((s) => s.lineId).length);
  assert.ok(total < 1_000_000, "under 1M triangles for the whole network");
});
