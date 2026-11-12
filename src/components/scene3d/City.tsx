import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../../constants/scene";
import { loadEnvironment } from "../../data/loadCity";
import type { City as CityData, CityManifest, CityTile, EnvironmentContext } from "../../data/cityTypes";
import type { Projection } from "../../utils/projection";
import { buildCity } from "./buildCity";
import { facadeTexture, waterTexture } from "./environmentTextures";
import { selectCityTiles } from "../../utils/cityTiles";
import { useMapStore } from "../../store/useMapStore";
import { UrbanLife } from "./UrbanLife";
import type { LandmarksFC } from "../../data/types";

// Variant order matches scripts/build-city.ts `variant` (0..3): two autumn, two green.
const TREE_MODELS = [
  "/models/kenney/nature/tree_default_fall.glb",
  "/models/kenney/nature/tree_oak_fall.glb",
  "/models/kenney/nature/tree_default.glb",
  "/models/kenney/nature/tree_oak.glb",
];

/** Real OSM buildings, roads and green areas around the stations, plus Kenney trees inside the green areas. */
export function City({ projection, landmarks, onStatus }: { projection: Projection; landmarks: LandmarksFC; onStatus: (status:string)=>void }) {
  const [environment,setEnvironment]=useState<{manifest:CityManifest;context:EnvironmentContext}|null>(null);
  const [wanted,setWanted]=useState<CityTile[]>([]);
  const [city,setCity]=useState<CityData|null>(null);
  const cache=useRef(new Map<string,CityData>());
  const last=useRef({time:0,key:""});
  const showGround=useMapStore(s=>s.showGround),showWater=useMapStore(s=>s.showWater);
  const [facade,water]=useMemo(()=>[facadeTexture(),waterTexture()],[]);
  useEffect(() => {
    let active=true;onStatus("Loading surroundings…");
    loadEnvironment().then(e=>{if(active)setEnvironment(e);},(e:Error)=>{if(active)onStatus(`Surroundings unavailable: ${e.message}`);});
    return ()=>{active=false;};
  }, [onStatus]);
  useEffect(()=>()=>{facade.dispose();water.dispose();},[facade,water]);
  useFrame(({camera,controls})=>{
    water.offset.x=(performance.now()*.000009)%1;water.offset.y=(performance.now()*.000003)%1;
    if(!environment||performance.now()-last.current.time<600)return;
    last.current.time=performance.now();const t=(controls as unknown as {target?:THREE.Vector3})?.target;if(!t)return;
    const next=selectCityTiles(environment.manifest,projection,[t.x,t.z],camera.position.distanceTo(t));
    const key=next.map(t=>t.id).join();if(key!==last.current.key){last.current.key=key;setWanted(next);}
    else if(!next.length)onStatus("");
  });
  useEffect(()=>{
    if(!environment)return;
    const abort=new AbortController();let active=true;
    onStatus(wanted.length?"Loading surroundings…":"");
    const queue=[...wanted];
    const worker=async()=>{
      while(queue.length){const t=queue.shift()!;if(cache.current.has(t.url))continue;
        const r=await fetch(t.url,{signal:abort.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);
        cache.current.set(t.url,await r.json() as CityData);
      }
    };
    Promise.all(Array.from({length:4},worker)).then(()=>{
      if(!active)return;
      const merged:CityData={buildings:{type:"FeatureCollection",features:[]},roads:{type:"FeatureCollection",features:[]},green:{type:"FeatureCollection",features:[]},trees:{type:"FeatureCollection",features:[]}};
      const seen=new Set<string>();
      for(const t of wanted){const data=cache.current.get(t.url)!;
        for(const f of data.buildings.features)if(!seen.has(f.properties.id)){seen.add(f.properties.id);merged.buildings.features.push(f);}
        for(const f of data.roads.features)if(!seen.has(f.properties.id+":road")){seen.add(f.properties.id+":road");merged.roads.features.push(f);}
        merged.trees.features.push(...data.trees.features);
      }
      setCity(merged);onStatus("");
      const keep=new Set(wanted.map(t=>t.url));for(const key of cache.current.keys())if(cache.current.size>64&&!keep.has(key))cache.current.delete(key);
    }).catch((e:Error)=>{if(active&&e.name!=="AbortError")onStatus("Some surroundings could not load. Move the view to retry.");});
    return ()=>{active=false;abort.abort();};
  },[wanted,environment,onStatus]);
  const exclusions=useMemo(()=>landmarks.features.map(f=>({footprint:f.properties.footprint,osmId:f.properties.source[0].split("@")[0]})),[landmarks]);
  const empty=useMemo<CityData>(()=>({buildings:{type:"FeatureCollection",features:[]},roads:{type:"FeatureCollection",features:[]},green:{type:"FeatureCollection",features:[]},trees:{type:"FeatureCollection",features:[]}}),[]);
  const built=useMemo(()=>buildCity(city??empty,projection,exclusions),[city,empty,projection,exclusions]);
  const backdrop=useMemo(()=>environment?buildCity(empty,projection,[],environment.context):null,[environment,empty,projection]);
  useEffect(()=>()=>{for(const c of built.chunks)for(const [key,g]of Object.entries(c))if(key!=="key")(g as THREE.BufferGeometry|null)?.dispose();},[built]);
  useEffect(()=>()=>{for(const c of backdrop?.chunks??[])for(const [key,g]of Object.entries(c))if(key!=="key")(g as THREE.BufferGeometry|null)?.dispose();},[backdrop]);
  return (
    <group>
      {showGround&&backdrop?.chunks.map(c=><group key={c.key}>
        {c.land&&<mesh geometry={c.land} receiveShadow><meshLambertMaterial vertexColors side={THREE.DoubleSide}/></mesh>}
        {c.curbs&&<mesh geometry={c.curbs} receiveShadow><meshLambertMaterial vertexColors side={THREE.DoubleSide}/></mesh>}
        {c.roads&&<mesh geometry={c.roads} receiveShadow><meshLambertMaterial vertexColors side={THREE.DoubleSide}/></mesh>}
        {showWater&&c.banks&&<mesh geometry={c.banks}><meshLambertMaterial vertexColors side={THREE.DoubleSide}/></mesh>}
        {showWater&&c.water&&<mesh geometry={c.water} receiveShadow><meshPhongMaterial vertexColors map={water} shininess={70} specular="#abd5df" side={THREE.DoubleSide}/></mesh>}
      </group>)}
      {built.chunks.map((c) => (
        <group key={c.key}>
          {showGround&&c.curbs&&<mesh geometry={c.curbs} receiveShadow><meshLambertMaterial vertexColors side={THREE.DoubleSide}/></mesh>}
          {showGround&&c.markings&&<mesh geometry={c.markings}><meshBasicMaterial vertexColors side={THREE.DoubleSide}/></mesh>}
          {showGround&&c.roads && (
            <mesh geometry={c.roads} receiveShadow>
              <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-2} side={THREE.DoubleSide} />
            </mesh>
          )}
          {c.walls && (
            <mesh geometry={c.walls} castShadow receiveShadow>
              <meshLambertMaterial map={facade} vertexColors side={THREE.DoubleSide} />
            </mesh>
          )}
          {c.roofs&&<mesh geometry={c.roofs} castShadow receiveShadow><meshLambertMaterial vertexColors side={THREE.DoubleSide}/></mesh>}
        </group>
      ))}
      {showGround&&TREE_MODELS.map((url, i) => (
        <Trees key={url} url={url} matrices={built.trees[i]} />
      ))}
      {showGround&&<UrbanLife paths={built.paths} />}
    </group>
  );
}

function Trees({ url, matrices }: { url: string; matrices: THREE.Matrix4[] }) {
  const { scene } = useGLTF(url);
  // A Kenney tree is a few meshes (trunk, leaves) with their own transforms: one instanced mesh each.
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        out.push({ geometry: m.geometry, material: m.material as THREE.Material, local: m.matrixWorld.clone() });
      }
    });
    return out;
  }, [scene]);
  return parts.map((p, i) => <TreePart key={i} part={p} matrices={matrices} />);
}

function TreePart({ part, matrices }: { part: { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }; matrices: THREE.Matrix4[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    matrices.forEach((t, i) => mesh.setMatrixAt(i, m.multiplyMatrices(t, part.local)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices, part]);
  if (!matrices.length) return null;
  return <instancedMesh ref={ref} args={[part.geometry, part.material, matrices.length]} castShadow receiveShadow />;
}

TREE_MODELS.forEach((u) => useGLTF.preload(u));
// Keep the ground colour in one place for MetroScene's plane.
export const CITY_GROUND = PALETTE.ground;
