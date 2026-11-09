import { useMemo } from "react";
import type { Network } from "../../data/loadNetwork";
import { useSimNow } from "../../store/useSimNow";
import type { Service } from "../../utils/trainSim";

/** KPI tiles like the reference's top-left row: network, stations, trains running. */
export function KpiCards({ network, service }: { network: Network; service: Service }) {
  const now = useSimNow(2000);
  const fixed = useMemo(() => {
    const km = (t?: string) => network.segments.features.filter((f) => !t || f.properties.trackType === t).reduce((a, f) => a + f.properties.lengthKm, 0);
    return { total: km(), elevated: km("elevated"), underground: km("underground"), interchanges: network.interchanges.features.length };
  }, [network]);
  const atStation = useMemo(() => service.trains.filter((t) => service.stateAt(t, now).atStationId).length, [service, now]);

  return (
    <div className="pointer-events-auto hidden gap-3 md:flex">
      <Kpi label="Network" value={fixed.total.toFixed(0)} unit="km" note={`${fixed.elevated.toFixed(0)} elevated · ${fixed.underground.toFixed(0)} underground`} />
      <Kpi label="Stations" value={String(network.stations.features.length)} note={`${fixed.interchanges} interchanges · 9 lines`} />
      <Kpi label="Trains running" value={String(service.trains.length)} note={`${atStation} at a station now · simulated`} accent />
    </div>
  );
}

function Kpi({ label, value, unit, note, accent }: { label: string; value: string; unit?: string; note: string; accent?: boolean }) {
  return (
    <div className="min-w-40 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-semibold tabular-nums ${accent ? "text-blue-700" : "text-slate-900"}`}>{value}</span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
      <div className="text-[11px] text-slate-400">{note}</div>
    </div>
  );
}
