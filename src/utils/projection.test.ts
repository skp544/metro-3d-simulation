// node --test: the 3D projection matches real distances and directions, and the height profile ramps correctly.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { distance } from "@turf/turf";
import { boundsCentre, createProjection } from "./projection.ts";
import { heightProfile } from "./trackProfile.ts";

const stations = JSON.parse(await readFile("data/processed/metro_stations.geojson", "utf8")).features as {
  properties: { id: string };
  geometry: { coordinates: [number, number] };
}[];
const lines = JSON.parse(await readFile("data/processed/metro_lines.geojson", "utf8"));
const proj = createProjection(boundsCentre(lines));

test("origin is the centre of the network and projects to 0,0", () => {
  const [x, z] = proj.project(proj.origin);
  assert.ok(Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6);
  assert.ok(proj.origin[0] > 76.7 && proj.origin[0] < 77.6 && proj.origin[1] > 28.2 && proj.origin[1] < 28.9);
});

test("project/unproject round-trips every station to < 1 mm", () => {
  for (const s of stations) {
    const back = proj.unproject(proj.project(s.geometry.coordinates));
    assert.ok(distance(back, s.geometry.coordinates, { units: "kilometers" }) * 1e6 < 1, s.properties.id);
  }
});

test("projected distances match geodesic distances within 0.5% across the network", () => {
  let worst = 0;
  for (let i = 0; i < stations.length; i += 7)
    for (let j = i + 3; j < stations.length; j += 11) {
      const [a, b] = [stations[i].geometry.coordinates, stations[j].geometry.coordinates];
      const geo = distance(a, b, { units: "kilometers" }) * 1000;
      if (geo < 1000) continue;
      const [[ax, az], [bx, bz]] = [proj.project(a), proj.project(b)];
      worst = Math.max(worst, Math.abs(Math.hypot(bx - ax, bz - az) / geo - 1));
    }
  assert.ok(worst < 0.005, `worst scale error ${(worst * 100).toFixed(3)}%`);
});

test("east is +x and north is −z", () => {
  const [ex] = proj.project([proj.origin[0] + 0.01, proj.origin[1]]);
  const [, nz] = proj.project([proj.origin[0], proj.origin[1] + 0.01]);
  assert.ok(ex > 900 && nz < -1000);
});

test("height profile: levels, ramps, short portal through ground, unknown interpolated", () => {
  const h = heightProfile(
    [
      { type: "elevated", fromKm: 0, toKm: 5 },
      { type: "at_grade", fromKm: 5, toKm: 5.3 }, // short portal: collapses to its midpoint
      { type: "underground", fromKm: 5.3, toKm: 10 },
      { type: "unknown", fromKm: 10, toKm: 10.2 },
      { type: "underground", fromKm: 10.2, toKm: 12 },
    ],
    0.4,
  );
  assert.equal(h(2), 12);
  assert.equal(h(5.15), 0);
  assert.ok(h(4.9) < 12 && h(4.9) > 0, "ramping down before the portal");
  assert.equal(h(8), -15);
  assert.equal(h(10.1), -15, "unknown between two underground runs stays underground");
  assert.equal(h(12), -15);
});
