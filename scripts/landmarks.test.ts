import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { area, centerOfMass, polygon, distance, point } from "@turf/turf";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { LandmarksFC, StationsFC } from "../src/data/types.ts";
import { createProjection } from "../src/utils/projection.ts";

const read=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),"utf8"));
const landmarks=read("../data/processed/landmarks.geojson") as LandmarksFC;
const config=read("../data/manual/landmarks.json");
const stations=read("../data/processed/metro_stations.geojson") as StationsFC;
type XY=[number,number];
const edges=(rings:XY[][])=>{
  const result=new Map<string,number>();
  for(const ring of rings)for(let i=1;i<ring.length;i++){
    const edge=[JSON.stringify(ring[i-1]),JSON.stringify(ring[i])].sort().join("|");
    result.set(edge,(result.get(edge)??0)+1);
  }
  return result;
};

test("landmarks: all configured identities, exact source edges, polygon parts and nearest stations",()=>{
  assert.equal(landmarks.features.length,24);
  assert.deepEqual(new Set(landmarks.features.map(f=>f.properties.id)),new Set(config.landmarks.map((p:{id:string})=>p.id)));
  for(const f of landmarks.features){
    const p=f.properties, osm=/^osm:(way|relation)\/(\d+)@/.exec(p.source[0]);
    const cfg=config.landmarks.find((l:{id:string})=>l.id===p.id);
    if(osm){
      const raw=read(`../data/raw/landmarks/${p.snapshot}/${osm[1]}-${osm[2]}.json`);
      const entity=raw.elements.find((e:{type:string;id:number})=>e.type===osm[1]&&e.id===Number(osm[2]));
      assert.ok(cfg.wikidata||cfg.osmName,"identity must not pass because both Wikidata values are missing");
      if(cfg.wikidata)assert.equal(entity.tags.wikidata,cfg.wikidata);
      if(cfg.osmName)assert.equal(entity.tags.name,cfg.osmName);
      for(const [key,value] of Object.entries(cfg.osmTags??{}))assert.equal(entity.tags[key],value);
      const nodes=new Map<number,XY>(raw.elements.filter((e:{type:string})=>e.type==="node").map((n:{id:number;lon:number;lat:number})=>[n.id,[n.lon,n.lat]]));
      const ring=(id:number):XY[]=>{
        const way=raw.elements.find((e:{type:string;id:number})=>e.type==="way"&&e.id===id);
        return way.geometry?way.geometry.map((p:{lon:number;lat:number})=>[p.lon,p.lat]):way.nodes.map((n:number)=>nodes.get(n));
      };
      const outers=osm[1]==="way"?[ring(entity.id)]:entity.members.filter((m:{role:string})=>m.role==="outer").map((m:{ref:number})=>ring(m.ref));
      const holes=osm[1]==="way"?[]:entity.members.filter((m:{role:string})=>m.role==="inner").map((m:{ref:number})=>ring(m.ref));
      assert.deepEqual(edges(p.footprintParts.map(p=>p.outer)),edges(outers),`${p.id}: no changed, lost or invented outer edges`);
      assert.deepEqual(edges(p.footprintParts.flatMap(p=>p.holes)),edges(holes),`${p.id}: courtyard edges retained`);
      for(const part of p.footprintParts)for(const r of [part.outer,...part.holes])assert.deepEqual(r[0],r.at(-1));
      const masses=p.footprintParts.map(p=>{const poly=polygon([p.outer,...p.holes]);return {area:area(poly),center:centerOfMass(poly).geometry.coordinates};});
      const expected=masses.length===1?masses[0].center:[0,1].map(axis=>masses.reduce((sum,m)=>sum+m.center[axis]*m.area,0)/masses.reduce((sum,m)=>sum+m.area,0));
      assert.deepEqual(f.geometry.coordinates,expected);
      if(raw.sourceSnapshot){
        assert.equal(raw.sourceSnapshot,cfg.snapshotSource);
        const original=read(`../${raw.sourceSnapshot}`).elements.find((e:{type:string;id:number})=>e.type===entity.type&&e.id===entity.id);
        assert.deepEqual(entity,original,"extraction preserves the existing immutable OSM element exactly");
        assert.ok(p.source.includes(raw.sourceSnapshot));
      }
    }else{
      assert.equal(p.id,"hanuman-jhandewalan");
      const source=read(`../data/raw/landmarks/${p.snapshot}/hanuman-jhandewalan.json`);
      assert.deepEqual(f.geometry.coordinates,source.coordinates);
      assert.deepEqual(p.footprintParts,[],"no invented statue footprint");
      assert.ok(p.positionSource?.includes("Directory point"));
      assert.ok(p.heightEstimated&&Math.abs(p.heightM-source.heightFeet*.3048)<.01);
      const html=readFileSync(new URL(`../data/raw/landmarks/${p.snapshot}/${source.htmlSnapshot}`,import.meta.url),"utf8");
      for(const coordinate of source.coordinates)assert.ok(html.includes(String(coordinate)));
    }
    const nearest=stations.features.map(s=>({id:s.properties.id,d:distance(point(f.geometry.coordinates),s)*1000})).sort((a,b)=>a.d-b.d)[0];
    assert.equal(nearest.id,p.nearestStation.stationId);assert.equal(Math.round(nearest.d),p.nearestStation.distanceM);
    assert.ok(p.source.length>=2&&p.estimated&&!p.verified&&p.scope);
    const project=createProjection(f.geometry.coordinates as XY);
    p.footprintParts.forEach((part,i)=>{
      [part.outer,...part.holes].forEach((ring,j)=>{
        const local=[p.modelFootprints[i].outer,...p.modelFootprints[i].holes][j];
        ring.forEach((ll,k)=>{
          const [x,z]=project.project(ll),[a,b]=local[k];
          assert.ok(Math.abs(a-(x*Math.cos(p.yaw)-z*Math.sin(p.yaw)))<1e-6);
          assert.ok(Math.abs(b-(-x*Math.sin(p.yaw)-z*Math.cos(p.yaw)))<1e-6);
        });
      });
    });
  }
});

test("places: Delhi categories, separate mall branches and honest site-only scope",()=>{
  const count=(category:string)=>landmarks.features.filter(f=>f.properties.category===category).length;
  assert.equal(count("mall"),8);assert.equal(count("zoo"),1);assert.equal(count("monument"),9);assert.equal(count("religious"),4);assert.equal(count("civic"),2);
  for(const id of ["delhi-zoo","vegas-dwarka","pacific-tagore-garden"]){
    const p=landmarks.features.find(f=>f.properties.id===id)!.properties;
    assert.equal(p.geometryRole,"site");assert.ok(p.heightEstimated&&p.heightM<1);
    assert.match(p.scope,/not reconstructed|not a verified|no verified/i);
  }
  for(const id of ["select-citywalk","dlf-avenue"])assert.equal(landmarks.features.find(f=>f.properties.id===id)!.properties.footprintParts.length,2);
  assert.ok(landmarks.features.find(f=>f.properties.id==="ambience-vasant-kunj")!.properties.footprintParts[0].holes.length>0);
  assert.match(landmarks.features.find(f=>f.properties.id==="agrasen-ki-baoli")!.properties.scope,/Raised cutaway/);
});

test("landmarks: exported GLBs have metre scale, ground origins and a bounded triangle budget",()=>{
  for(const f of landmarks.features){
    const glb=readFileSync(new URL(`../public${f.properties.model}`,import.meta.url));
    assert.equal(glb.toString("utf8",0,4),"glTF");
    const json=JSON.parse(glb.toString("utf8",20,20+glb.readUInt32LE(12)));
    let minY=Infinity,maxY=-Infinity,triangles=0;
    for(const mesh of json.meshes)for(const prim of mesh.primitives){
      const a=json.accessors[prim.attributes.POSITION];minY=Math.min(minY,a.min[1]);maxY=Math.max(maxY,a.max[1]);
      triangles+=json.accessors[prim.indices].count/3;
    }
    assert.ok(Math.abs(minY)<.001,`${f.properties.id}: base origin`);
    assert.ok(Math.abs(maxY-f.properties.heightM)<.001,`${f.properties.id}: source-backed or nominal height in metres`);
    assert.ok(triangles>=24&&triangles<30000,`${f.properties.id}: bounded geometry`);
    assert.ok(!json.images,"no unlicensed reference photographs distributed");
  }
});

test("place models: source polygon parts are present and mapped courtyards remain open",async()=>{
  for(const id of ["select-citywalk","dlf-avenue","ambience-vasant-kunj","jama-masjid"]){
    const f=landmarks.features.find(f=>f.properties.id===id)!;
    const bytes=readFileSync(new URL(`../public${f.properties.model}`,import.meta.url));
    const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
    scene.updateMatrixWorld(true);
    const ray=(x:number,y:number)=>new THREE.Raycaster(new THREE.Vector3(x,f.properties.heightM+20,-y),new THREE.Vector3(0,-1,0)).intersectObject(scene,true);
    for(const part of f.properties.modelFootprints){
      // Sample just inside a source edge, on the solid part of the retail roof.
      const a=part.outer[0],b=part.outer[1],c=centerOfMass(polygon([part.outer])).geometry.coordinates;
      const x=(a[0]+b[0])*.49+c[0]*.02,y=(a[1]+b[1])*.49+c[1]*.02;
      assert.ok(ray(x,y).length>0,`${id}: every source polygon is rendered at its original position`);
      for(const hole of part.holes){const c=centerOfMass(polygon([hole])).geometry.coordinates;assert.equal(ray(c[0],c[1]).length,0,`${id}: courtyard is not filled by roof geometry`);}
    }
    scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
  }
});
