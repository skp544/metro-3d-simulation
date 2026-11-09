import { useMemo } from "react";
import { Polyline, Tooltip } from "react-leaflet";
import { TRACK_ORDER, TRACK_STYLE } from "../../constants/map";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";

const latLngs = (cs: number[][]) => cs.map(([lng, lat]) => [lat, lng] as [number, number]);

export function SegmentLayer({ network }: { network: Network }) {
  const hiddenLines = useMapStore((s) => s.hiddenLines);
  const hiddenTypes = useMapStore((s) => s.hiddenTrackTypes);
  // While a route is highlighted, the rest of the network steps back.
  const dim = useMapStore((s) => !!(s.routeFrom && s.routeTo));
  const lines = useMemo(() => new Map(network.lines.features.map((f) => [f.properties.id, f.properties])), [network.lines]);
  const stationName = useMemo(() => new Map(network.stations.features.map((f) => [f.properties.id, f.properties.name])), [network.stations]);

  const visible = network.segments.features
    .filter((f) => !hiddenLines.includes(f.properties.lineId) && !hiddenTypes.includes(f.properties.trackType))
    .sort((a, b) => TRACK_ORDER.indexOf(a.properties.trackType) - TRACK_ORDER.indexOf(b.properties.trackType));

  return visible.map((f) => {
    const p = f.properties;
    const style = TRACK_STYLE[p.trackType];
    return (
      <Polyline
        key={p.id}
        pane="track"
        positions={latLngs(f.geometry.coordinates)}
        pathOptions={{ color: lines.get(p.lineId)?.color, weight: style.weight, opacity: style.opacity * (dim ? 0.35 : 1), dashArray: style.dashArray, lineCap: p.trackType === "at_grade" ? "round" : "butt" }}
      >
        <Tooltip sticky>
          <div className="text-xs">
            <div className="font-semibold">{lines.get(p.lineId)?.name}</div>
            <div>
              {stationName.get(p.fromStationId)} → {stationName.get(p.toStationId)}
            </div>
            <div>
              {style.label} · {p.lengthKm.toFixed(2)} km{p.estimated && " · type estimated (untagged in OSM)"}
            </div>
          </div>
        </Tooltip>
      </Polyline>
    );
  });
}
