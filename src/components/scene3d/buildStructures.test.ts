// node --test: the structure builders produce the expected shapes and counts.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { boxMatrix, extrudeRect, pillarMatrices, spansWhere } from "./buildStructures.ts";

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
