import { CircleMarker, Polygon, Tooltip } from "react-leaflet";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import { showLandmark } from "../../store/showLandmark";

export function LandmarkLayer({ network }: { network: Network }) {
  const selected = useMapStore(s => s.selectedLandmarkId);
  return network.landmarks.features.map(f => <CircleMarker key={f.properties.id} center={[f.geometry.coordinates[1], f.geometry.coordinates[0]]} radius={7} pathOptions={{ color: "#92400e", weight: 2, fillColor: "#fef3c7", fillOpacity: 1 }} eventHandlers={{ click: () => showLandmark(f) }}>
    <Tooltip direction="top">{f.properties.name} · landmark</Tooltip>
    {selected === f.properties.id && f.properties.footprint.length > 0 && <Polygon positions={[f.properties.footprint, ...(f.properties.footprintHoles ?? [])].map(r => r.map(([lng, lat]) => [lat, lng] as [number, number]))} pathOptions={{ color: "#92400e", weight: 2, fillOpacity: .15 }} />}
  </CircleMarker>);
}
