import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { LinesFC, RoutesFC, SegmentsFC, StationsFC, TransfersFC } from "../data/types.ts";
import { buildRoutePlanner } from "./routePlanner.ts";

const read = async <T>(name: string): Promise<T> => JSON.parse(await readFile(`data/processed/${name}.geojson`, "utf8"));
const [lines, routes, segments, stations, transfers] = await Promise.all([
  read<LinesFC>("metro_lines"), read<RoutesFC>("metro_routes"), read<SegmentsFC>("metro_segments"), read<StationsFC>("metro_stations"), read<TransfersFC>("station_transfers"),
]);
const planner = buildRoutePlanner(routes, segments, undefined, transfers);
const station = (line: string, name: string) => {
  const hit = stations.features.find(f => f.properties.lines.includes(line) && [f.properties.name, ...f.properties.aliases].includes(name));
  assert.ok(hit, `${line}: ${name}`);
  return hit.properties.id;
};

test("regional coverage: operational stop counts, actual geometry, distinct express and local services", () => {
  for (const [line, count] of [["aqua", 21], ["rrts", 15], ["meerut_metro", 12]] as const) {
    assert.ok(lines.features.some(f => f.properties.id === line));
    assert.equal(stations.features.filter(f => f.properties.lines.includes(line)).length, count);
    for (const route of routes.features.filter(f => f.properties.lineId === line)) {
      assert.ok(route.geometry.coordinates.length > route.properties.stationIds.length * 3, "real track alignment, not straight station joins");
      assert.ok(route.properties.source.every(s => s.startsWith("osm:relation/")));
    }
  }
  const express = routes.features.find(f => f.properties.id === "rrts_main")!.properties;
  assert.ok(!express.stationIds.includes(station("meerut_metro", "Partapur")), "RRTS does not serve local-only stops");
  const shared = stations.features.filter(f => f.properties.lines.includes("rrts") && f.properties.lines.includes("meerut_metro"));
  assert.deepEqual(shared.map(f => f.properties.name).sort(), ["Meerut South", "Shatabdi Nagar", "Begumpul", "Modipuram"].sort());
});

test("every pedestrian connection works both ways, including a walk-only journey without a train wait", () => {
  assert.equal(transfers.features.length, 5);
  for (const { properties: t } of transfers.features) {
    assert.notEqual(t.fromStationId, t.toStationId);
    for (const [from, to] of [[t.fromStationId, t.toStationId], [t.toStationId, t.fromStationId]]) {
      const j = planner.plan(from, to)!;
      assert.ok(j);
      assert.equal(j.legs.length, 0);
      assert.equal(j.walks.length, 1);
      assert.equal(j.walks[0].fromStationId, from);
      assert.equal(j.walks[0].toStationId, to);
      assert.equal(j.timeS, t.walkSeconds);
      assert.equal(j.transfers, 0);
    }
  }
});

test("Greater Noida to a local Meerut stop uses the Aqua walking link, RRTS and a real shared station", () => {
  const a = station("aqua", "Pari Chowk"), b = station("meerut_metro", "Bhainsali");
  const j = planner.plan(a, b)!;
  assert.ok(j);
  assert.equal(j.legs[0].lineId, "aqua");
  assert.equal(j.legs.at(-1)!.lineId, "meerut_metro");
  assert.ok(j.legs.some(l => l.lineId === "rrts"));
  assert.ok(j.walks.some(w => w.id === "walk_noida_52_51"));
  assert.ok(j.walks.some(w => w.id !== "walk_noida_52_51"));
  const local = j.legs.at(-1)!;
  const boarding = stations.features.find(f => f.properties.id === local.stationIds[0])!.properties;
  assert.ok(boarding.lines.includes("rrts") && boarding.lines.includes("meerut_metro"));
  const back = planner.plan(b, a)!;
  assert.ok(Math.abs(j.timeS - back.timeS) < 1e-6);
});

test("removing the explicit Aqua connector disconnects it rather than guessing a nearby interchange", () => {
  const without = buildRoutePlanner(routes, segments, undefined, { ...transfers, features: transfers.features.filter(f => f.properties.id !== "walk_noida_52_51") });
  assert.equal(without.plan(station("blue", "Noida Sector 52"), station("aqua", "Noida Sector 51")), null);
});
