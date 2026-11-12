import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { STRUCTURE as S } from "../../constants/scene.ts";
import { circulationLayout, stationDetailParts, stationParts } from "./buildStructures.ts";

const station = { stationId: "test", lineId: "red", stationType: "elevated", position: [0,12,0] as [number,number,number], yaw: 0 };
const colors = new Map([["red", "#ff0000"]]);
const unit = new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));

test("circulation: stairwells are actual slab openings with an uninterrupted 3 m platform lane", () => {
  const boxes = stationParts([station], colors).find(p => p.key === "platform")!.matrices.map(m => unit.clone().applyMatrix4(m));
  for (const side of [1,-1]) {
    for (const along of [-45,45]) assert.ok(!boxes.some(b => b.containsPoint(new THREE.Vector3(along,13,-side*S.circulation.wellAcross))), "well not plugged by a platform box");
    for (let along=-85;along<85;along+=1) assert.ok(boxes.some(b => b.containsPoint(new THREE.Vector3(along,13,-side*S.circulation.clearLaneAcross))), "lane floor continuous");
  }
  const layout = circulationLayout(station);
  for (const f of layout.flights) {
    assert.ok((f.toY-f.fromY)/f.steps <= .18);
    assert.ok(f.run/f.steps >= .28, "tread depth leaves room for future footsteps");
    assert.equal(f.fromY, layout.concourseY);
    assert.equal(f.toY, layout.platformY);
  }
});

test("circulation: finite rotated parts, train corridor clear, lifts meet all three levels", () => {
  const parts = stationDetailParts([station]);
  for (const p of stationDetailParts([{...station,yaw:1.3}])) assert.ok(p.matrices.every(m => m.elements.every(Number.isFinite)));
  for (const p of parts) for (const m of p.matrices) {
    const b=unit.clone().applyMatrix4(m);
    assert.ok(b.max.z < -3.8 || b.min.z > 3.8 || b.min.y > 18.8, `${p.key} must not obstruct either train or its roof equipment`);
  }
  for (const lift of circulationLayout(station).lifts) assert.deepEqual(lift.stops,[0,6,13.9]);
  // The outboard platform railing must have a real opening at the lift landing.
  const rails=parts.find(p => p.key === "guardRails")!.matrices.map(m => unit.clone().applyMatrix4(m));
  assert.ok(!rails.some(b => b.containsPoint(new THREE.Vector3(65,14.4,-11.72))));
});

test("circulation: shared stations retain baseline platform width; no invented shared concourse", () => {
  const parts=stationParts([station],colors,new Set([station.stationId]));
  const platform=parts.find(p=>p.key==="platform")!;
  assert.equal(platform.matrices.length,2);
  for (const m of platform.matrices) { const b=unit.clone().applyMatrix4(m); assert.ok(Math.abs(b.min.z)<=S.platform.outer+.001 && Math.abs(b.max.z)<=S.platform.outer+.001); }
});
