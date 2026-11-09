import { useMemo } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import type { Network } from "../../data/loadNetwork";
import { useJourney } from "../../store/useJourney";
import { useMapStore } from "../../store/useMapStore";

export function StationLayer({ network }: { network: Network }) {
  const show = useMapStore((s) => s.showStations);
  const hiddenLines = useMapStore((s) => s.hiddenLines);
  const hiddenTypes = useMapStore((s) => s.hiddenStationTypes);
  const selectStation = useMapStore((s) => s.selectStation);
  // While a route is highlighted, stations off the route step back.
  const journey = useJourney(network);
  const onRoute = useMemo(() => (journey ? new Set(journey.legs.flatMap((l) => l.stationIds)) : null), [journey]);
  const lines = useMemo(() => new Map(network.lines.features.map((f) => [f.properties.id, f.properties])), [network.lines]);
  if (!show) return null;

  // Interchanges last so they draw on top of ordinary stations.
  const visible = network.stations.features
    .filter((f) => !hiddenTypes.includes(f.properties.stationType) && f.properties.lines.some((l) => !hiddenLines.includes(l)))
    .sort((a, b) => Number(a.properties.isInterchange) - Number(b.properties.isInterchange));

  return visible.map((f) => {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    return (
      <CircleMarker
        key={p.id}
        eventHandlers={{ click: () => selectStation(p.id) }}
        pane="stations"
        center={[lat, lng]}
        radius={p.isInterchange ? 7 : 4.5}
        pathOptions={{
          color: p.isInterchange ? "#111827" : (lines.get(p.lines[0])?.color ?? "#111827"),
          weight: p.isInterchange ? 3 : 2.5,
          fillColor: "#ffffff",
          fillOpacity: 1,
          opacity: onRoute && !onRoute.has(p.id) ? 0.3 : 1,
        }}
      >
        <Tooltip direction="top" offset={[0, -6]}>
          {p.name}
        </Tooltip>
      </CircleMarker>
    );
  });
}
