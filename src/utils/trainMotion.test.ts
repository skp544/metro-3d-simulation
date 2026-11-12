import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { RoutesFC, SegmentsFC } from "../data/types.ts";
import { TRAIN } from "../constants/scene.ts";
import { trainSpeedProfile } from "../constants/trainSpeeds.ts";
import { buildRun, motionAt } from "./trainMotion.ts";
import { buildService } from "./trainSim.ts";
import { buildRoutePlanner } from "./routePlanner.ts";

test("published operating speeds are separate from design speeds and nominal model settings", () => {
  assert.equal(trainSpeedProfile("rrts").publishedMaxKmh, 160);
  assert.equal(trainSpeedProfile("rrts").designKmh, 180);
  assert.equal(trainSpeedProfile("rrts").simulationMaxKmh, 160);
  assert.equal(trainSpeedProfile("airport_express").publishedMaxKmh, 120);
  assert.equal(trainSpeedProfile("meerut_metro").publishedMaxKmh, 120);
  for (const line of ["rrts", "airport_express", "meerut_metro"]) assert.ok(trainSpeedProfile(line).source?.url.startsWith("https://"));
  for (const line of ["red", "blue", "aqua"]) {
    assert.equal(trainSpeedProfile(line).publishedMaxKmh, null, "nominal caps must not be presented as verified operational maxima");
    assert.equal(trainSpeedProfile(line).source, null);
  }
});

test("long runs accelerate, cruise at the operating cap, and stop without position jumps", () => {
  const run = buildRun(10_000, 160, 0.8, 0.9);
  assert.ok(run.cruiseS > 0);
  assert.deepEqual(motionAt(run, 0), { distanceM: 0, speedKmh: 0 });
  assert.deepEqual(motionAt(run, run.durationS), { distanceM: 10_000, speedKmh: 0 });
  assert.ok(Math.abs(motionAt(run, run.accelerationS + run.cruiseS / 2).speedKmh - 160) < 1e-8);
  let previous = motionAt(run, 0);
  for (let t = 0.25; t <= run.durationS; t += 0.25) {
    const current = motionAt(run, t);
    assert.ok(current.distanceM >= previous.distanceM);
    assert.ok(current.distanceM - previous.distanceM <= (160 / 3.6) * 0.25 + 1e-8);
    assert.ok(current.speedKmh >= 0 && current.speedKmh <= 160 + 1e-8);
    previous = current;
  }
});

test("short station spacing lowers peak speed; motion is finite for a zero-length hop", () => {
  const run = buildRun(100, 160, 0.8, 0.9);
  assert.ok(run.peakMps * 3.6 < 160);
  assert.ok(run.cruiseS < 1e-8);
  const at = motionAt(run, run.accelerationS);
  assert.ok(at.distanceM > 0 && at.distanceM < 100);
  assert.ok(motionAt(run, run.durationS - 0.001).speedKmh < 0.01);
  assert.deepEqual(motionAt(buildRun(0, 120, 0.8, 0.9), 1), { distanceM: 0, speedKmh: 0 });
  assert.throws(() => buildRun(-1, 160, 0.8, 0.9));
  assert.throws(() => buildRun(100, 0, 0.8, 0.9));
});

const routes = JSON.parse(await readFile("data/processed/metro_routes.geojson", "utf8")) as RoutesFC;
const segments = JSON.parse(await readFile("data/processed/metro_segments.geojson", "utf8")) as SegmentsFC;
const service = buildService(routes);

test("displayed speed matches the derivative of train position in simulated time, in both directions", () => {
  for (const route of service.routes) {
    const train = service.trains.find(t => t.routeId === route.routeId)!;
    for (const leg of route.legs) {
      if (!leg.motion) {
        assert.equal(service.stateAt(train, (leg.t0 + leg.t1) / 2 - train.offsetS).speedKmh, 0);
        continue;
      }
      const at = leg.t0 + leg.motion.accelerationS / 2 - train.offsetS;
      const state = service.stateAt(train, at);
      const before = service.stateAt(train, at - 0.001), after = service.stateAt(train, at + 0.001);
      const derivativeKmh = Math.abs(after.km - before.km) / 0.002 * 3600;
      assert.ok(Math.abs(state.speedKmh - derivativeKmh) < 0.001, `${route.routeId}: ${state.speedKmh} displayed vs ${derivativeKmh} from distance`);
      assert.ok(state.speedKmh <= route.maxSpeedKmh + 1e-8);
    }
  }
});

test("real long express hops can reach their caps, and planner estimates use the same motion as the trains", () => {
  const planner = buildRoutePlanner(routes, segments);
  for (const [id, cap] of [["rrts_main", 160], ["airport_express_main", 120]] as const) {
    const route = service.routes.find(r => r.routeId === id)!;
    assert.ok(route.legs.some(l => l.motion && Math.abs(l.motion.peakMps * 3.6 - cap) < 1e-8));
    const hop = route.legs.find(l => l.motion)!;
    const journey = planner.plan(route.stationIds[0], route.stationIds[1])!;
    assert.ok(journey);
    assert.ok(Math.abs(journey.timeS - (hop.t1 - hop.t0 + TRAIN.dwellS)) < 1e-6, `${id}: route estimate follows the simulation's acceleration and speed cap`);
  }
});
