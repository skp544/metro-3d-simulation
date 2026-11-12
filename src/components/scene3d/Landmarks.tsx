import { useMemo, useState } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { LandmarksFC } from "../../data/types";
import type { Projection } from "../../utils/projection";
import { useMapStore } from "../../store/useMapStore";
import { showLandmark } from "../../store/showLandmark";

export function Landmarks({ data, projection }: { data: LandmarksFC; projection: Projection }) {
  return data.features.map(f => <Landmark key={f.properties.id} f={f} projection={projection} />);
}

function Landmark({ f, projection }: { f: LandmarksFC["features"][number]; projection: Projection }) {
  const { scene } = useGLTF(f.properties.model);
  const copy = useMemo(() => { const c = scene.clone(true); c.traverse(o => { o.castShadow = true; o.receiveShadow = true; }); return c; }, [scene]);
  const [x, z] = projection.project(f.geometry.coordinates as [number, number]);
  const [close, setClose] = useState(false);
  const labels = useMapStore(s => s.labels);
  useFrame(({ camera, controls }) => {
    const target = (controls as unknown as { target?: { x: number; z: number } })?.target;
    const next = !!target && Math.hypot(target.x - x, target.z - z) < 1800 && Math.hypot(camera.position.x - x, camera.position.z - z) < 4000;
    if (next !== close) setClose(next);
  });
  return <group position={[x, .05, z]}>
    <group rotation-y={f.properties.yaw} onClick={e => { e.stopPropagation(); showLandmark(f); }}><primitive object={copy} /></group>
    {close && labels !== "off" && <Html position={[0, f.properties.heightM + 3, 0]} center zIndexRange={[450, 0]}>
      <button type="button" onClick={() => showLandmark(f)} className="whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50/95 px-2 py-1 text-[11px] font-semibold text-amber-900 shadow-sm">{f.properties.name}</button>
    </Html>}
  </group>;
}
