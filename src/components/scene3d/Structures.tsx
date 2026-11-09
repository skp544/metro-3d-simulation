import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../../constants/scene";
import { useMapStore } from "../../store/useMapStore";
import { buildStructures } from "./buildStructures";
import type { Scene3DData } from "./geometry";

/**
 * Viaduct deck + pillars wherever the track is above ground (ramps included), tunnel shells wherever it is
 * below, the coloured guideway (close up only; far away TrackLines draws it), and station boxes.
 * Everything is merged or instanced: about 7 draw calls for the whole network. Station boxes are clickable.
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
      {built.deck && (
        <mesh geometry={built.deck} castShadow receiveShadow>
          <meshLambertMaterial color={PALETTE.deck} flatShading side={THREE.DoubleSide} />
        </mesh>
      )}
      <Boxes matrices={built.pillars} color={PALETTE.pillar} />
      {/* Underground is hidden by the opaque ground; "X-ray" (ground off) reveals it. */}
      {built.tunnel && !showGround && (
        <mesh geometry={built.tunnel} renderOrder={2}>
          <meshLambertMaterial color={PALETTE.tunnel} transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {near && (
        <mesh geometry={built.ribbon} receiveShadow>
          <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      )}
      <Boxes matrices={built.aboveStations} colors={built.aboveColors} color="#ffffff" onClick={pick(built.aboveStationIds)} />
      {!showGround && <Boxes matrices={built.belowStations} color={PALETTE.stationBelow} opacity={0.55} onClick={pick(built.belowStationIds)} />}
    </>
  );
}

function Boxes({
  matrices,
  color,
  colors,
  opacity = 1,
  onClick,
}: {
  matrices: THREE.Matrix4[];
  color: string;
  colors?: THREE.Color[];
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
      <boxGeometry />
      <meshLambertMaterial color={color} flatShading transparent={!solid} opacity={opacity} depthWrite={solid} />
    </instancedMesh>
  );
}
