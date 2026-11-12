import { CircleMarker, Polygon, Tooltip } from "react-leaflet";
import { PLACE_CATEGORIES } from "../../constants/places";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import { showLandmark } from "../../store/showLandmark";

export function LandmarkLayer({ network }: { network: Network }) {
  const selected = useMapStore(s => s.selectedLandmarkId);
  return network.landmarks.features.map(f => {
    const category = PLACE_CATEGORIES[f.properties.category];
    return <CircleMarker key={f.properties.id} center={[f.geometry.coordinates[1], f.geometry.coordinates[0]]} radius={7} pathOptions={{ color: category.color, weight: 2, fillColor: category.fill, fillOpacity: 1 }} eventHandlers={{ click: () => showLandmark(f) }}>
      <Tooltip direction="top">{f.properties.name} · {category.label}</Tooltip>
      {selected === f.properties.id && f.properties.footprintParts.length > 0 && <Polygon positions={f.properties.footprintParts.map(p => [p.outer, ...p.holes].map(r => r.map(([lng, lat]) => [lat, lng] as [number, number])))} pathOptions={{ color: category.color, weight: 2, fillOpacity: .15 }} />}
    </CircleMarker>;
  });
}
