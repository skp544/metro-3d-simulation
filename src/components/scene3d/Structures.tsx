import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE, STRUCTURE } from "../../constants/scene";
import { useMapStore } from "../../store/useMapStore";
import { buildStructures, sleeperMatrices, stationDetailParts } from "./buildStructures";
import type { Scene3DData } from "./geometry";

/**
 * The metro's built structures, generic and nominal (DECISIONS #57):
 * - always: the concrete viaduct (deck slab with line-coloured edges, box girder, round piers with caps),
 *   tunnel shells in X-ray, and stations;
 * - close up only: parapets, the two tracks (concrete bed or ballast, sleepers near the view, rails). Far
 *   away, TrackLines draws the line colours instead.
 * Above-ground stations have side platforms, an open gabled glazed roof on columns and a concourse below.
 * Everything is merged or instanced (about 20 draw calls for the whole network); station parts are clickable.
 */
export function Structures({ scene, colors, near }: { scene: Scene3DData; colors: Map<string, string>; near: boolean }) {
  const hiddenLines = useMapStore((s) => s.hiddenLines);
  const hiddenTrackTypes = useMapStore((s) => s.hiddenTrackTypes);
  const hiddenStationTypes = useMapStore((s) => s.hiddenStationTypes);
  const showStations = useMapStore((s) => s.showStations);
  const showGround = useMapStore((s) => s.showGround);
  const selectStation = useMapStore((s) => s.selectStation);
  const built = useMemo(
    () => buildStructures(scene, colors, { hiddenLines, hiddenTrackTypes, hiddenStationTypes, showStations }),
    [scene, colors, hiddenLines, hiddenTrackTypes, hiddenStationTypes, showStations],
  );
  const pick = (ids: string[]) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) selectStation(ids[e.instanceId]);
  };

  return (
    <>
      <Swept geometry={built.deck} color={PALETTE.deck} />
      <Swept geometry={built.deckEdges} vertexColors />
      <Swept geometry={built.girder} color={PALETTE.deck} />
      <Instances matrices={built.piers} color={PALETTE.pillar} shape="cylinder" />
      <Instances matrices={built.pierCaps} color={PALETTE.pillar} />
      {near && (
        <>
          <Swept geometry={built.parapets} color={PALETTE.deck} />
          <Swept geometry={built.ballast} color={PALETTE.ballast} shadow={false} />
          <Swept geometry={built.trackBed} color={PALETTE.plinth} shadow={false} />
          <Sleepers tracks={built.tracks} />
          <Swept geometry={built.rails} color={PALETTE.rail} shadow={false} />
        </>
      )}
      {/* Underground is hidden by the opaque ground; "X-ray" (ground off) reveals it. */}
      {built.tunnel && !showGround && (
        <mesh geometry={built.tunnel} renderOrder={2}>
          <meshLambertMaterial color={PALETTE.tunnel} transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {built.aboveParts.map((p) => (
        <Instances key={p.key} matrices={p.matrices} colors={p.colors} color={p.color} shape={p.shape} opacity={p.opacity} onClick={pick(p.ids)} />
      ))}
      {near && <StationDetails stations={built.circulationStations} />}
      {!showGround && <Instances matrices={built.belowStations} color={PALETTE.stationBelow} opacity={0.55} onClick={pick(built.belowStationIds)} />}
    </>
  );
}

function StationDetails({ stations }: { stations: Scene3DData["stations"] }) {
  const [nearby, setNearby] = useState<Scene3DData["stations"]>([]);
  const last = useRef({ time: 0, key: "" });
  useFrame(({ camera, controls }) => {
    if (performance.now() - last.current.time < 300) return;
    last.current.time = performance.now();
    const target = (controls as unknown as { target?: THREE.Vector3 })?.target;
    const next = target && camera.position.distanceTo(target) < 1400 ? stations.filter(s => Math.hypot(s.position[0] - target.x, s.position[2] - target.z) < 700).sort((a,b) => Math.hypot(a.position[0]-target.x,a.position[2]-target.z) - Math.hypot(b.position[0]-target.x,b.position[2]-target.z)).slice(0, 6) : [];
    const key = next.map(s => `${s.stationId}:${s.lineId}`).join();
    if (key !== last.current.key) { last.current.key = key; setNearby(next); }
  });
  // Filters can change without a camera move. Never retain details for a hidden platform.
  const parts = useMemo(() => stationDetailParts(nearby.filter(s => stations.includes(s))), [nearby, stations]);
  return parts.map(p => <Instances key={p.key} matrices={p.matrices} color={p.color} opacity={p.opacity} />);
}

const SLEEPER_CAPACITY = 40_000;
const SLEEPER_REFRESH_M = 200; // re-place when the view target has moved this far
const SLEEPER_MAX_DISTANCE_M = 1200; // camera further than this: sleepers are sub-pixel, skip them

/**
 * Concrete sleepers under the rails, every 0.65 m, but only within STRUCTURE.sleeper.radius of the view
 * target: about 2,800 per km of route, so the whole network would need over a million. One instanced mesh,
 * refilled as the view moves.
 */
function Sleepers({ tracks }: { tracks: [number, number, number][][] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const placedAt = useRef<{ x: number; z: number; tracks: unknown } | null>(null);
  useLayoutEffect(() => void (ref.current && (ref.current.count = 0)), []); // empty until the first placement
  useFrame(({ camera, controls }) => {
    const mesh = ref.current;
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    if (!mesh || !target) return;
    mesh.visible = camera.position.distanceTo(target) < SLEEPER_MAX_DISTANCE_M;
    const last = placedAt.current;
    if (!mesh.visible || (last && last.tracks === tracks && Math.hypot(target.x - last.x, target.z - last.z) < SLEEPER_REFRESH_M)) return;
    const ms = sleeperMatrices(tracks, [target.x, target.z], STRUCTURE.sleeper.radius, STRUCTURE.sleeper.spacing, SLEEPER_CAPACITY);
    ms.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.count = ms.length;
    mesh.instanceMatrix.needsUpdate = true;
    placedAt.current = { x: target.x, z: target.z, tracks };
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, SLEEPER_CAPACITY]} receiveShadow frustumCulled={false}>
      <boxGeometry />
      <meshLambertMaterial color={PALETTE.sleeper} flatShading />
    </instancedMesh>
  );
}

/** A merged swept geometry (deck, rails, …) in one colour, or in its per-vertex line colours. */
function Swept({ geometry, color, vertexColors = false, shadow = true }: { geometry: THREE.BufferGeometry | null; color?: string; vertexColors?: boolean; shadow?: boolean }) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow={shadow} receiveShadow>
      <meshLambertMaterial color={color} vertexColors={vertexColors} flatShading side={THREE.DoubleSide} />
    </mesh>
  );
}

function Instances({
  matrices,
  color,
  colors,
  shape = "box",
  opacity = 1,
  onClick,
}: {
  matrices: THREE.Matrix4[];
  color: string;
  colors?: THREE.Color[];
  shape?: "box" | "cylinder";
  opacity?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    colors?.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere(); // needed for picking and culling across instances
  }, [matrices, colors]);
  if (!matrices.length) return null;
  const solid = opacity === 1;
  return (
    // key: the instance count is fixed at creation, so a new count needs a new mesh.
    <instancedMesh
      key={matrices.length}
      ref={ref}
      args={[undefined, undefined, matrices.length]}
      castShadow={solid}
      receiveShadow={solid}
      renderOrder={solid ? 0 : 2}
      onClick={onClick}
      onPointerOver={onClick && (() => (document.body.style.cursor = "pointer"))}
      onPointerOut={onClick && (() => (document.body.style.cursor = ""))}
    >
      {/* Unit sizes: the instance matrix scales them (a cylinder of diameter 1, eight flat-shaded sides, open ends: the cap and the ground hide them). */}
      {shape === "cylinder" ? <cylinderGeometry args={[0.5, 0.5, 1, 8, 1, true]} /> : <boxGeometry />}
      <meshLambertMaterial color={color} flatShading transparent={!solid} opacity={opacity} depthWrite={solid} />
    </instancedMesh>
  );
}
