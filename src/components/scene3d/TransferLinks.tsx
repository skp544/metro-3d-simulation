import { useState } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Network } from "../../data/loadNetwork";
import type { StationType } from "../../data/types";
import { useJourney } from "../../store/useJourney";
import { groundVisible, useMapStore } from "../../store/useMapStore";
import type { Scene3DData, V3 } from "./geometry";

/** Nearby-only label; first-frame deferral also avoids drei's initial Html mounting issue. */
function WalkLabel({ position, minutes, title, stationId }: { position: V3; minutes: number; title: string; stationId: string }) {
  const [near, setNear] = useState(false);
  const selectStation = useMapStore(s => s.selectStation);
  useFrame(({ camera }) => {
    const visible = Math.hypot(camera.position.x - position[0], camera.position.y - position[1], camera.position.z - position[2]) < 2200;
    if (visible !== near) setNear(visible);
  });
  if (!near) return null;
  return <Html position={position} center zIndexRange={[20, 0]}>
    <button type="button" title={title} onClick={() => selectStation(stationId)}
      className="rounded-lg border border-amber-300 bg-white/95 px-2 py-1 text-[11px] whitespace-nowrap text-amber-900 shadow-md hover:bg-amber-50">
      <span className="font-semibold">🚶 Walk · ≈ {minutes} min (estimated)</span>
      <span className="block text-[10px] text-slate-500">Schematic path · click for details</span>
    </button>
  </Html>;
}

/** Schematic walking connectors; these are overlays, never fabricated physical walkways. */
export function TransferLinks({ network, scene }: { network: Network; scene: Scene3DData }) {
  const hidden = useMapStore(s => s.hiddenLines);
  const hiddenTypes = useMapStore(s => s.hiddenStationTypes);
  const show = useMapStore(s => s.showStations);
  const ground = useMapStore(groundVisible);
  const journey = useJourney(network);
  if (!show) return null;
  const at = (id: string) => scene.stations.find(s => s.stationId === id && s.lineId && !hidden.includes(s.lineId) && !hiddenTypes.includes(s.stationType as StationType));
  return network.transfers.features.map(({ properties: t, geometry }) => {
    const a = at(t.fromStationId), b = at(t.toStationId);
    if (!a || !b) return null;
    // Use the same geographic path as Leaflet, through the shared projection. Height is schematic.
    const points = geometry.coordinates.map(([lng, lat], i, cs) => {
      const [x, z] = scene.projection.project([lng, lat]);
      const y = a.position[1] + (b.position[1] - a.position[1]) * i / (cs.length - 1);
      return [x, (ground ? Math.max(0, y) : y) + 3, z] as V3;
    });
    const used = journey?.walks.some(w => w.id === t.id);
    const opacity = journey && !used ? 0.3 : 1;
    const start = points[0], end = points.at(-1)!;
    const midpoint: V3 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + 20, (start[2] + end[2]) / 2];
    return <group key={t.id}>
      <Line points={points} color="#ffffff" lineWidth={used ? 10 : 8} depthTest={false} renderOrder={12} transparent opacity={opacity} />
      <Line points={points} color="#b45309" lineWidth={used ? 5 : 4} dashed dashSize={6} gapSize={7} depthTest={false} renderOrder={13} transparent opacity={opacity} />
      {(!journey || used) && <WalkLabel position={midpoint} minutes={Math.round(t.walkSeconds / 60)} title={t.note} stationId={t.fromStationId} />}
    </group>;
  });
}
