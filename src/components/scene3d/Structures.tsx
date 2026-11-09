import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../../constants/scene";
import { useMapStore } from "../../store/useMapStore";
import { buildStructures } from "./buildStructures";
import type { Scene3DData } from "./geometry";

/**
 * The metro's built structures, generic and nominal (DECISIONS #57):
 * - always: the concrete viaduct (deck slab with line-coloured edges, box girder, round piers with caps),
 *   tunnel shells in X-ray, and stations;
 * - close up only: parapets, the two tracks (concrete plinths or ballast, and rails). Far away, TrackLines
 *   draws the line colours instead.
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
          <Swept geometry={built.plinths} color={PALETTE.plinth} shadow={false} />
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
      {!showGround && <Instances matrices={built.belowStations} color={PALETTE.stationBelow} opacity={0.55} onClick={pick(built.belowStationIds)} />}
    </>
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
