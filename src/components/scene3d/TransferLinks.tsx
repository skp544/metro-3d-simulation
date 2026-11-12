import { Line } from "@react-three/drei";
import type { Network } from "../../data/loadNetwork";
import type { StationType } from "../../data/types";
import { useJourney } from "../../store/useJourney";
import { groundVisible, useMapStore } from "../../store/useMapStore";
import type { Scene3DData, V3 } from "./geometry";

/** Schematic walking connectors; these are overlays, never fabricated physical walkways. */
export function TransferLinks({ network, scene }: { network: Network; scene: Scene3DData }) {
  const hidden = useMapStore(s => s.hiddenLines);
  const hiddenTypes = useMapStore(s => s.hiddenStationTypes);
  const show = useMapStore(s => s.showStations);
  const ground = useMapStore(groundVisible);
  const journey = useJourney(network);
  if (!show) return null;
  const at = (id: string) => scene.stations.find(s => s.stationId === id && s.lineId && !hidden.includes(s.lineId) && !hiddenTypes.includes(s.stationType as StationType));
  return network.transfers.features.map(({ properties: t }) => {
    const a = at(t.fromStationId), b = at(t.toStationId);
    if (!a || !b) return null;
    const points = [a, b].map(s => [s.position[0], (ground ? Math.max(0, s.position[1]) : s.position[1]) + 3, s.position[2]] as V3);
    const used = journey?.walks.some(w => w.id === t.id);
    return <Line key={t.id} points={points} color={used ? "#b45309" : "#475569"} lineWidth={used ? 4 : 2} dashed dashSize={4} gapSize={4} depthTest={false} renderOrder={12} transparent opacity={journey && !used ? 0.3 : 1} />;
  });
}
