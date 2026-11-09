import { Suspense, useMemo, useRef, useState } from "react";
import { MapControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LOD_METRES_PER_PIXEL, PALETTE } from "../../constants/scene";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import type { Service } from "../../utils/trainSim";
import { City } from "./City";
import { buildScene3D } from "./geometry";
import { CameraRig, StationLabels, Sun, type View3D } from "./SceneRig";
import { StationPoints } from "./StationPoints";
// Explicit .tsx: on case-insensitive disks "./Structures" once matched the old structures.ts.
import { Structures } from "./Structures.tsx";
import { TrackLines } from "./TrackLines";
import { Trains } from "./Trains";

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

// Isometric-style viewing direction of the reference: from the south-east, about 35° down.
const HUB_OFFSET = new THREE.Vector3(390, 360, 450); // ≈ 700 m from the hub

export function MetroScene({ network, service }: { network: Network; service: Service }) {
  const scene = useMemo(() => buildScene3D(network), [network]);
  const colors = useMemo(() => new Map(network.lines.features.map((f) => [f.properties.id, f.properties.color])), [network.lines]);
  const names = useMemo(() => new Map(network.stations.features.map((f) => [f.properties.id, f.properties.name])), [network.stations]);
  const showGround = useMapStore((s) => s.showGround);
  const [near, setNear] = useState(false);
  // Close up, the opaque ground hides tunnels; keep underground routes readable as dashed lines on the
  // surface, like a map overlay (the brief: "make underground routes visually understandable").
  const surfaceRuns = useMemo(
    () => scene.runs.filter((r) => r.type === "underground").map((r) => ({ ...r, points: r.points.map(([x, , z]) => [x, 0.6, z] as [number, number, number]) })),
    [scene.runs],
  );

  const { minX, maxX, minZ, maxZ } = scene.bounds;
  const size = Math.max(maxX - minX, maxZ - minZ);
  const views = useMemo(() => {
    // The hub: the station served by the most lines (Kashmere Gate today), chosen from the data.
    const hubStation = [...network.stations.features].sort((a, b) => b.properties.lines.length - a.properties.lines.length)[0];
    const [hx, hz] = scene.projection.project(hubStation.geometry.coordinates as [number, number]);
    const hubTarget = new THREE.Vector3(hx, 0, hz);
    const netTarget = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    return {
      hub: { target: hubTarget, position: hubTarget.clone().add(HUB_OFFSET) } as View3D,
      network: { target: netTarget, position: netTarget.clone().add(new THREE.Vector3(0, size * 0.85, size * 0.8)) } as View3D,
    };
  }, [network.stations, scene, minX, maxX, minZ, maxZ, size]);

  // Start view: ?at=lat,lng,distance aims at a place; ?cam=top looks straight down (to compare with 2D);
  // ?cam=network shows everything; otherwise the hub, close up like the reference.
  const start = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const at = params.get("at")?.split(",").map(Number);
    if (at?.length === 3 && at.every(Number.isFinite)) {
      const [x, z] = scene.projection.project([at[1], at[0]]);
      const target = new THREE.Vector3(x, 0, z);
      return { target, position: target.clone().add(HUB_OFFSET.clone().setLength(at[2])) };
    }
    if (params.get("cam") === "top") return { target: views.network.target, position: views.network.target.clone().add(new THREE.Vector3(0, size * 1.15, 1)) };
    return params.get("cam") === "network" ? views.network : views.hub;
  }, [scene, views, size]);

  return (
    <div className="relative h-full w-full" style={{ background: PALETTE.background }}>
      <Canvas
        shadows
        flat // no tone mapping: palette colours render as specified, like the reference's flat look
        camera={{ position: start.position.toArray(), fov: 40, near: 1, far: size * 6 }}
        // Log depth keeps deck, guideway, roads and ground apart from 1 m to 400 km away.
        gl={{ logarithmicDepthBuffer: true }}
        dpr={[1, 2]}
        aria-label="3D view of the Delhi Metro network"
      >
        <color attach="background" args={[PALETTE.background]} />
        <hemisphereLight args={[PALETTE.sky, PALETTE.bounce, 1.15]} />
        <Sun />
        <MapControls makeDefault target={start.target.toArray()} enableDamping maxPolarAngle={Math.PI * 0.46} minDistance={40} maxDistance={size * 3} />
        <CameraRig projection={scene.projection} hub={views.hub} network={views.network} />
        <LodWatcher onChange={setNear} />
        {showGround && (
          <mesh rotation-x={-Math.PI / 2} position={[(minX + maxX) / 2, 0, (minZ + maxZ) / 2]} receiveShadow>
            <planeGeometry args={[maxX - minX + 20000, maxZ - minZ + 20000]} />
            <meshLambertMaterial color={PALETTE.ground} />
          </mesh>
        )}
        <Suspense fallback={null}>
          <City projection={scene.projection} />
        </Suspense>
        <Structures scene={scene} colors={colors} near={near} />
        <Suspense fallback={null}>
          <Trains scene={scene} service={service} colors={colors} stationNames={names} near={near} />
        </Suspense>
        <StationLabels stations={scene.stations} names={names} near={near} />
        {!near && <TrackLines runs={scene.runs} colors={colors} />}
        {near && showGround && <TrackLines runs={surfaceRuns} colors={colors} dashSize={14} gapSize={10} />}
        {!near && <StationPoints stations={scene.stations} colors={colors} />}
      </Canvas>
      <p className="pointer-events-none absolute right-3 bottom-2 z-[500] rounded bg-white/80 px-2 py-0.5 text-[11px] text-slate-600">
        Map data © OpenStreetMap contributors (ODbL) · models Kenney (CC0) · trains simulated · heights and sizes nominal
      </p>
    </div>
  );
}
