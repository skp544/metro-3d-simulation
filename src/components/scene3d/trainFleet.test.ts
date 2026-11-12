import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { carCapacity, carOffset, FLEETS, regionalCarGeometry } from "./trainFleet.ts";

test("fleet formations fit their instance buffers and face both cabs outwards", () => {
  assert.deepEqual([FLEETS.dmrc, FLEETS.rrts, FLEETS.aqua, FLEETS.meerut_metro].map(f => f.formation.length), [6, 6, 4, 3]);
  assert.equal(carCapacity(FLEETS.rrts, 1, 5), 20, "four intermediate cars per RRTS train, not the old two");
  for (const fleet of Object.values(FLEETS)) {
    assert.equal(fleet.formation[0], 0);
    assert.equal(fleet.formation.at(-1), 0);
    const offsets = fleet.formation.map((_, i) => carOffset(fleet, i));
    assert.ok(Math.abs(offsets.reduce((a, b) => a + b, 0)) < 1e-8, "formation centred on simulated position");
    assert.equal(offsets[0], -offsets.at(-1)!);
    for (let i = 1; i < offsets.length; i++) assert.ok(Math.abs(offsets[i - 1] - offsets[i] - fleet.carLength) < 1e-8);
    const capacities = fleet.models.map((_, type) => carCapacity(fleet, type, 1));
    assert.equal(capacities.reduce((a, b) => a + b, 0), fleet.formation.length);
  }
});

test("regional GLBs merge into bounded, coloured cars without mutating cached sources", async () => {
  const loader = new GLTFLoader();
  for (const fleet of [FLEETS.rrts, FLEETS.aqua, FLEETS.meerut_metro]) {
    for (const url of fleet.models) {
      const bytes = await readFile(`public${url}`);
      const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
      const originalBounds = new THREE.Box3().setFromObject(gltf.scene).clone();
      const geometry = regionalCarGeometry(gltf.scene, fleet);
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      assert.ok(Math.abs(size.x - fleet.carWidth) < 1e-5);
      assert.ok(Math.abs(size.z - (fleet.carLength - 0.4)) < 1e-5);
      assert.equal(geometry.boundingBox!.min.y, 0, "wheels stand at rail level");
      assert.ok(size.y >= fleet.bodyHeight && size.y < 6, "body retains scale beneath roof equipment/pantograph");
      const positions = geometry.getAttribute("position");
      assert.ok([...positions.array].every(Number.isFinite), "no invalid transforms from quantized glTF attributes");
      const colors = geometry.getAttribute("color");
      assert.equal(colors.count, positions.count);
      const swatches = new Set(Array.from({ length: colors.count }, (_, i) => `${colors.getX(i).toFixed(3)},${colors.getY(i).toFixed(3)},${colors.getZ(i).toFixed(3)}`));
      assert.ok(swatches.size >= 5, "shell, livery, glass and running gear keep distinct colours");
      assert.ok(positions.count / 3 < 11_000, "bounded geometry per car");
      assert.deepEqual(new THREE.Box3().setFromObject(gltf.scene), originalBounds);
      geometry.dispose();
    }
  }
});
