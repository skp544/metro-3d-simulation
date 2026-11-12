import { useEffect, useMemo } from "react";
import type { Network } from "../../data/loadNetwork";
import { useJourney } from "../../store/useJourney";
import { useMapStore } from "../../store/useMapStore";
import { TRANSFER_S } from "../../utils/routePlanner";

/**
 * Route between two stations, picked from the station panel ("From here" / "To here"). Shows the legs and
 * changes, and fits both views to the route. Times are estimates from the simulation's nominal speeds.
 */
export function RoutePanel({ network }: { network: Network }) {
  const from = useMapStore((s) => s.routeFrom);
  const to = useMapStore((s) => s.routeTo);
  const { setRouteEnd, swapRoute, fitTo } = useMapStore.getState();
  const journey = useJourney(network);
  const stations = useMemo(() => new Map(network.stations.features.map((f) => [f.properties.id, f])), [network.stations]);
  const lines = useMemo(() => new Map(network.lines.features.map((f) => [f.properties.id, f.properties])), [network.lines]);

  // Frame each new route once, in whichever view is showing.
  useEffect(() => {
    if (!journey) return;
    const ids = [...journey.legs.flatMap(l => l.stationIds), journey.fromId, journey.toId, ...journey.walks.flatMap(w => [w.fromStationId, w.toStationId])];
    const pts = ids.map(id => stations.get(id)!.geometry.coordinates);
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    fitTo([
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ]);
  }, [journey, stations, fitTo]);

  if (!from && !to) return null;
  const name = (id: string) => stations.get(id)?.properties.name ?? id;
  const end = (label: string, id: string | null) => (
    <div key={label} className="flex items-center gap-2 text-xs">
      <span className="w-9 shrink-0 text-[11px] text-slate-500">{label}</span>
      {id ? <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{name(id)}</span> : <span className="flex-1 text-slate-400 italic">pick a station, then “{label} here”</span>}
    </div>
  );

  return (
    <section className="pointer-events-auto w-full max-w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur" aria-label="Route between two stations">
      <header className="flex items-center justify-between gap-2 px-4 pt-2.5 pb-1">
        <h2 className="text-sm font-semibold text-slate-900">Route</h2>
        <div className="flex gap-1">
          <button type="button" onClick={swapRoute} className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100" aria-label="Swap start and end">
            ⇅
          </button>
          <button
            type="button"
            onClick={() => {
              setRouteEnd("from", null);
              setRouteEnd("to", null);
            }}
            className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Clear
          </button>
        </div>
      </header>
      <div className="space-y-1 px-4 pb-2">
        {end("From", from)}
        {end("To", to)}
      </div>

      {from && to && !journey && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{from === to ? "Start and end are the same station." : "No route found."}</p>}

      {journey && (
        <div className="max-h-[calc(100dvh-24rem)] overflow-y-auto border-t border-slate-100 px-4 py-2">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 text-xs text-slate-600">
            <span className="text-base font-semibold text-slate-900">≈ {Math.round(journey.timeS / 60)} min</span>
            {journey.legs.length > 0 ? <>
              <span>{journey.stops} stops</span>
              <span>{journey.km.toFixed(1)} {journey.walks.length ? "rail km" : "km"}</span>
              <span>{journey.transfers === 0 ? "no change" : `${journey.transfers} change${journey.transfers > 1 ? "s" : ""}`}</span>
            </> : <span>Walking transfer</span>}
          </div>
          <ol className="space-y-1.5">
            {journey.walks.filter(w => w.afterLeg === -1).map(w => <li key={w.id} className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">Walk {name(w.fromStationId)} → {name(w.toStationId)} · ≈ {Math.round(w.walkSeconds / 60)} min. {w.note}</li>)}
            {journey.legs.map((leg, i) => {
              const line = lines.get(leg.lineId);
              return (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="mt-0.5 w-1.5 shrink-0 self-stretch rounded-full" style={{ background: line?.color }} />
                  <div className="min-w-0">
                    {i > 0 && !journey.walks.some(w => w.afterLeg === i - 1) && <div className="text-[11px] text-amber-700">Change at {name(leg.stationIds[0])}</div>}
                    <div className="text-slate-800">
                      <b>{line?.name}</b> towards {name(leg.towardsId)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {name(leg.stationIds[0])} → {name(leg.stationIds.at(-1)!)} · {leg.stationIds.length - 1} stop{leg.stationIds.length > 2 ? "s" : ""}
                    </div>
                    {journey.walks.filter(w => w.afterLeg === i).map(w => <div key={w.id} className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">Walk {name(w.fromStationId)} → {name(w.toStationId)} · ≈ {Math.round(w.walkSeconds / 60)} min. {w.note}</div>)}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-[11px] leading-snug text-slate-400">Estimated from simulated speeds, nominal {Math.round(TRANSFER_S / 60)}-minute station changes and walking times plus a nominal train wait. Not an operator timetable or fare route.</p>
        </div>
      )}
    </section>
  );
}
