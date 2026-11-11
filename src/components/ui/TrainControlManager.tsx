import { useMemo, useState } from "react";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import { useSimNow } from "../../store/useSimNow";
import type { Service } from "../../utils/trainSim";

type StatusFilter = "all" | "running" | "dwelling" | "stopped";
const button = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 disabled:cursor-default disabled:opacity-40";

/** The full simulated fleet is controllable even when its line is hidden on the map. */
export function TrainControlManager({ network, service, onFollow }: { network: Network; service: Service; onFollow?: () => void }) {
  const [query, setQuery] = useState("");
  const [lineId, setLineId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const { trainControls, setTrainsHeld, playing, togglePlay, hiddenLines, follow, followTrain, setView, setAllLines } = useMapStore();
  const now = useSimNow(500);
  const names = useMemo(() => new Map(network.stations.features.map((f) => [f.properties.id, f.properties.name])), [network.stations]);
  const lines = useMemo(() => new Map(network.lines.features.map((f) => [f.properties.id, f.properties])), [network.lines]);
  const ids = useMemo(() => service.trains.map((t) => t.id), [service]);
  const states = service.trains.map((t) => service.stateAt(t, now, trainControls));
  const stopped = states.filter((s) => s.held).length;
  const q = query.trim().toLowerCase();
  const filtered = states.filter((s) => (lineId === "all" || s.train.lineId === lineId) &&
    (status === "all" || (status === "stopped" ? s.held : status === "dwelling" ? !s.held && !!s.atStationId : !s.held && !s.atStationId)) &&
    [s.train.id, lines.get(s.train.lineId)?.name, names.get(s.terminusId), names.get(s.nextStationId)].some((v) => v?.toLowerCase().includes(q)));

  return (
    <div aria-label="Train Control Manager">
      <div className="sticky top-0 z-10 space-y-2 border-b border-slate-100 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Train Control Manager</h2>
            <p className="text-[11px] text-slate-500">{states.length - stopped} active · {stopped} stopped · {states.length} total · simulated</p>
          </div>
          <div className="flex gap-1.5">
            <button className={`${button} text-emerald-800`} type="button" disabled={!stopped} onClick={() => setTrainsHeld(ids, false)}>Start all</button>
            <button className={`${button} text-amber-800`} type="button" disabled={stopped === ids.length} onClick={() => setTrainsHeld(ids, true)}>Stop all</button>
          </div>
        </div>
        {!playing && <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
          <span>Simulation paused. Start arms trains; resume the clock to move.</span>
          <button type="button" onClick={togglePlay} className="shrink-0 font-semibold underline">Resume clock</button>
        </div>}
        <div className="flex flex-wrap gap-1.5">
          <input aria-label="Search trains" placeholder="Train ID or station…" value={query} onChange={(e) => setQuery(e.target.value)}
            className="min-w-28 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-500" />
          <select aria-label="Filter trains by line" value={lineId} onChange={(e) => setLineId(e.target.value)} className="max-w-40 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs">
            <option value="all">All lines</option>
            {network.lines.features.map(({ properties: l }) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select aria-label="Filter trains by status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs">
            <option value="all">All states</option><option value="running">Between stations</option><option value="dwelling">At station</option><option value="stopped">Stopped</option>
          </select>
        </div>
        <p className="text-[10px] text-slate-500">Showing {filtered.length} of {states.length}. Start/Stop holds position. Fleet buttons affect all lines.</p>
      </div>
      {!filtered.length ? <p className="p-4 text-xs text-slate-500">No trains match these filters.</p> : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((s) => (
            <li key={s.train.id} data-train-id={s.train.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 ${follow?.trainId === s.train.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
              <div className="min-w-0 flex-1 basis-40">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lines.get(s.train.lineId)?.color }} />
                  <span className="font-semibold text-slate-900">{s.train.id}</span>
                  <span className="truncate text-slate-500">{lines.get(s.train.lineId)?.name}</span>
                </div>
                <p className="truncate text-[11px] text-slate-600" title={`Towards ${names.get(s.terminusId)}`}>→ {names.get(s.terminusId)}</p>
                <p className="truncate text-[11px] text-slate-500">{s.atStationId ? "At" : "Next"} {names.get(s.nextStationId)}{hiddenLines.includes(s.train.lineId) ? " · hidden on map" : ""}</p>
              </div>
              <div className="w-20 text-right text-[11px]">
                <span className={`block font-medium ${s.held ? "text-amber-700" : "text-emerald-700"}`} data-train-status>
                  {s.held ? "Stopped" : !playing ? "Paused" : s.atStationId ? "At station" : "Running"}
                </span>
                <span className="text-slate-500 tabular-nums">{playing ? Math.round(s.speedKmh) : 0} km/h</span>
              </div>
              <div className="ml-auto flex gap-1.5">
                <button type="button" className={`${button} ${s.held ? "text-emerald-800" : "text-amber-800"}`} aria-label={`${s.held ? "Start" : "Stop"} ${s.train.id}`}
                  onClick={() => setTrainsHeld([s.train.id], !s.held)}>{s.held ? "Start" : "Stop"}</button>
                <button type="button" className={`${button} text-blue-800`} aria-label={`Follow ${s.train.id} in 3D`} aria-pressed={follow?.trainId === s.train.id}
                  onClick={() => { setAllLines(hiddenLines.filter((l) => l !== s.train.lineId)); setView("3d"); followTrain(s.train.id); onFollow?.(); }}>Follow</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500">Nominal motion · session controls · no signalling or collision avoidance</p>
    </div>
  );
}
