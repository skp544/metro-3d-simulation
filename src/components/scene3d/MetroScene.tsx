import { useMemo, useRef, useState } from "react";
import { Grid, MapControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { GROUND_COLOR, GROUND_OPACITY, LOD_METRES_PER_PIXEL, SCENE_BACKGROUND, VERTICAL_EXAGGERATION } from "../../constants/scene";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import { buildScene3D } from "./geometry";
import { StationPoints } from "./StationPoints";
// Explicit .tsx: on case-insensitive disks "./Structures" once matched the old structures.ts.
import { Structures } from "./Structures.tsx";
import { TrackLines } from "./TrackLines";

// Reports whether the view is close enough for real track geometry: an 8 m ribbon must be a few pixels wide.
function LodWatcher({ onChange }: { onChange: (near: boolean) => void }) {
  const near = useRef<boolean | null>(null);
  useFrame(({ camera, controls, size }) => {
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    if (!target) return;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const mpp = (2 * camera.position.distanceTo(target) * Math.tan((fov * Math.PI) / 360)) / size.height;
    const next = mpp < LOD_METRES_PER_PIXEL * (near.current ? 1.2 : 1); // hysteresis: no flicker at the threshold
    if (next !== near.current) onChange((near.current = next));
  });
  return null;
}

export function MetroScene({ network }: { network: Network }) {
  const scene = useMemo(() => buildScene3D(network), [network]);
  const colors = useMemo(() => new Map(network.lines.features.map((f) => [f.properties.id, f.properties.color])), [network.lines]);
  const showGround = useMapStore((s) => s.showGround);
  const [near, setNear] = useState(false);

  const { minX, maxX, minZ, maxZ } = scene.bounds;
  const size = Math.max(maxX - minX, maxZ - minZ);
  // Start view: ?at=lat,lng,distance aims at a place; ?cam=top looks straight down (to compare with 2D);
  // otherwise the whole network from the south.
  const params = new URLSearchParams(location.search);
  const at = params.get("at")?.split(",").map(Number);
  const [tx, tz] = at?.length === 3 && at.every(Number.isFinite) ? scene.projection.project([at[1], at[0]]) : [(minX + maxX) / 2, (minZ + maxZ) / 2];
  const d = at?.length === 3 && at.every(Number.isFinite) ? at[2] : size;
  const camera = params.get("cam") === "top" ? ([tx, d * 1.15, tz + 1] as const) : ([tx, d * 0.85, tz + d * 0.8] as const);

  return (
    <div className="relative h-full w-full" style={{ background: SCENE_BACKGROUND }}>
      <Canvas
        camera={{ position: camera, fov: 45, near: 1, far: size * 6 }}
        // Log depth keeps the deck, ribbon and ground apart from 1 m to 400 km away.
        gl={{ logarithmicDepthBuffer: true }}
        dpr={[1, 2]}
        aria-label="3D view of the Delhi Metro network"
      >
        <color attach="background" args={[SCENE_BACKGROUND]} />
        <hemisphereLight args={["#ffffff", "#94a3b8", 1.6]} />
        <directionalLight position={[-1, 2, 1.2]} intensity={1.6} />
        <MapControls makeDefault target={[tx, 0, tz]} enableDamping maxPolarAngle={Math.PI * 0.47} minDistance={60} maxDistance={size * 3} />
        <LodWatcher onChange={setNear} />
        {showGround && (
          <>
            <mesh rotation-x={-Math.PI / 2} position={[(minX + maxX) / 2, 0, (minZ + maxZ) / 2]} renderOrder={3}>
              <planeGeometry args={[maxX - minX + 20000, maxZ - minZ + 20000]} />
              <meshBasicMaterial color={GROUND_COLOR} transparent opacity={GROUND_OPACITY} depthWrite={false} />
            </mesh>
            <Grid
              position={[(minX + maxX) / 2, 0.5, (minZ + maxZ) / 2]}
              args={[maxX - minX + 20000, maxZ - minZ + 20000]}
              cellSize={1000}
              sectionSize={5000}
              cellColor="#e2e8f0"
              sectionColor="#cbd5e1"
              fadeDistance={size * 2.5}
              renderOrder={4}
            />
          </>
        )}
        <Structures scene={scene} colors={colors} near={near} />
        {!near && <TrackLines runs={scene.runs} colors={colors} />}
        {!near && <StationPoints stations={scene.stations} colors={colors} />}
      </Canvas>
      <p className="pointer-events-none absolute right-3 bottom-2 rounded bg-white/80 px-2 py-0.5 text-[11px] text-slate-600">
        Metro data © OpenStreetMap contributors (ODbL) · grid 1 km · heights and structure sizes nominal, ×{VERTICAL_EXAGGERATION} vertical
      </p>
    </div>
  );
}
