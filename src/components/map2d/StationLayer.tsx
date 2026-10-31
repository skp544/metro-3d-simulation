import { useMemo } from "react";
import { CircleMarker, Popup, Tooltip } from "react-leaflet";
import { STATION_TYPE_LABEL, TRACK_STYLE } from "../../constants/map";
import type { Network } from "../../data/loadNetwork";
import type { LineProps, StationProps } from "../../data/types";
import { useMapStore } from "../../store/useMapStore";

export function StationLayer({ network }: { network: Network }) {
  const show = useMapStore((s) => s.showStations);
  const hiddenLines = useMapStore((s) => s.hiddenLines);
  const hiddenTypes = useMapStore((s) => s.hiddenStationTypes);
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
        pane="stations"
        center={[lat, lng]}
        radius={p.isInterchange ? 7 : 4.5}
        pathOptions={{
          color: p.isInterchange ? "#111827" : (lines.get(p.lines[0])?.color ?? "#111827"),
          weight: p.isInterchange ? 3 : 2.5,
          fillColor: "#ffffff",
          fillOpacity: 1,
        }}
      >
        <Tooltip direction="top" offset={[0, -6]}>
          {p.name}
        </Tooltip>
        <Popup maxWidth={320}>
          <StationDetails station={p} lines={lines} />
        </Popup>
      </CircleMarker>
    );
  });
}

const osmLink = (src: string) => {
  const m = /^osm:(node|way|relation)\/(\d+)$/.exec(src);
  return m ? `https://www.openstreetmap.org/${m[1]}/${m[2]}` : null;
};

function StationDetails({ station: p, lines }: { station: StationProps; lines: Map<string, LineProps> }) {
  return (
    <div className="space-y-2 text-xs text-slate-700">
      <div>
        <div className="text-sm font-semibold text-slate-900">{p.name}</div>
        {p.name_hi && <div className="text-slate-500">{p.name_hi}</div>}
      </div>
      <div className="flex flex-wrap gap-1">
        {p.lines.map((id) => (
          <span key={id} className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: lines.get(id)?.color }}>
            {lines.get(id)?.name}
          </span>
        ))}
        {p.isInterchange && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">Interchange</span>}
      </div>
      <div>
        <span className="font-medium">Type:</span> {STATION_TYPE_LABEL[p.stationType]}
        {p.refs.length > 0 && <span className="text-slate-500"> · code {p.refs.join(", ")}</span>}
      </div>
      <table className="w-full text-left">
        <thead className="text-slate-500">
          <tr>
            <th className="font-normal">Platform</th>
            <th className="font-normal">Level</th>
            <th className="font-normal">Wikipedia</th>
          </tr>
        </thead>
        <tbody>
          {p.platforms.map((pl) => (
            <tr key={pl.lineId}>
              <td>{lines.get(pl.lineId)?.name}</td>
              <td title={`source: ${pl.trackTypeSource}`}>{TRACK_STYLE[pl.trackType].label}</td>
              <td>{pl.wikipediaLayout ? TRACK_STYLE[pl.wikipediaLayout].label : "not found"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-1">
        <Badge ok={p.verified}>{p.verified ? "Verified (OSM + Wikipedia)" : "Not verified"}</Badge>
        {p.estimated && <Badge ok={false}>Position estimated</Badge>}
      </div>
      {p.conflicts.length > 0 && (
        <ul className="list-disc rounded bg-amber-50 py-1 pr-1 pl-4 text-amber-900">
          {p.conflicts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <details>
        <summary className="cursor-pointer text-slate-500">Sources ({p.source.length})</summary>
        <ul className="mt-1 max-h-24 overflow-auto">
          {p.source.map((s) => {
            const href = osmLink(s);
            return <li key={s}>{href ? <a href={href} target="_blank" rel="noreferrer">{s}</a> : s}</li>;
          })}
        </ul>
      </details>
    </div>
  );
}

const Badge = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span className={`rounded px-1.5 py-0.5 text-[11px] ${ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{children}</span>
);
