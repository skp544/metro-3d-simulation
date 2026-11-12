import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE } from "../../constants/scene";
import { loadCity, type City as CityData } from "../../data/loadCity";
import type { Projection } from "../../utils/projection";
import { buildCity } from "./buildCity";
import type { LandmarksFC } from "../../data/types";

// Variant order matches scripts/build-city.ts `variant` (0..3): two autumn, two green.
const TREE_MODELS = [
  "/models/kenney/nature/tree_default_fall.glb",
  "/models/kenney/nature/tree_oak_fall.glb",
  "/models/kenney/nature/tree_default.glb",
  "/models/kenney/nature/tree_oak.glb",
];

/** Real OSM buildings, roads and green areas around the stations, plus Kenney trees inside the green areas. */
export function City({ projection, landmarks }: { projection: Projection; landmarks: LandmarksFC }) {
  const [city, setCity] = useState<CityData | null>(null);
  useEffect(() => {
    loadCity().then(setCity, (e: Error) => console.error("City data failed to load:", e.message));
  }, []);
  const built = useMemo(() => (city ? buildCity(city, projection.project, landmarks.features.map(f => ({ footprint: f.properties.footprint, osmId: f.properties.source[0].split("@")[0] }))) : null), [city, projection, landmarks]);
  if (!built) return null;
  return (
    <>
      {built.chunks.map((c) => (
        <group key={c.key}>
          {c.green && (
            <mesh geometry={c.green} receiveShadow>
              <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-1} />
            </mesh>
          )}
          {c.roads && (
            <mesh geometry={c.roads} receiveShadow>
              <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-2} side={THREE.DoubleSide} />
            </mesh>
          )}
          {c.buildings && (
            <mesh geometry={c.buildings} castShadow receiveShadow>
              <meshLambertMaterial vertexColors flatShading side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}
      {TREE_MODELS.map((url, i) => (
        <Trees key={url} url={url} matrices={built.trees[i]} />
      ))}
    </>
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
