import { Polyline, Tooltip } from "react-leaflet";
import type { Network } from "../../data/loadNetwork";
import { useJourney } from "../../store/useJourney";
import { useMapStore } from "../../store/useMapStore";

/** Dashed schematic pedestrian links, distinct from real track geometry. */
export function TransferLayer({ network }: { network: Network }) {
  const hidden = useMapStore(s => s.hiddenLines);
  const hiddenTypes = useMapStore(s => s.hiddenStationTypes);
  const show = useMapStore(s => s.showStations);
  const journey = useJourney(network);
  if (!show) return null;
  const stations = new Map(network.stations.features.map(f => [f.properties.id, f.properties]));
  const visible = (id: string) => {
    const s = stations.get(id)!;
    return !hiddenTypes.includes(s.stationType) && s.lines.some(l => !hidden.includes(l));
  };
  return network.transfers.features.filter(f => visible(f.properties.fromStationId) && visible(f.properties.toStationId)).map(f => {
    const t = f.properties;
    const used = journey?.walks.some(w => w.id === t.id);
    return <Polyline key={t.id} positions={f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
      pathOptions={{ color: used ? "#b45309" : "#475569", weight: used ? 5 : 2.5, dashArray: "4 5", opacity: journey && !used ? 0.3 : 1 }}>
      <Tooltip>Walk: {stations.get(t.fromStationId)!.name} ↔ {stations.get(t.toStationId)!.name}<br />≈ {Math.round(t.walkSeconds / 60)} min (estimated). Schematic connection.</Tooltip>
    </Polyline>;
  });
}
