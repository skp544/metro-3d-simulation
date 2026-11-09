import { useMemo } from "react";
import { CircleMarker, Polyline, Tooltip } from "react-leaflet";
import type { Network } from "../../data/loadNetwork";
import { useJourney } from "../../store/useJourney";

const latLngs = (cs: number[][]) => cs.map(([lng, lat]) => [lat, lng] as [number, number]);

/** The planned journey on the 2D map: the real segments it uses, cased in white, with start, change and end stops. */
export function RouteLayer({ network }: { network: Network }) {
  const journey = useJourney(network);
  const segments = useMemo(() => new Map(network.segments.features.map((f) => [f.properties.id, f])), [network.segments]);
  const stations = useMemo(() => new Map(network.stations.features.map((f) => [f.properties.id, f])), [network.stations]);
  const colors = useMemo(() => new Map(network.lines.features.map((f) => [f.properties.id, f.properties.color])), [network.lines]);
  if (!journey) return null;

  const pieces = journey.legs.flatMap((leg) => leg.segmentIds.map((id) => ({ id, color: colors.get(leg.lineId), coords: latLngs(segments.get(id)!.geometry.coordinates) })));
  const stops = [
    { id: journey.fromId, label: "From" },
    ...journey.legs.slice(1).map((l) => ({ id: l.stationIds[0], label: "Change" })),
    { id: journey.toId, label: "To" },
  ];
  return (
    <>
      {pieces.map((p) => (
        <Polyline key={`c-${p.id}`} pane="route" positions={p.coords} interactive={false} pathOptions={{ color: "#ffffff", weight: 13, opacity: 1, lineCap: "round", lineJoin: "round" }} />
      ))}
      {pieces.map((p) => (
        <Polyline key={p.id} pane="route" positions={p.coords} interactive={false} pathOptions={{ color: p.color, weight: 8, opacity: 1, lineCap: "round", lineJoin: "round" }} />
      ))}
      {stops.map((s, i) => {
        const [lng, lat] = stations.get(s.id)!.geometry.coordinates;
        return (
          <CircleMarker key={`${s.id}-${i}`} pane="route" center={[lat, lng]} radius={8} interactive={false} pathOptions={{ color: "#0f172a", weight: 3, fillColor: "#ffffff", fillOpacity: 1 }}>
            <Tooltip permanent direction="top" offset={[0, -8]}>
              <span className="text-xs">
                <b>{s.label}:</b> {stations.get(s.id)!.properties.name}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
