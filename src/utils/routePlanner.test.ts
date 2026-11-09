// node --test: station-to-station routes on the real network are connected, sensible and symmetric.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildRoutePlanner, TRANSFER_S } from "./routePlanner.ts";

const read = async (f: string) => JSON.parse(await readFile(`data/processed/${f}`, "utf8"));
const [routes, segments, stations] = await Promise.all([read("metro_routes.geojson"), read("metro_segments.geojson"), read("metro_stations.geojson")]);
const planner = buildRoutePlanner(routes, segments);
const props = stations.features.map((f: { properties: { id: string; name: string; lines: string[] } }) => f.properties) as { id: string; name: string; lines: string[] }[];
const id = (name: string) => {
  const s = props.find((p) => p.name === name);
  assert.ok(s, `station "${name}" in the data`);
  return s.id;
};
const segLength = new Map(segments.features.map((f: { properties: { id: string; lengthKm: number } }) => [f.properties.id, f.properties.lengthKm]));

test("every station is reachable from Rajiv Chowk; legs chain end to start", () => {
  const from = id("Rajiv Chowk");
  for (const s of props) {
    if (s.id === from) continue;
    const j = planner.plan(from, s.id);
    assert.ok(j, `no route to ${s.name}`);
    assert.equal(j.legs[0].stationIds[0], from);
    assert.equal(j.legs.at(-1)!.stationIds.at(-1), s.id);
    j.legs.forEach((l, i) => {
      if (i > 0) assert.equal(l.stationIds[0], j.legs[i - 1].stationIds.at(-1), `${s.name}: change at the same station`);
      assert.ok(l.segmentIds.length >= l.stationIds.length - 1, `${s.name}: at least one segment per hop`);
    });
    assert.equal(j.transfers, j.legs.length - 1);
  }
});

test("a trip on one line needs no change and follows its real segments", () => {
  const j = planner.plan(id("Rithala"), id("Shaheed Sthal"))!;
  assert.equal(j.transfers, 0);
  assert.equal(j.legs[0].lineId, "red");
  assert.equal(j.stops, 28);
  const segKm = j.legs[0].segmentIds.reduce((a, s) => a + (segLength.get(s) as number), 0);
  assert.ok(Math.abs(segKm - j.km) < 0.01, `segments ${segKm.toFixed(2)} km vs stops ${j.km.toFixed(2)} km`);
});

test("Indraprastha → Vaishali changes trains at Yamuna Bank (Blue branch)", () => {
  const j = planner.plan(id("Indraprastha"), id("Vaishali"))!;
  assert.equal(j.transfers, 1);
  assert.deepEqual(j.legs.map((l) => l.routeId), ["blue_main", "blue_vaishali"]);
  assert.equal(j.legs[1].stationIds[0], id("Yamuna Bank"));
});

test("an interchange trip changes line at a shared station and costs the transfer time", () => {
  const j = planner.plan(id("Samaypur Badli"), id("Dwarka Sector 21"))!;
  assert.ok(j.transfers >= 1);
  const change = j.legs[1].stationIds[0];
  const lines = props.find((p) => p.id === change)!.lines;
  assert.ok(lines.includes(j.legs[0].lineId) && lines.includes(j.legs[1].lineId), "both lines serve the change station");
  assert.ok(j.timeS > j.transfers * TRANSFER_S);
  const kmh = (j.km / j.timeS) * 3600;
  assert.ok(kmh > 20 && kmh < 40, `${kmh.toFixed(1)} km/h door to door`);
});

test("routes are symmetric and degenerate requests return null", () => {
  const [a, b] = [id("Majlis Park"), id("Noida Electronic City")];
  const there = planner.plan(a, b)!;
  const back = planner.plan(b, a)!;
  assert.ok(Math.abs(there.timeS - back.timeS) < 1e-6);
  assert.equal(there.transfers, back.transfers);
  assert.equal(planner.plan(a, a), null);
  assert.equal(planner.plan(a, "stn_does_not_exist"), null);
});
