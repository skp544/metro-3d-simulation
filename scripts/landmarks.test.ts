import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { centerOfMass, polygon, distance, point } from "@turf/turf";
import type { LandmarksFC, StationsFC } from "../src/data/types.ts";

const read=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),"utf8"));
const landmarks=read("../data/processed/landmarks.geojson") as LandmarksFC;
const stations=read("../data/processed/metro_stations.geojson") as StationsFC;

test("landmarks: real snapshot identity and footprint, positions and nearest distances independently checked",()=>{
  assert.equal(landmarks.features.length,4);
  for(const f of landmarks.features){
    const p=f.properties, id=Number(p.source[0].split("/")[1].split("@")[0]);
    const raw=read(`../data/raw/landmarks/${p.snapshot}/way-${id}.json`);
    const way=raw.elements.find((e:{type:string})=>e.type==="way");
    const nodes=new Map<number,[number,number]>(raw.elements.filter((e:{type:string})=>e.type==="node").map((n:{id:number;lon:number;lat:number})=>[n.id,[n.lon,n.lat]]));
    assert.deepEqual(p.footprint,way.nodes.map((n:number)=>nodes.get(n)));
    assert.deepEqual(f.geometry.coordinates,centerOfMass(polygon([p.footprint])).geometry.coordinates);
    const nearest=stations.features.map(s=>({id:s.properties.id,d:distance(point(f.geometry.coordinates),s)*1000})).sort((a,b)=>a.d-b.d)[0];
    assert.equal(nearest.id,p.nearestStation.stationId); assert.equal(Math.round(nearest.d),p.nearestStation.distanceM);
    assert.ok(p.source.length>=2 && p.estimated && !p.verified && p.scope);
  }
});

test("landmarks: exported GLBs have metre scale, ground origins and a bounded triangle budget",()=>{
  for(const f of landmarks.features){
    const glb=readFileSync(new URL(`../public${f.properties.model}`,import.meta.url));
    assert.equal(glb.toString("utf8",0,4),"glTF");
    const json=JSON.parse(glb.toString("utf8",20,20+glb.readUInt32LE(12)));
    let minY=Infinity,maxY=-Infinity,triangles=0;
    for(const mesh of json.meshes) for(const prim of mesh.primitives){
      const a=json.accessors[prim.attributes.POSITION]; minY=Math.min(minY,a.min[1]);maxY=Math.max(maxY,a.max[1]);
      triangles+=json.accessors[prim.indices].count/3;
    }
    assert.ok(Math.abs(minY)<.001,"base origin");assert.ok(Math.abs(maxY-f.properties.heightM)<.001,"source-backed or nominal height in metres");
    assert.ok(triangles>1000 && triangles<30000,"lightweight but recognisable geometry");
    assert.ok(!json.images,"no unlicensed reference photographs distributed");
  }
});
