// node --test: the simulated service moves trains sensibly on the real routes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { TRAIN } from "../constants/scene.ts";
import { buildService } from "./trainSim.ts";

const routes = JSON.parse(await readFile("data/processed/metro_routes.geojson", "utf8"));
const service = buildService(routes);

test("trains on every route, about one per headway per direction, unique ids", () => {
  assert.equal(new Set(service.trains.map((t) => t.routeId)).size, routes.features.length);
  assert.equal(new Set(service.trains.map((t) => t.id)).size, service.trains.length);
  for (const r of service.routes) {
    const n = service.trains.filter((t) => t.routeId === r.routeId).length;
    assert.ok(Math.abs(n - r.cycleS / TRAIN.headwayS) <= 1, `${r.routeId}: ${n} trains for a ${Math.round(r.cycleS / 60)} min cycle`);
  }
  console.log(`  ${service.trains.length} simulated trains`);
});

test("a train runs out and back, stays on its route, and dwells at stops", () => {
  const train = service.trains[0];
  const r = service.routes.find((x) => x.routeId === train.routeId)!;
  // Start a quarter-cycle in so both turnarounds fall inside the sampled cycle.
  const start = r.cycleS / 4;
  let prev = service.stateAt(train, start);
  let dwells = 0;
  let reversals = 0;
  for (let t = start + 5; t < start + r.cycleS; t += 5) {
    const s = service.stateAt(train, t);
    assert.ok(s.km >= -1e-9 && s.km <= r.stopKm.at(-1)! + 1e-9, "km within the route");
    // Eased departures preserve duration; peak nominal speed is at most 4/3 of the hop average.
    assert.ok(Math.abs(s.km - prev.km) * 1000 <= ((TRAIN.cruiseKmh * 1000) / 3600) * (4 / 3) * 5 + 1e-6, "no jumps");
    if (s.atStationId) dwells++;
    if (s.dir !== prev.dir) reversals++;
    prev = s;
  }
  assert.ok(dwells > 0);
  assert.equal(reversals, 2, "turns back at each terminus once per cycle");
});

test("average speed with dwells is close to DMRC's ~34 km/h", () => {
  const r = service.routes.find((x) => x.routeId === "blue_main")!;
  const kmh = ((r.stopKm.at(-1)! * 2) / r.cycleS) * 3600;
  assert.ok(kmh > 28 && kmh < 40, `${kmh.toFixed(1)} km/h`);
});

test("next arrivals at an interchange cover each line and direction, soonest first", () => {
  const a = service.nextArrivals("stn_rck", 0);
  assert.ok(a.some((x) => x.lineId === "blue") && a.some((x) => x.lineId === "yellow"));
  assert.ok(a.every((x, i) => i === 0 || a[i - 1].inS <= x.inS));
  assert.ok(a.every((x) => x.inS >= 0 && x.inS <= TRAIN.headwayS * 2));
});
