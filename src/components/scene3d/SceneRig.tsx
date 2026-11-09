// Camera animation (fly-to, zoom, network/hub views), the shadow-casting sun that follows the view,
// and station name labels.
import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE, SHADOW } from "../../constants/scene";
import { useMapStore } from "../../store/useMapStore";
import type { Projection } from "../../utils/projection";
import type { StationPoint3D } from "./geometry";

export type View3D = { target: THREE.Vector3; position: THREE.Vector3 };
type Controls = { target: THREE.Vector3; update: () => void };
const FLY_MS = 900;
const FOCUS_DISTANCE_M = 950;

export function CameraRig({ projection, hub, network }: { projection: Projection; hub: View3D; network: View3D }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const focus = useMapStore((s) => s.focus);
  const command = useMapStore((s) => s.camera);
  const anim = useRef<{ from: View3D; to: View3D; t0: number } | null>(null);

  const flyTo = (to: View3D) => {
    if (!controls) return;
    anim.current = { from: { target: controls.target.clone(), position: camera.position.clone() }, to, t0: performance.now() };
  };
  // Keep the current viewing angle, at a comfortable distance, around a new target.
  const around = (target: THREE.Vector3, distance: number): View3D => {
    const offset = camera.position.clone().sub(controls!.target).setLength(distance);
    return { target, position: target.clone().add(offset) };
  };

  useEffect(() => {
    if (!focus || !controls) return;
    const [x, z] = projection.project(focus.coordinates);
    flyTo(around(new THREE.Vector3(x, 0, z), FOCUS_DISTANCE_M));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fly only when a new focus arrives
  }, [focus?.key]);

  useEffect(() => {
    if (!command || !controls) return;
    const d = camera.position.distanceTo(controls.target);
    if (command.command === "zoomIn") flyTo(around(controls.target.clone(), d * 0.6));
    if (command.command === "zoomOut") flyTo(around(controls.target.clone(), d / 0.6));
    if (command.command === "network") flyTo(network);
    if (command.command === "hub") flyTo(hub);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per command
  }, [command?.key]);

  useFrame(() => {
    const a = anim.current;
    if (!a || !controls) return;
    const t = Math.min(1, (performance.now() - a.t0) / FLY_MS);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
    controls.target.lerpVectors(a.from.target, a.to.target, e);
    camera.position.lerpVectors(a.from.position, a.to.position, e);
    controls.update();
    if (t === 1) anim.current = null;
  });
  return null;
}

/** Warm directional sun with soft shadows, re-centred on the view target so shadows stay sharp anywhere. */
export function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const target = light.current!.target;
    scene.add(target);
    return () => void scene.remove(target);
  }, [scene]);
  useFrame(({ controls }) => {
    const t = (controls as unknown as Controls | null)?.target;
    if (!t || !light.current) return;
    light.current.position.set(t.x - 450, 750, t.z + 350);
    light.current.target.position.set(t.x, 0, t.z);
    light.current.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      color={PALETTE.sun}
      intensity={2.1}
      castShadow
      shadow-mapSize={[SHADOW.mapSize, SHADOW.mapSize]}
      shadow-camera-left={-SHADOW.size}
      shadow-camera-right={SHADOW.size}
      shadow-camera-top={SHADOW.size}
      shadow-camera-bottom={-SHADOW.size}
      shadow-camera-near={10}
      shadow-camera-far={2500}
      // Generous bias: the flat-shaded, double-sided low-poly walls otherwise self-shadow in stripes.
      shadow-bias={-0.0015}
      shadow-normalBias={2}
    />
  );
}

const STATION_LABEL_RADIUS_M = 1800;
const MAX_STATION_LABELS = 18;

/** Station names over the nearest stations (labels mode "stations" or "all"). */
export function StationLabels({ stations, names, near }: { stations: StationPoint3D[]; names: Map<string, string>; near: boolean }) {
  const labels = useMapStore((s) => s.labels);
  const showGround = useMapStore((s) => s.showGround);
  const selectStation = useMapStore((s) => s.selectStation);
  const target = useRef<THREE.Vector3 | null>(null);
  const [shown, setShown] = useState<StationPoint3D[]>([]);
  useFrame(({ controls }) => void (target.current = (controls as unknown as Controls | null)?.target ?? null));
  useEffect(() => {
    const pick = () => {
      const t = target.current;
      if (!near || !t || (labels !== "stations" && labels !== "all")) return setShown([]);
      // One label per station: its highest platform (interchange markers excluded).
      const best = new Map<string, StationPoint3D>();
      for (const s of stations) {
        if (s.lineId === null || (s.position[1] < -2 && showGround)) continue;
        const cur = best.get(s.stationId);
        if (!cur || s.position[1] > cur.position[1]) best.set(s.stationId, s);
      }
      const d = (s: StationPoint3D) => Math.hypot(s.position[0] - t.x, s.position[2] - t.z);
      setShown([...best.values()].filter((s) => d(s) < STATION_LABEL_RADIUS_M).sort((a, b) => d(a) - d(b)).slice(0, MAX_STATION_LABELS));
    };
    pick();
    const timer = setInterval(pick, 700);
    return () => clearInterval(timer);
  }, [stations, near, labels, showGround]);
  return shown.map((s) => (
    <Html key={s.stationId} position={[s.position[0], s.position[1] + 14, s.position[2]]} center zIndexRange={[10, 0]}>
      <button
        type="button"
        onClick={() => selectStation(s.stationId)}
        className="rounded-md border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-slate-700 shadow-sm hover:bg-white"
      >
        {names.get(s.stationId)}
      </button>
    </Html>
  ));
}
