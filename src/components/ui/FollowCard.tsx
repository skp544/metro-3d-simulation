import { useEffect, useMemo } from "react";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import { useSimNow } from "../../store/useSimNow";
import type { Service } from "../../utils/trainSim";

/** 3D: which simulated train the camera is following, where it is heading, and how to stop (button, Esc or panning). */
export function FollowCard({ network, service }: { network: Network; service: Service }) {
  const follow = useMapStore((s) => s.follow);
  const followTrain = useMapStore((s) => s.followTrain);
  const now = useSimNow(1000);
  const train = useMemo(() => service.trains.find((t) => t.id === follow?.trainId), [service, follow]);
  const line = useMemo(() => network.lines.features.find((f) => f.properties.id === train?.lineId)?.properties, [network.lines, train]);
  const names = useMemo(() => new Map(network.stations.features.map((f) => [f.properties.id, f.properties.name])), [network.stations]);

  useEffect(() => {
    if (!follow) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && document.activeElement?.tagName !== "INPUT" && followTrain(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [follow, followTrain]);

  if (!train) return null;
  const s = service.stateAt(train, now);
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 py-1 pr-1 pl-3 text-xs shadow-lg backdrop-blur" role="status">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: line?.color }} />
      <span className="text-slate-500">Following</span>
      <span className="font-semibold text-slate-900">{train.id}</span>
      <span className="hidden text-slate-600 sm:inline">
        → {names.get(s.terminusId)} · {s.atStationId ? `at ${names.get(s.atStationId)}` : `next ${names.get(s.nextStationId)}`}
      </span>
      <span className="hidden text-[11px] text-slate-400 md:inline">simulated</span>
      <button type="button" onClick={() => followTrain(null)} className="rounded-full bg-slate-900 px-2.5 py-1 font-medium text-white hover:bg-slate-700" title="Stop following (Esc, or drag the map)">
        Stop
      </button>
    </div>
  );
}
