import { Fragment, useState } from "react";
import { Polyline, Tooltip, useMapEvents } from "react-leaflet";
import type { Network } from "../../data/loadNetwork";
import { useJourney } from "../../store/useJourney";
import { useMapStore } from "../../store/useMapStore";

/** Dashed schematic pedestrian links, distinct from real track geometry. */
export function TransferLayer({ network }: { network: Network }) {
  const hidden = useMapStore(s => s.hiddenLines);
  const hiddenTypes = useMapStore(s => s.hiddenStationTypes);
  const show = useMapStore(s => s.showStations);
  const selectStation = useMapStore(s => s.selectStation);
  const journey = useJourney(network);
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const [zoom, setZoom] = useState(() => map.getZoom());
  if (!show) return null;
  const stations = new Map(network.stations.features.map(f => [f.properties.id, f.properties]));
  const visible = (id: string) => {
    const s = stations.get(id)!;
    return !hiddenTypes.includes(s.stationType) && s.lines.some(l => !hidden.includes(l));
  };
  return network.transfers.features.filter(f => visible(f.properties.fromStationId) && visible(f.properties.toStationId)).map(f => {
    const t = f.properties;
    const used = journey?.walks.some(w => w.id === t.id);
    const positions = f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    const opacity = journey && !used ? 0.3 : 1;
    const label = zoom >= 15 && (!journey || used);
    return <Fragment key={t.id}>
      <Polyline positions={positions} interactive={false}
        pathOptions={{ color: "#ffffff", weight: used ? 10 : 8, opacity }} />
      <Polyline positions={positions}
        eventHandlers={{ click: () => selectStation(t.fromStationId) }}
        pathOptions={{ color: "#b45309", weight: used ? 5 : 4, dashArray: "6 7", opacity }}>
        <Tooltip key={String(label)} permanent={label} interactive eventHandlers={{ click: () => selectStation(t.fromStationId) }} direction="top" offset={[0, -6]}>
          <span title={`${stations.get(t.fromStationId)!.name} ↔ ${stations.get(t.toStationId)!.name}. ${t.note}`}>
            <b>🚶 Walk · ≈ {Math.round(t.walkSeconds / 60)} min (estimated)</b><br />
            {label ? "Schematic path · click for details" : `${stations.get(t.fromStationId)!.name} ↔ ${stations.get(t.toStationId)!.name} · schematic path`}
          </span>
        </Tooltip>
      </Polyline>
    </Fragment>;
  });
}
