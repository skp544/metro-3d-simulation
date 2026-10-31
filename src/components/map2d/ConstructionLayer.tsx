import { Polyline, Tooltip } from "react-leaflet";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";

// Phase 4 corridors: OSM construction ways. Line unknown (lineId is null), so drawn neutral grey.
export function ConstructionLayer({ network }: { network: Network }) {
  const show = useMapStore((s) => s.showConstruction);
  if (!show) return null;
  return network.construction.features.map((f) => (
    <Polyline
      key={f.properties.id}
      pane="construction"
      positions={f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
      pathOptions={{ color: "#64748b", weight: 4, dashArray: "4 8", opacity: 0.8 }}
    >
      <Tooltip sticky>
        <div className="text-xs">
          <div className="font-semibold">Under construction</div>
          <div>{f.properties.name ?? "Unnamed corridor"}</div>
          <div>{f.properties.lengthKm.toFixed(2)} km</div>
        </div>
      </Tooltip>
    </Polyline>
  ));
}
