import { useEffect, useMemo, useRef, useState } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STRUCTURE, TRAIN } from "../../constants/scene";
import { simSeconds, useMapStore } from "../../store/useMapStore";
import type { Service, TrainState } from "../../utils/trainSim";
import { pointAt, type Scene3DData } from "./geometry";

const CAR_MODELS = [
  "/models/kenney/train/train-electric-subway-a.glb", // cab car (nose towards +z); used reversed at the rear
  "/models/kenney/train/train-electric-subway-b.glb",
  "/models/kenney/train/train-electric-subway-c.glb",
];
const RENDER_RADIUS_M = 5000; // full models only near the view target; further away is sub-pixel anyway
const UNDERGROUND_Y = -2;

/** Where each train is this frame; shared with the labels and the train dots. */
type Live = Map<
  string,
  { position: THREE.Vector3; state: TrainState; visible: boolean }
>;

/** Merge a Kenney car (body + wheel sets, one shared material) into one geometry in model space. */
function mergeCar(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  let material: THREE.MeshStandardMaterial | null = null;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    parts.push(m.geometry.clone().applyMatrix4(m.matrixWorld));
    material ??= m.material as THREE.MeshStandardMaterial;
  });
  const geometry = mergeGeometries(parts) ?? parts[0];
  geometry.computeBoundingBox();
  return { geometry, material: material! };
}

/** DMRC look: stainless body with a line-coloured band. Repaints the model's stripe palette cell. */
function stripeMaterial(base: THREE.MeshStandardMaterial, color: string) {
  const img = base.map!.image as CanvasImageSource & {
    width: number;
    height: number;
  };
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = [img.width, img.height];
  const g = canvas.getContext("2d")!;
  g.drawImage(img, 0, 0);
  g.fillStyle = color;
  // Stripe cell of Kenney's colormap: column 5 of 16, bottom row of 4 (docs/ASSETS.md).
  g.fillRect(
    (5 * img.width) / 16,
    (3 * img.height) / 4,
    img.width / 16,
    img.height / 4,
  );
  const map = new THREE.CanvasTexture(canvas);
  Object.assign(map, {
    flipY: base.map!.flipY,
    colorSpace: base.map!.colorSpace,
    magFilter: base.map!.magFilter,
    minFilter: base.map!.minFilter,
  });
  const m = base.clone();
  m.map = map;
  return m;
}

export function Trains({
  scene,
  service,
  colors,
  stationNames,
  near,
}: {
  scene: Scene3DData;
  service: Service;
  colors: Map<string, string>;
  stationNames: Map<string, string>;
  near: boolean;
}) {
  const models = useGLTF(CAR_MODELS);
  const cars = useMemo(() => models.map((m) => mergeCar(m.scene)), [models]);
  const lines = useMemo(() => [...colors.keys()], [colors]);
  const materials = useMemo(
    () =>
      new Map(
        lines.map((l) => [l, stripeMaterial(cars[0].material, colors.get(l)!)]),
      ),
    [lines, cars, colors],
  );
  const paths = useMemo(
    () => new Map(scene.paths.map((p) => [p.routeId, p])),
    [scene.paths],
  );
  const perLine = useMemo(() => {
    const n = new Map<string, number>();
    for (const t of service.trains) n.set(t.lineId, (n.get(t.lineId) ?? 0) + 1);
    return n;
  }, [service]);

  // Real DMRC car proportions from the middle car's model-space size (Kenney cars are toy-scaled).
  const scale = useMemo(() => {
    const s = cars[1].geometry.boundingBox!.getSize(new THREE.Vector3());
    return new THREE.Vector3(
      TRAIN.carWidth / s.x,
      TRAIN.carHeight / cars[1].geometry.boundingBox!.max.y,
      TRAIN.carLength / s.z,
    );
  }, [cars]);

  const meshes = useRef(new Map<string, (THREE.InstancedMesh | null)[]>());
  const dots = useRef<THREE.Points>(null);
  const live = useRef<Live>(new Map());
  const dotPositions = useMemo(
    () => new Float32Array(service.trains.length * 3),
    [service],
  );
  const dotColors = useMemo(() => {
    const c = new Float32Array(service.trains.length * 3);
    service.trains.forEach((t, i) =>
      new THREE.Color(colors.get(t.lineId)).toArray(c, i * 3),
    );
    return c;
  }, [service, colors]);

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );
  useFrame(({ controls }) => {
    const s = useMapStore.getState();
    const t = simSeconds(s);
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)
      ?.target;
    const counts = new Map<string, number[]>(lines.map((l) => [l, [0, 0, 0]]));
    let dot = 0;
    live.current.clear(); // hidden lines must not leave stale trains behind
    for (const train of service.trains) {
      if (s.hiddenLines.includes(train.lineId)) continue;
      const path = paths.get(train.routeId);
      if (!path) continue;
      const state = service.stateAt(train, t);
      const head = pointAt(path.points, path.km, state.km);
      const position = new THREE.Vector3(...head.position);
      const visible = position.y > UNDERGROUND_Y || !s.showGround;
      live.current.set(train.id, { position, state, visible });
      if (visible)
        dotPositions.set([position.x, position.y + 6, position.z], 3 * dot++);
      if (
        !near ||
        !visible ||
        !target ||
        position.distanceTo(target) > RENDER_RADIUS_M
      )
        continue;

      const end = path.km.at(-1)!;
      const c = counts.get(train.lineId)!;
      const lineMeshes = meshes.current.get(train.lineId);
      for (let j = 0; j < TRAIN.cars; j++) {
        // The train's km is its middle; car j's centre is (2.5 − j) car lengths ahead along its travel.
        const off = ((TRAIN.cars - 1) / 2 - j) * TRAIN.carLength;
        const at = pointAt(
          path.points,
          path.km,
          Math.min(end, Math.max(0, state.km + (state.dir * off) / 1000)),
        );
        const [fx, fz] = [
          Math.cos(at.yaw) * state.dir,
          -Math.sin(at.yaw) * state.dir,
        ];
        const type = j === 0 || j === TRAIN.cars - 1 ? 0 : j % 2 ? 1 : 2;
        const yaw = Math.atan2(fx, fz) + (j === TRAIN.cars - 1 ? Math.PI : 0);
        // Left-hand running: shift to the left of travel (left of (fx, fz) is (fz, −fx)).
        tmp.p.set(
          at.position[0] + fz * TRAIN.trackOffset,
          at.position[1] + STRUCTURE.railTop,
          at.position[2] - fx * TRAIN.trackOffset,
        );
        tmp.m.compose(tmp.p, tmp.q.setFromAxisAngle(tmp.up, yaw), scale);
        lineMeshes?.[type]?.setMatrixAt(c[type]++, tmp.m);
      }
    }
    for (const [lineId, c] of counts)
      meshes.current.get(lineId)?.forEach((mesh, i) => {
        if (!mesh) return;
        mesh.count = c[i];
        mesh.instanceMatrix.needsUpdate = true;
      });
    if (dots.current) {
      dots.current.geometry.setDrawRange(0, near ? 0 : dot);
      dots.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      {lines.map((lineId) =>
        cars.map((car, type) => (
          <instancedMesh
            key={`${lineId}-${type}`}
            ref={(m) => {
              const list = meshes.current.get(lineId) ?? [null, null, null];
              list[type] = m;
              meshes.current.set(lineId, list);
            }}
            // Capacity: every train of the line, 2 cars of each type per 6-car train.
            args={[
              car.geometry,
              materials.get(lineId)!,
              (perLine.get(lineId) ?? 0) * 2,
            ]}
            frustumCulled={false}
            castShadow
            receiveShadow
          />
        )),
      )}
      <points ref={dots} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[dotPositions, 3]}
          />
          <bufferAttribute attach="attributes-color" args={[dotColors, 3]} />
        </bufferGeometry>
        <pointsMaterial vertexColors size={6} sizeAttenuation={false} />
      </points>
      <TrainLabels
        live={live}
        colors={colors}
        stationNames={stationNames}
        near={near}
      />
    </>
  );
}

/** Floating tags like the reference's vehicle labels, for the nearest trains only. */
function TrainLabels({
  live,
  colors,
  stationNames,
  near,
}: {
  live: React.RefObject<Live>;
  colors: Map<string, string>;
  stationNames: Map<string, string>;
  near: boolean;
}) {
  const labels = useMapStore((s) => s.labels);
  const [shown, setShown] = useState<{ id: string; state: TrainState }[]>([]);
  const groups = useRef(new Map<string, THREE.Group | null>());
  const targetRef = useRef<THREE.Vector3 | null>(null);
  useFrame(({ controls }) => {
    targetRef.current =
      (controls as unknown as { target?: THREE.Vector3 } | null)?.target ??
      null;
    for (const [id, g] of groups.current) {
      const p = live.current.get(id)?.position;
      if (g && p) g.position.set(p.x, p.y + 9, p.z);
    }
  });
  // Re-pick the nearest trains twice a second (cheap; positions themselves update every frame).
  useEffect(() => {
    const pick = () => {
      const target = targetRef.current;
      if (!near || !target || (labels !== "trains" && labels !== "all"))
        return setShown([]);
      const near_ = [...live.current]
        .filter(
          ([, v]) =>
            v.visible && v.position.distanceTo(target) < TRAIN.labelRadiusM,
        )
        .sort(
          (a, b) =>
            a[1].position.distanceTo(target) - b[1].position.distanceTo(target),
        )
        .slice(0, TRAIN.maxLabels)
        .map(([id, v]) => ({ id, state: v.state }));
      setShown(near_);
    };
    pick();
    const timer = setInterval(pick, 500);
    return () => clearInterval(timer);
  }, [live, near, labels]);

  return shown.map(({ id, state }) => (
    <group key={id} ref={(g) => void groups.current.set(id, g)}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] whitespace-nowrap text-slate-800 shadow-md">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: colors.get(state.train.lineId) }}
          />
          <span className="font-semibold">{state.train.id}</span>
          <span
            className={
              state.atStationId ? "text-emerald-600" : "text-amber-600"
            }
          >
            {state.atStationId
              ? `At ${stationNames.get(state.atStationId)}`
              : `→ ${stationNames.get(state.nextStationId)}`}
          </span>
        </div>
      </Html>
    </group>
  ));
}

CAR_MODELS.forEach((u) => useGLTF.preload(u));
