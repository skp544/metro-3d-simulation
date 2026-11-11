import assert from "node:assert/strict";
import { test } from "node:test";
import { consistUnderground, trainPitch } from "./trainGeometry.ts";
import type { RoutePath3D } from "./geometry.ts";
import { groundVisible } from "../../utils/underground.ts";

const path: RoutePath3D = { routeId: "test", lineId: "test", km: [0, 0.2, 0.4, 0.6], points: [[0, 10, 0], [200, 10, 0], [400, -10, 0], [600, -10, 0]] };

test("automatic X-ray includes the leading and trailing cars at a tunnel portal", () => {
  assert.equal(consistUnderground(path, 0.1), false);
  assert.equal(consistUnderground(path, 0.3), true, "centre is at surface, leading cars are below");
  assert.equal(consistUnderground(path, 0.5), true);
  assert.equal(consistUnderground(path, 0.24), false, "entire train is above the underground threshold");
});

test("car pitch follows grades and reverses correctly with travel direction", () => {
  assert.equal(trainPitch(path, 0.1, 1), 0);
  const down = trainPitch(path, 0.3, 1);
  assert.ok(Math.abs(down - Math.atan(-0.1)) < 1e-10);
  assert.ok(Math.abs(trainPitch(path, 0.3, -1) + down) < 1e-10);
  assert.ok(Number.isFinite(trainPitch(path, 0, 1)));
});

test("manual underground modes override Auto; Auto only trusts the currently followed train", () => {
  const s = { follow: { trainId: "A" }, undergroundFollow: { trainId: "A", underground: true } };
  assert.equal(groundVisible({ ...s, undergroundMode: "auto" }), false);
  assert.equal(groundVisible({ ...s, undergroundMode: "surface" }), true);
  assert.equal(groundVisible({ ...s, undergroundMode: "underground", follow: null }), false);
  assert.equal(groundVisible({ ...s, undergroundMode: "auto", follow: null }), true);
  assert.equal(groundVisible({ ...s, undergroundMode: "auto", follow: { trainId: "B" } }), true);
  assert.equal(groundVisible({ ...s, undergroundMode: "auto", undergroundFollow: { trainId: "A", underground: false } }), true);
});
