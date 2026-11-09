// node --test: the real OSM surroundings build into chunked low-poly geometry within budget.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { boundsCentre, createProjection } from "../../utils/projection.ts";
import { buildCity } from "./buildCity.ts";

const read = async (f: string) => JSON.parse(await readFile(`data/processed/${f}.geojson`, "utf8"));
const city = { buildings: await read("city_buildings"), roads: await read("city_roads"), green: await read("city_green"), trees: await read("city_trees") };
const projection = createProjection(boundsCentre(await read("metro_lines")));

test("city builds into chunks, every building extruded, within the triangle budget", () => {
  const built = buildCity(city, projection.project);
  const tris = built.chunks.reduce((a, c) => a + [c.buildings, c.roads, c.green].reduce((n, g) => n + (g ? g.getAttribute("position").count / 3 : 0), 0), 0);
  console.log(`  ${built.stats.chunks} chunks, ${city.buildings.features.length} buildings (${built.stats.buildingTris} tris), ${tris} tris total, ${built.stats.trees} trees`);
  assert.ok(built.stats.chunks > 10, "split into several culling chunks");
  assert.ok(built.stats.buildingTris >= city.buildings.features.length * 6, "every building has walls and a roof");
  assert.ok(tris < 2_000_000, "under 2M triangles for the whole city");
  assert.equal(built.trees.flat().length, city.trees.features.length);
  for (const c of built.chunks)
    for (const g of [c.buildings, c.roads, c.green]) if (g) assert.ok(Number.isFinite(g.boundingSphere!.radius), `chunk ${c.key} has finite bounds`);
});
