import { useEffect, useMemo } from "react";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import { useSimNow } from "../../store/useSimNow";
import type { Service } from "../../utils/trainSim";
import { TrainSpeed } from "./TrainSpeed";

/** 3D: which simulated train the camera is following, where it is heading, and how to stop (button, Esc or panning). */
export function FollowCard({
  network,
  service,
}: {
  network: Network;
  service: Service;
}) {
  const follow = useMapStore((s) => s.follow);
  const followTrain = useMapStore((s) => s.followTrain);
  const setTrainsHeld = useMapStore((s) => s.setTrainsHeld);
  const trainControls = useMapStore((s) => s.trainControls);
  const now = useSimNow(1000);
  const train = useMemo(
    () => service.trains.find((t) => t.id === follow?.trainId),
    [service, follow],
  );
  const line = useMemo(
    () =>
      network.lines.features.find((f) => f.properties.id === train?.lineId)
        ?.properties,
    [network.lines, train],
  );
  const names = useMemo(
    () =>
      new Map(
        network.stations.features.map((f) => [
          f.properties.id,
          f.properties.name,
        ]),
      ),
    [network.stations],
  );

  useEffect(() => {
    if (!follow) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" &&
      document.activeElement?.tagName !== "INPUT" &&
      followTrain(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [follow, followTrain]);

  if (!train) return null;
  const s = service.stateAt(train, now, trainControls);
  return (
    <div
      className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 py-1 pr-1 pl-3 text-xs shadow-lg backdrop-blur"
      role="status"
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: line?.color }}
      />
      <span className="text-slate-500">Following</span>
      <span className="font-semibold text-slate-900">{train.id}</span>
      <TrainSpeed state={s} showLimit />
      <span className="hidden text-slate-600 sm:inline">
        → {names.get(s.terminusId)} ·{" "}
        {s.atStationId
          ? `at ${names.get(s.atStationId)}`
          : `next ${names.get(s.nextStationId)}`}
      </span>
      <span className="hidden text-[11px] text-slate-400 md:inline">
        simulated
      </span>
      {s.held && <span className="text-amber-700">Stopped</span>}
      <button
        type="button"
        onClick={() => setTrainsHeld([train.id], !s.held)}
        className="rounded-full border border-slate-200 px-2.5 py-1 font-medium text-slate-800 hover:bg-slate-100"
      >
        {s.held ? "Start train" : "Stop train"}
      </button>
      <button
        type="button"
        onClick={() => followTrain(null)}
        className="rounded-full bg-slate-900 px-2.5 py-1 font-medium text-white hover:bg-slate-700"
        title="Stop following (Esc, or drag the map)"
      >
        Stop following
      </button>
    </div>
  );
}
