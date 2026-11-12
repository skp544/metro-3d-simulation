import { useMemo } from "react";
import { STATION_TYPE_LABEL, TRACK_STYLE } from "../../constants/map";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import { useSimNow } from "../../store/useSimNow";
import type { Service } from "../../utils/trainSim";
import { TrainSpeedLimit } from "./TrainSpeed";

/** Right-hand detail panel for the selected station, like the reference's hub panel. */
export function StationPanel({ network, service }: { network: Network; service: Service }) {
  const id = useMapStore((s) => s.selectedStationId);
  const selectStation = useMapStore((s) => s.selectStation);
  const now = useSimNow(1000);
  const lines = useMemo(() => new Map(network.lines.features.map((f) => [f.properties.id, f.properties])), [network.lines]);
  const names = useMemo(() => new Map(network.stations.features.map((f) => [f.properties.id, f.properties.name])), [network.stations]);
  const station = useMemo(() => network.stations.features.find((f) => f.properties.id === id)?.properties, [network.stations, id]);
  if (!station) return null;
  const arrivals = service.nextArrivals(station.id, now).slice(0, 8);
  const walks = network.transfers.features.filter(f => f.properties.fromStationId === station.id || f.properties.toStationId === station.id);

  return (
    <aside className="pointer-events-auto max-h-full w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur" aria-label={`${station.name} details`}>
      <header className="flex items-start gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-wide text-blue-700 uppercase">
            {station.isInterchange ? "Interchange" : walks.length ? "Walking interchange" : "Station"}
            {station.refs.length > 0 && ` · ${station.refs.join(", ")}`}
          </div>
          <h2 className="truncate text-base font-semibold text-slate-900">{station.name}</h2>
          {station.name_hi && <div className="text-xs text-slate-500">{station.name_hi}</div>}
        </div>
        <button type="button" onClick={() => selectStation(null)} aria-label="Close station details" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          ✕
        </button>
      </header>

      <div className="flex flex-wrap gap-1 px-4">
        {station.lines.map((l) => (
          <span key={l} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: lines.get(l)?.color, color: textOn(lines.get(l)?.color) }}>
            {lines.get(l)?.name}
          </span>
        ))}
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${station.verified ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {station.verified ? "Verified" : "Not verified"}
        </span>
      </div>

      <div className="flex gap-2 px-4 pt-3">
        <RouteButton end="from" stationId={station.id} />
        <RouteButton end="to" stationId={station.id} />
      </div>

      <div className="grid grid-cols-2 gap-2 p-4">
        <Stat label="Type" value={STATION_TYPE_LABEL[station.stationType]} />
        <Stat label="Lines" value={String(station.lines.length)} />
      </div>

      <section className="border-t border-slate-100 px-4 py-3">
        {walks.length > 0 && <div className="mb-3 space-y-2">
          <h3 className="text-xs font-semibold text-slate-800">Walking connections</h3>
          {walks.map(({ properties: t }) => {
            const other = t.fromStationId === station.id ? t.toStationId : t.fromStationId;
            return <div key={t.id} className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900">
              <button type="button" onClick={() => selectStation(other)} className="font-semibold underline">{names.get(other)}</button> · ≈ {Math.round(t.walkSeconds / 60)} min walk (estimated)
              <p className="mt-1">{t.note}</p>
            </div>;
          })}
        </div>}
        <h3 className="mb-1.5 text-xs font-semibold text-slate-800">
          Next trains <span className="font-normal text-slate-400">· simulated</span>
        </h3>
        <ul className="space-y-1">
          {arrivals.map((a) => (
            <li key={`${a.routeId}-${a.terminusId}`} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lines.get(a.lineId)?.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-700">→ {names.get(a.terminusId)}</span>
              <span className="text-[11px] text-slate-400">{a.trainId}</span>
              <span className="w-12 text-right font-medium text-slate-900 tabular-nums">{a.inS < 30 ? "Now" : `${Math.round(a.inS / 60)} min`}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-slate-100 px-4 py-3">
        <h3 className="mb-1.5 text-xs font-semibold text-slate-800">Platforms</h3>
        <ul className="mb-2 space-y-1">
          {station.lines.map(lineId => <li key={lineId} className="text-[11px] text-slate-600">
            {lines.get(lineId)?.name}: <TrainSpeedLimit lineId={lineId} showDesign />
          </li>)}
        </ul>
        <table className="w-full text-left text-xs">
          <tbody>
            {station.platforms.map((p) => (
              <tr key={p.lineId}>
                <td className="py-0.5 text-slate-700">{lines.get(p.lineId)?.name}</td>
                <td className="py-0.5 text-slate-600" title={`source: ${p.trackTypeSource}`}>
                  {TRACK_STYLE[p.trackType].label}
                </td>
                <td className="py-0.5 text-right text-[11px] text-slate-400">{p.wikipediaLayout ? `Wikipedia: ${TRACK_STYLE[p.wikipediaLayout].label}` : "no 2nd source"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {station.conflicts.length > 0 && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">{station.conflicts.join(" · ")}</p>}
        <details className="mt-2 text-[11px] text-slate-500">
          <summary className="cursor-pointer">Sources ({station.source.length})</summary>
          <ul className="mt-1 max-h-24 overflow-auto">
            {station.source.map((src) => {
              const m = /^osm:(node|way|relation)\/(\d+)$/.exec(src);
              return <li key={src}>{m ? <a className="text-blue-600 hover:underline" href={`https://www.openstreetmap.org/${m[1]}/${m[2]}`} target="_blank" rel="noreferrer">{src}</a> : src}</li>;
            })}
          </ul>
        </details>
      </section>
    </aside>
  );
}

/** Sets this station as the route's start or end; pressed when it already is. */
function RouteButton({ end, stationId }: { end: "from" | "to"; stationId: string }) {
  const current = useMapStore((s) => (end === "from" ? s.routeFrom : s.routeTo));
  const setRouteEnd = useMapStore((s) => s.setRouteEnd);
  const on = current === stationId;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setRouteEnd(end, on ? null : stationId)}
      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
    >
      {end === "from" ? "Route from here" : "Route to here"}
    </button>
  );
}

// Readable chip text on any line colour (Yellow needs dark text): WCAG relative luminance.
function textOn(hex = "#000000") {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#0f172a" : "#ffffff";
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
    <div className="text-[11px] text-slate-500">{label}</div>
    <div className="text-sm font-semibold text-slate-900">{value}</div>
  </div>
);
