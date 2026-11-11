// node --test: the structure builders produce the expected shapes and counts.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { STRUCTURE as S, TRAIN } from "../../constants/scene.ts";
import { boxMatrix, extrudeRect, localBox, offsetPath, pillarMatrices, sleeperMatrices, spansWhere, stationParts } from "./buildStructures.ts";

type V3 = [number, number, number];
const straight = (len: number, y: number): V3[] => Array.from({ length: 11 }, (_, i) => [(i * len) / 10, y, 0]);

test("extrudeRect: 2 vertices per point per face, box cross-section where asked", () => {
  const g = extrudeRect([{ points: straight(100, 48), color: [1, 0, 0] }], 5, -8, 0, ["top", "bottom", "left", "right"]);
  assert.equal(g.getAttribute("position").count, 11 * 2 * 4);
  assert.equal(g.getIndex()!.count, 10 * 6 * 4);
  g.computeBoundingBox();
  const b = g.boundingBox!;
  assert.deepEqual([b.min.y, b.max.y, b.min.z, b.max.z], [40, 48, -5, 5]);
});

test("extrudeRect: the left side is on the left of travel", () => {
  // Travelling +x (east); left of travel is north = −z.
  const g = extrudeRect([{ points: straight(10, 0), color: [1, 1, 1] }], 2, 0, 1, ["left"]);
  const z = g.getAttribute("position").getZ(0);
  assert.equal(z, -2);
});

test("spansWhere: contiguous stretches, padded by one point each side", () => {
  const pts: V3[] = [0, 0, 20, 30, 20, 0, 0, -30, -30, 0].map((y, i) => [i, y, 0]);
  const up = spansWhere(pts, (y) => y > 2);
  assert.equal(up.length, 1);
  assert.deepEqual(up[0].map((p) => p[1]), [0, 20, 30, 20, 0]);
  assert.equal(spansWhere(pts, (y) => y < -2).length, 1);
});

test("pillarMatrices: one per spacing along a span, skipping ones too short", () => {
  const ms = pillarMatrices([straight(300, 48)], 30, 2.5, 8, 4);
  assert.equal(ms.length, 10);
  const s = new THREE.Vector3();
  ms[0].decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
  assert.equal(s.y, 40, "ground to under the deck");
  assert.equal(pillarMatrices([straight(300, 10)], 30, 2.5, 8, 4).length, 0, "2 m tall: skipped");
});

test("boxMatrix: oriented along the yaw", () => {
  const m = boxMatrix([0, 48, 0], Math.PI / 2, 180, 13, -16, 24);
  const end = new THREE.Vector3(0.5, 0, 0).applyMatrix4(m); // box's local +x end
  assert.ok(Math.abs(end.x) < 1e-6 && Math.abs(end.z + 90) < 1e-6, "yaw π/2 points the length north (−z)");
  assert.ok(Math.abs(end.y - 52) < 1e-6, "centre height = track + (bottom+top)/2");
});

test("offsetPath: moves the path to the left of travel, keeping heights", () => {
  const p = offsetPath(straight(100, 12), 2); // travelling +x: left is −z
  assert.ok(p.every((q, i) => Math.abs(q[2] + 2) < 1e-9 && q[1] === 12 && Math.abs(q[0] - i * 10) < 1e-9));
});

test("localBox: across is to the left of the yaw direction; roll lowers the left edge", () => {
  const m = localBox([0, 12, 0], 0, { across: 5, length: 10, halfWidth: 1, bottom: 0, top: 2 });
  const c = new THREE.Vector3().applyMatrix4(m);
  assert.ok(Math.abs(c.z + 5) < 1e-9 && Math.abs(c.y - 13) < 1e-9, "yaw 0 travels +x, so left is −z");
  const tilted = localBox([0, 0, 0], 0, { length: 10, halfWidth: 5, bottom: -0.5, top: 0.5, roll: 0.2 });
  const leftEdge = new THREE.Vector3(0, 0, -0.5).applyMatrix4(tilted); // local −z = left of travel
  const rightEdge = new THREE.Vector3(0, 0, 0.5).applyMatrix4(tilted);
  assert.ok(leftEdge.y < 0 && rightEdge.y > 0 && leftEdge.z < 0);
});

test("stationParts: side platforms clear the trains, roof above them, concourse only under high track", () => {
  const station = (y: number) => ({ stationId: "s", lineId: "red", stationType: "elevated", position: [0, y, 0] as V3, yaw: 0 });
  const parts = stationParts([station(12)], new Map([["red", "#ff0000"]]));
  const get = (k: string) => parts.find((p) => p.key === k)!;
  const centres = (k: string) => get(k).matrices.map((m) => new THREE.Vector3().setFromMatrixPosition(m));
  // A train on either track (left-hand running) must fit between the platforms, under the roof.
  const trainEdge = TRAIN.trackOffset + TRAIN.carWidth / 2;
  assert.ok(S.platform.inner > trainEdge, `platform edge ${S.platform.inner} m beyond the train's ${trainEdge} m`);
  assert.ok(S.roof.eave > S.railTop + TRAIN.carHeight, "train fits under the eaves");
  assert.deepEqual(centres("platform").map((c) => Math.sign(c.z)), [-1, 1], "one platform each side");
  assert.ok(centres("roof").every((c) => c.y > 12 + S.platform.top));
  assert.equal(get("column").matrices.length, 2 * Math.floor(S.stationLength / S.roof.columnSpacing));
  assert.equal(get("fascia").colors!.length, 2);
  assert.equal(get("concourse").matrices.length, 1);
  assert.equal(stationParts([station(0.5)], new Map([["red", "#ff0000"]])).find((p) => p.key === "concourse"), undefined, "at grade: no concourse");
});

test("sleeperMatrices: evenly spaced along the track, only near the view, capped", () => {
  const track = straight(1000, 12); // 0..1000 m along +x, points every 100 m
  const all = sleeperMatrices([track], [500, 0], 10_000, 0.65);
  assert.equal(all.length, Math.floor(1000 / 0.65) + 1);
  const xs = all.map((m) => new THREE.Vector3().setFromMatrixPosition(m).x);
  assert.ok(xs.every((x, i) => i === 0 || Math.abs(x - xs[i - 1] - 0.65) < 1e-6), "constant spacing across segment joins");
  const near = sleeperMatrices([track], [500, 0], 100, 0.65);
  assert.ok(near.length > 300 && near.length < 310, `${near.length} within 100 m`);
  const nx = near.map((m) => new THREE.Vector3().setFromMatrixPosition(m).x);
  assert.ok(nx.every((x) => x > 400 && x < 600));
  assert.ok(Math.abs((nx[0] / 0.65) - Math.round(nx[0] / 0.65)) < 1e-6, "same positions as the full set: no jump when the window moves");
  assert.equal(sleeperMatrices([track], [500, 0], 10_000, 0.65, 50).length, 50);
  assert.equal(sleeperMatrices([track], [500, 5000], 100, 0.65).length, 0);
});
