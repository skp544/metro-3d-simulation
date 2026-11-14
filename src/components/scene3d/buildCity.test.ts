import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as THREE from "three";
import { boundsCentre, createProjection, type Projection } from "../../utils/projection.ts";
import { selectCityTiles, CITY_TILE_LIMIT } from "../../utils/cityTiles.ts";
import type { City, CityManifest, EnvironmentContext, RoadProps } from "../../data/cityTypes.ts";
import { areaPolygons, buildCity, insideArea, landmarkExclusions, streetPath, streetPose } from "./buildCity.ts";

const read=async(p:string)=>JSON.parse(await readFile(p,"utf8"));
const manifest=await read("data/processed/city_tiles.json") as CityManifest;
const projection=createProjection(boundsCentre(await read("data/processed/metro_lines.geojson")));
const landmarks=await read("data/processed/landmarks.geojson");
const empty=():City=>({buildings:{type:"FeatureCollection",features:[]},roads:{type:"FeatureCollection",features:[]},green:{type:"FeatureCollection",features:[]},trees:{type:"FeatureCollection",features:[]}});
const identity:Projection={origin:[0,0],project:p=>p,unproject:p=>p};
const source={source:["test:fixture"],verified:false,estimated:true,conflicts:[]};

test("city: expanded landmark coverage and bounded streaming selection, finite geometry with facade UVs",async()=>{
  for(const f of landmarks.features){
    const selected=selectCityTiles(manifest,projection,projection.project(f.geometry.coordinates),2500);
    assert.ok(selected.length>4&&selected.length<=CITY_TILE_LIMIT);
    const buildings=selected.reduce((n,t)=>n+t.buildings,0);
    // Delhi's expanded districts have a density requirement. Regional Places reuse
    // existing station snapshots, whose mapped coverage can be sparse (Shopprix).
    assert.ok(buildings>(f.properties.region==="Delhi"?200:0),`${f.properties.name} retains its source-backed city context`);
  }
  assert.equal(selectCityTiles(manifest,projection,[0,0],100000).length,0,"overview retains landscape without loading the entire city's buildings");
  const dense=[...manifest.tiles].sort((a,b)=>b.buildings-a.buildings).slice(0,3);
  for(const tile of dense){
    const city=await read(`public${tile.url}`) as City,built=buildCity(city,projection);
    assert.equal(built.stats.buildings,city.buildings.features.length);
    let triangles=0;
    for(const c of built.chunks)for(const [key,g]of Object.entries(c))if(key!=="key"&&g){
      const geom=g as THREE.BufferGeometry;triangles+=geom.getAttribute("position").count/3;
      assert.ok(Number.isFinite(geom.boundingSphere!.radius));
      assert.ok([...geom.getAttribute("uv").array].every(Number.isFinite));
      geom.dispose();
    }
    assert.ok(triangles<350000,"each dense 1 km tile stays within a local geometry budget");
    assert.equal(built.trees.flat().length,city.trees.features.length);
  }
});

test("city: Yamuna snapshot is present; water triangulation retains islands and faces upward",async()=>{
  const water=await read("data/processed/city_water.geojson");
  assert.ok(water.features.some((f:{properties:{name:string}})=>/yamuna/i.test(f.properties.name)));
  assert.ok(water.features.every((f:{properties:typeof source})=>f.properties.source.length&&Array.isArray(f.properties.conflicts)));
  const context:EnvironmentContext={land:{type:"FeatureCollection",features:[]},roads:{type:"FeatureCollection",features:[]},water:{type:"FeatureCollection",features:[{type:"Feature",properties:{...source,id:"water",kind:"river",name:"Fixture"},geometry:{type:"Polygon",coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[4,6],[6,6],[6,4],[4,4]]]}}]}};
  const built=buildCity(empty(),identity,[],context),g=built.chunks.find(c=>c.water)!.water!;
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
  const ray=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
  assert.ok(ray(2,2).length>0,"mapped water is rendered");assert.equal(ray(5,5).length,0,"island is not flooded by the mesh");
  assert.ok(g.getAttribute("normal").getY(0)>.9,"water lit from above");
  g.dispose();(mesh.material as THREE.Material).dispose();
});

test("city: India Gate's enclosing OSM building is excluded without removing surrounding buildings", async () => {
  const gate = landmarks.features.find((f: { properties: { id: string } }) => f.properties.id === "india-gate");
  const selected = selectCityTiles(manifest, projection, projection.project(gate.geometry.coordinates), 2500);
  const tiles = await Promise.all(selected.map(t => read(`public${t.url}`) as Promise<City>));
  const city = empty();
  city.buildings.features = tiles.flatMap(t => t.buildings.features);
  const enclosing = city.buildings.features.find(f => areaPolygons(f.geometry).some(rs => insideArea(gate.geometry.coordinates, rs)))!;
  assert.ok(enclosing, "real city tile contains the duplicate building outline");
  assert.notEqual(enclosing.properties.id, gate.properties.source[0].split("@")[0]);
  assert.ok(areaPolygons(enclosing.geometry).every(rs => rs[0].every(p => !insideArea(p, [gate.properties.footprint]))), "old corner-only check misses the enclosing outline");
  const exclusion = { footprint: gate.properties.footprint, osmId: gate.properties.source[0].split("@")[0] };
  const duplicateOnly = empty();
  duplicateOnly.buildings.features = [enclosing];
  assert.equal(buildCity(duplicateOnly, projection, [exclusion]).stats.buildings, 0);
  const built = buildCity(city, projection, [exclusion]);
  assert.ok(built.stats.buildings > 0, "nearby city buildings remain");
  assert.equal(built.stats.buildings, city.buildings.features.length - 1, "only the duplicate outline is removed");
  for (const chunk of built.chunks) for (const [key, value] of Object.entries(chunk))
    if (key !== "key") (value as THREE.BufferGeometry | null)?.dispose();
});

test("city: mapped sites preserve city context; mall parts exclude duplicates while keeping courtyard trees",()=>{
  const exclusions=landmarkExclusions(landmarks);
  for(const site of landmarks.features.filter((f:{properties:{geometryRole:string}})=>f.properties.geometryRole==="site")){
    assert.ok(!exclusions.some(e=>e.osmId===site.properties.source[0].split("@")[0]));
  }
  const mall=landmarks.features.find((f:{properties:{id:string}})=>f.properties.id==="select-citywalk");
  assert.equal(exclusions.filter(e=>e.osmId===mall.properties.source[0].split("@")[0]).length,2);
  const city=empty();
  city.trees.features=[
    {type:"Feature",geometry:{type:"Point",coordinates:[2,2]},properties:{...source,area:"test:courtyard",variant:0}},
    {type:"Feature",geometry:{type:"Point",coordinates:[5,5]},properties:{...source,area:"test:courtyard",variant:0}},
  ];
  const built=buildCity(city,identity,[{osmId:"test:mall",footprint:[[0,0],[10,0],[10,10],[0,10],[0,0]],holes:[[[4,4],[4,6],[6,6],[6,4],[4,4]]]}]);
  assert.equal(built.trees.flat().length,1,"tree on mall footprint removed; tree in open courtyard retained");
});

test("streets: left-hand traffic follows real bends, reverse lanes stay separate, bridge ramps are continuous",()=>{
  const p:RoadProps={...source,id:"road",name:"",class:"primary",width:12,oneway:false,bridge:false};
  const path=streetPath([[0,0],[100,0],[100,100]],p,identity.project);
  assert.deepEqual(streetPose(path,50,1,3).position,[50,.22,-3]);
  assert.deepEqual(streetPose(path,50,-1,3).position,[50,.22,3]);
  assert.deepEqual(streetPose(path,150,1,3).position,[103,.22,50]);
  const bridge=streetPath([[0,0],[500,0]],{...p,bridge:true},identity.project);
  assert.equal(bridge.points[0][1],.22);assert.equal(bridge.points.at(-1)![1],.22);
  assert.ok(streetPose(bridge,250,1,0).position[1]>6,"even a two-node mapped bridge has an elevated deck");
  for(let i=1;i<bridge.points.length;i++)assert.ok(Math.abs(bridge.points[i][1]-bridge.points[i-1][1])/(bridge.distances[i]-bridge.distances[i-1])<=.05001);
});
