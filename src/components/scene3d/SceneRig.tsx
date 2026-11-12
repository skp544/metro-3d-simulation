// Camera animation (fly-to, fit, zoom, network/hub views, following a train), the view handoff to 2D,
// the shadow-casting sun that follows the view, and station name labels.
import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE, SHADOW } from "../../constants/scene";
import { useCommand } from "../../store/useCommand";
import { groundVisible, simSeconds, useMapStore, viewHandoff } from "../../store/useMapStore";
import { metresPerPixelAtDistance, zoomForMetresPerPixel, type Projection } from "../../utils/projection";
import type { Service } from "../../utils/trainSim";
import { pointAt, type RoutePath3D, type StationPoint3D } from "./geometry";

export type View3D = { target: THREE.Vector3; position: THREE.Vector3 };
type Controls = { target: THREE.Vector3; update: () => void };
const FLY_MS = 900;
const FOCUS_DISTANCE_M = 950;
const FOLLOW_DISTANCE_M = 420; // a 6-car train (~130 m) fills a good part of the view
const PAN_BREAK_M = 3; // the user moved the target this far off the train: they panned, so stop following
const ZERO = new THREE.Vector3();

export function CameraRig({ projection, hub, network, service, paths }: { projection: Projection; hub: View3D; network: View3D; service: Service; paths: RoutePath3D[] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const focus = useMapStore((s) => s.focus);
  const fit = useMapStore((s) => s.fit);
  const command = useMapStore((s) => s.camera);
  const follow = useMapStore((s) => s.follow);
  // `anchor`: the followed train's position when the flight started; the flight's end moves with the train.
  const anim = useRef<{ from: View3D; to: View3D; t0: number; anchor: THREE.Vector3 | null } | null>(null);
  const lastFollow = useRef<THREE.Vector3 | null>(null);
  const lastReport = useRef(0);
  const pathById = useMemo(() => new Map(paths.map((p) => [p.routeId, p])), [paths]);
  const trainById = useMemo(() => new Map(service.trains.map((t) => [t.id, t])), [service]);

  /** Where a simulated train is now (null if unknown or its line is hidden). */
  const trainPosition = (trainId: string) => {
    const s = useMapStore.getState();
    const train = trainById.get(trainId);
    const path = train && pathById.get(train.routeId);
    if (!train || !path || s.hiddenLines.includes(train.lineId)) return null;
    return new THREE.Vector3(...pointAt(path.points, path.km, service.stateAt(train, simSeconds(s), s.trainControls).km).position);
  };
  const flyTo = (to: View3D, anchor: THREE.Vector3 | null = null) => {
    if (!controls) return;
    anim.current = { from: { target: controls.target.clone(), position: camera.position.clone() }, to, t0: performance.now(), anchor };
  };
  // Keep the current viewing angle, at a comfortable distance, around a new target.
  const around = (target: THREE.Vector3, distance: number): View3D => {
    const offset = camera.position.clone().sub(controls!.target).setLength(distance);
    return { target, position: target.clone().add(offset) };
  };

  useCommand("focus", focus?.key, !!controls, () => {
    const [x, z] = projection.project(focus!.coordinates);
    const target = new THREE.Vector3(x, focus!.heightM ?? 0, z);
    const distance = focus!.distanceM ?? FOCUS_DISTANCE_M;
    const yaw = focus!.viewYaw;
    // Landmark selection opens on its modeled facade; ordinary station focus retains the viewing angle.
    flyTo(yaw === undefined ? around(target, distance) : {
      target,
      position: target.clone().add(new THREE.Vector3(Math.sin(yaw), .65, Math.cos(yaw)).setLength(distance)),
    });
  });

  useCommand("fit", fit?.key, !!controls, () => {
    const [[x0, z0], [x1, z1]] = fit!.bounds.map((c) => projection.project(c));
    const centre = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const extent = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    flyTo(around(centre, Math.max(FOCUS_DISTANCE_M, extent * 1.4)));
  });

  useCommand("follow", follow?.key, !!controls, () => {
    const p = trainPosition(follow!.trainId);
    if (p) flyTo(around(p, FOLLOW_DISTANCE_M), p);
    else useMapStore.getState().followTrain(null);
  });

  useCommand("camera", command?.key, !!controls, () => {
    // Zoom around where the camera is going, not where it is: the followed train, or the end of a flight
    // in progress (else a quick zoom right after "follow" or a fit would abandon it half-way).
    const f = useMapStore.getState().follow;
    const anchor = f && trainPosition(f.trainId);
    const goal = anim.current?.to;
    const centre = anchor ?? goal?.target.clone() ?? controls!.target.clone();
    const d = goal ? goal.position.distanceTo(goal.target) : camera.position.distanceTo(controls!.target);
    if (command!.command === "zoomIn") flyTo(around(centre, d * 0.6), anchor);
    if (command!.command === "zoomOut") flyTo(around(centre, d / 0.6), anchor);
    if (command!.command === "network") flyTo(network);
    if (command!.command === "hub") flyTo(hub);
    if(command!.command==="low"||command!.command==="oblique"){
      const low=command!.command==="low",target=new THREE.Vector3(centre.x,anchor?anchor.y+2:low?4:0,centre.z);
      const offset=camera.position.clone().sub(controls!.target).setY(0).normalize().multiplyScalar(low?240:430);offset.y=low?18:320;
      flyTo({target,position:target.clone().add(offset)},anchor);
    }
  });

  useFrame(() => {
    if (!controls) return;
    const store = useMapStore.getState();
    const followed = store.follow ? trainPosition(store.follow.trainId) : null;
    if (store.follow && !followed) store.followTrain(null); // its line was hidden

    const a = anim.current;
    if (a) {
      const t = Math.min(1, (performance.now() - a.t0) / FLY_MS);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
      const shift = followed && a.anchor ? followed.clone().sub(a.anchor) : ZERO;
      controls.target.lerpVectors(a.from.target, a.to.target.clone().add(shift), e);
      camera.position.lerpVectors(a.from.position, a.to.position.clone().add(shift), e);
      controls.update();
      if (t === 1) {
        anim.current = null;
        lastFollow.current = followed;
      }
    } else if (!followed) {
      lastFollow.current = null;
    } else if (lastFollow.current && controls.target.distanceTo(lastFollow.current) > PAN_BREAK_M) {
      store.followTrain(null);
      lastFollow.current = null;
    } else {
      // Carry the camera along with the train; the user can still orbit and zoom around it.
      camera.position.add(followed.clone().sub(controls.target));
      controls.target.copy(followed);
      lastFollow.current = followed;
    }

    // Report the view in 2D terms a few times a second, so switching to 2D opens on the same place.
    const now = performance.now();
    if (now - lastReport.current > 400) {
      lastReport.current = now;
      const center = projection.unproject([controls.target.x, controls.target.z]);
      const mpp = metresPerPixelAtDistance(camera.position.distanceTo(controls.target), (camera as THREE.PerspectiveCamera).fov, size.height);
      viewHandoff.current = { center, zoom: zoomForMetresPerPixel(center[1], mpp), heightPx: size.height };
    }
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
      intensity={1.5}
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
  const showGround = useMapStore(groundVisible);
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
