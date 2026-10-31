// node --test: the validator must pass the real dataset and catch each kind of corruption.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { locate, validate } from "./validate.ts";

const FILES = ["metro_lines", "metro_routes", "metro_segments", "metro_stations", "interchange_stations", "metro_under_construction"];
type FC = { features: { properties: Record<string, any>; geometry: { coordinates: any } }[] };

// Copies data/processed into a temp dir after applying `mutate`, then validates the copy.
async function validateMutated(mutate: (d: Record<string, FC>) => void) {
  const data: Record<string, FC> = {};
  for (const f of FILES) data[f] = JSON.parse(await readFile(`data/processed/${f}.geojson`, "utf8"));
  mutate(data);
  const dir = await mkdtemp(join(tmpdir(), "metro-validate-"));
  for (const f of FILES) await writeFile(join(dir, `${f}.geojson`), JSON.stringify(data[f]));
  try {
    return await validate(dir);
  } finally {
    await rm(dir, { recursive: true });
  }
}
const codes = (r: Awaited<ReturnType<typeof validate>>) => new Set(r.issues.filter((i) => i.severity === "error").map((i) => i.code));
const route = (d: Record<string, FC>, id: string) => d.metro_routes.features.find((f) => f.properties.id === id)!;

test("real dataset passes", async () => {
  const r = await validate();
  assert.equal(r.summary.errors, 0, JSON.stringify(r.issues.filter((i) => i.severity === "error"), null, 1));
});

test("duplicate station id", async () => {
  const r = await validateMutated((d) => d.metro_stations.features.push(structuredClone(d.metro_stations.features[0])));
  assert.ok(codes(r).has("DUPLICATE_ID"));
});

test("swapped lat/lng is out of bounds", async () => {
  const r = await validateMutated((d) => {
    const c = d.metro_stations.features[5].geometry.coordinates;
    d.metro_stations.features[5].geometry.coordinates = [c[1], c[0]];
  });
  assert.ok(codes(r).has("OUT_OF_BOUNDS"));
});

test("stations out of order", async () => {
  const r = await validateMutated((d) => {
    const ids = route(d, "yellow_main").properties.stationIds;
    [ids[10], ids[11]] = [ids[11], ids[10]];
  });
  assert.ok(codes(r).has("STATION_ORDER"));
});

test("missing segment breaks the chain", async () => {
  const r = await validateMutated((d) => {
    d.metro_segments.features = d.metro_segments.features.filter((f) => f.properties.id !== "violet_main_010");
  });
  assert.ok(codes(r).has("SEGMENT_GAP"));
});

test("wrong isInterchange flag", async () => {
  const r = await validateMutated((d) => {
    d.metro_stations.features.find((f) => f.properties.id === "stn_rck")!.properties.isInterchange = false;
  });
  assert.ok(codes(r).has("INTERCHANGE_MISMATCH"));
});

test("dropping a branch's segments disconnects the network", async () => {
  const r = await validateMutated((d) => {
    d.metro_segments.features = d.metro_segments.features.filter((f) => f.properties.routeId !== "grey_main");
  });
  assert.ok(codes(r).has("NETWORK_DISCONNECTED"));
});

test("segment length that disagrees with its geometry", async () => {
  const r = await validateMutated((d) => {
    d.metro_segments.features[0].properties.lengthKm += 1;
  });
  assert.ok(codes(r).has("LENGTH_INCONSISTENT"));
});

test("bad enum value", async () => {
  const r = await validateMutated((d) => {
    d.metro_segments.features[0].properties.trackType = "flying";
  });
  assert.ok(codes(r).has("SCHEMA"));
});

test("locate() picks the first pass on a loop", () => {
  // Out east 1 km, then back west along a parallel track 10 m north: the start point is passed twice.
  const line: [number, number][] = [[77, 28.6], [77.01, 28.6], [77.01, 28.6001], [77, 28.6001]];
  const first = locate(line, [77.0001, 28.60005]);
  assert.ok(first.km < 0.1, `expected the first pass, got ${first.km} km`);
  const second = locate(line, [77.0001, 28.60005], 1);
  assert.ok(second.km > 1.9, `expected the second pass, got ${second.km} km`);
});
