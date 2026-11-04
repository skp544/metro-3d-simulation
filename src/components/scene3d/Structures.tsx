import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "../../constants/scene";
import { useMapStore } from "../../store/useMapStore";
import { buildStructures } from "./buildStructures";
import type { Scene3DData } from "./geometry";

/**
 * Viaduct deck + pillars wherever the track is above ground (ramps included), tunnel shells wherever it is
 * below, the coloured track ribbon (close up only; far away TrackLines draws it), and station boxes.
 * Everything is merged or instanced: about 7 draw calls for the whole network.
 */
export function Structures({ scene, colors, near }: { scene: Scene3DData; colors: Map<string, string>; near: boolean }) {
  const hiddenLines = useMapStore((s) => s.hiddenLines);
  const hiddenTrackTypes = useMapStore((s) => s.hiddenTrackTypes);
  const hiddenStationTypes = useMapStore((s) => s.hiddenStationTypes);
  const showStations = useMapStore((s) => s.showStations);
  const built = useMemo(
    () => buildStructures(scene, colors, { hiddenLines, hiddenTrackTypes, hiddenStationTypes, showStations }),
    [scene, colors, hiddenLines, hiddenTrackTypes, hiddenStationTypes, showStations],
  );

  return (
    <>
      {built.deck && (
        <mesh geometry={built.deck}>
          <meshStandardMaterial color={COLORS.deck} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Boxes matrices={built.pillars} color={COLORS.pillar} />
      {built.tunnel && (
        <mesh geometry={built.tunnel} renderOrder={2}>
          <meshStandardMaterial color={COLORS.tunnel} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {near && (
        <mesh geometry={built.ribbon}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      )}
      <Boxes matrices={built.aboveStations} colors={built.aboveColors} color="#ffffff" />
      <Boxes matrices={built.belowStations} color={COLORS.stationBelow} opacity={0.55} />
    </>
  );
}

function Boxes({ matrices, color, colors, opacity = 1 }: { matrices: THREE.Matrix4[]; color: string; colors?: THREE.Color[]; opacity?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    colors?.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices, colors]);
  if (!matrices.length) return null;
  return (
    // key: the instance count is fixed at creation, so a new count needs a new mesh.
    <instancedMesh key={matrices.length} ref={ref} args={[undefined, undefined, matrices.length]} frustumCulled={false} renderOrder={opacity < 1 ? 2 : 0}>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.85} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
    </instancedMesh>
  );
}
