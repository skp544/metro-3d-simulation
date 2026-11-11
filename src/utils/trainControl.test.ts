import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { controlTrains, isTrainHeld, runMotion, trainTime, type TrainControls } from "./trainControl.ts";
import { buildService } from "./trainSim.ts";

const service = buildService(JSON.parse(await readFile("data/processed/metro_routes.geojson", "utf8")));
const train = service.trains[0];
const route = service.routes.find((r) => r.routeId === train.routeId)!;

test("hold/resume preserves a train's position, direction and station in both directions", () => {
  for (const leg of [route.legs[0], ...[1, -1].map((dir) => route.legs.find((l) => l.dir === dir && l.fromKm !== l.toKm)!)]) {
    const now = (leg.t0 + leg.t1) / 2 - train.offsetS;
    const before = service.stateAt(train, now);
    const held = controlTrains({}, [train.id], true, now);
    const during = service.stateAt(train, now + route.cycleS * 2, held);
    assert.equal(during.km, before.km);
    assert.equal(during.dir, before.dir);
    assert.equal(during.atStationId, before.atStationId);
    assert.equal(during.speedKmh, 0);
    const resumed = controlTrains(held, [train.id], false, now + route.cycleS * 2);
    const after = service.stateAt(train, now + route.cycleS * 2 + 5, resumed);
    assert.ok(Math.abs(after.km - service.stateAt(train, now + 5).km) < 1e-9);
    assert.equal(after.held, false);
  }
});

test("repeated commands are idempotent; bulk resume does not erase an earlier hold", () => {
  let controls: TrainControls = controlTrains({}, ["A"], true, 10);
  controls = controlTrains(controls, ["A", "B"], true, 30);
  assert.equal(trainTime(100, controls.A), 10);
  assert.equal(trainTime(100, controls.B), 30);
  controls = controlTrains(controls, ["A", "B"], false, 100);
  controls = controlTrains(controls, ["A", "B"], false, 110);
  assert.equal(trainTime(110, controls.A), 20);
  controls = controlTrains(controls, ["A"], true, 120);
  controls = controlTrains(controls, ["A"], false, 180);
  assert.equal(trainTime(190, controls.A), 40);
  assert.equal(trainTime(190, controls.B), 120);
});

test("a held train does not affect others; paused simulation time adds no hold delay", () => {
  const held = controlTrains({}, [train.id], true, 200);
  const other = service.trains[1];
  assert.deepEqual(service.stateAt(other, 500, held), service.stateAt(other, 500));
  const resumed = controlTrains(held, [train.id], false, 200); // clock stayed paused
  assert.equal(resumed[train.id].delayS, 0);
  assert.equal(isTrainHeld(resumed[train.id]), false);
  // A faster shared clock advances each active train equally, while a held train stays fixed.
  assert.equal(trainTime(200 + 8 * 20, held[train.id]), 200);
  assert.equal(trainTime(200 + 8 * 20, resumed[train.id]), 360);
});

test("held trains are excluded from station predictions; all stopped means no arrivals", () => {
  const id = "stn_rck";
  const first = service.nextArrivals(id, 100)[0];
  const held = controlTrains({}, [first.trainId], true, 100);
  assert.ok(service.nextArrivals(id, 100, held).every((a) => a.trainId !== first.trainId));
  const all = controlTrains({}, service.trains.map((t) => t.id), true, 100);
  assert.deepEqual(service.nextArrivals(id, 500, all), []);
  const resumed = controlTrains(all, service.trains.map((t) => t.id), false, 500);
  assert.deepEqual(service.nextArrivals(id, 500, resumed), service.nextArrivals(id, 100));
});

test("a train dwelling at a station is reported as arriving now", () => {
  const arrivals = service.nextArrivals(route.stationIds[0], 10 - train.offsetS);
  assert.ok(arrivals.some((a) => a.trainId === train.id && a.inS === 0));
});

test("nominal motion accelerates, cruises and brakes without changing hop duration", () => {
  for (const duration of [1, 12, 100, 300]) {
    assert.deepEqual(runMotion(0, duration), { fraction: 0, perSecond: 0 });
    assert.deepEqual(runMotion(duration, duration), { fraction: 1, perSecond: 0 });
    assert.ok(Math.abs(runMotion(duration / 2, duration).fraction - 0.5) < 1e-12);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const m = runMotion(duration * i / 100, duration);
      assert.ok(m.fraction >= prev && m.fraction <= 1);
      assert.ok(m.perSecond <= 4 / (3 * duration) + 1e-12);
      prev = m.fraction;
    }
    const step = Math.min(1, duration / 10);
    assert.ok(runMotion(step, duration).perSecond < runMotion(duration / 2, duration).perSecond);
    assert.ok(runMotion(duration - step, duration).perSecond < runMotion(duration / 2, duration).perSecond);
  }
});
