import { useMemo, useState } from "react";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import type { Service } from "../../utils/trainSim";
import { TrainControlManager } from "./TrainControlManager";
import { ValidationList } from "./ValidationPanel";
import { TrainSpeed } from "./TrainSpeed";
import { LandmarkList } from "./LandmarkPanel";

type Tab = "trains" | "stations" | "places" | "validation";

/** Bottom tabbed list like the reference's fleet table: trains, stations, validation issues. */
export function BottomDock({
  network,
  service,
}: {
  network: Network;
  service: Service;
}) {
  const [tab, setTab] = useState<Tab>("trains");
  const [open, setOpen] = useState(() => window.innerWidth >= 1024);
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "trains", label: "Train control", count: service.trains.length },
    {
      id: "stations",
      label: "Stations",
      count: network.stations.features.length,
    },
    { id: "places", label: "Places", count: network.landmarks.features.length },
    {
      id: "validation",
      label: "Validation",
      count:
        network.validation.summary.errors + network.validation.summary.warnings,
    },
  ];
  return (
    <section className="pointer-events-auto w-[min(42rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
      <div
        className="flex items-center gap-1 border-b border-slate-100 px-2"
        role="tablist"
        aria-label="Lists"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setOpen(true);
            }}
            className={`border-b-2 px-2 py-2 text-[11px] sm:px-3 sm:text-xs ${tab === t.id && open ? "border-slate-900 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t.label} <span className="text-slate-400">{t.count}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="ml-auto rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <div className="max-h-[38vh] overflow-y-auto" role="tabpanel">
          {tab === "trains" && (
            <TrainControlManager
              network={network}
              service={service}
              onFollow={() => {
                if (window.innerWidth < 768) setOpen(false);
              }}
            />
          )}
          {tab === "stations" && <StationList network={network} />}
          {tab === "places" && <LandmarkList network={network} />}
          {tab === "validation" && <ValidationList network={network} />}
        </div>
      )}
    </section>
  );
}

function TrainList({
  network,
  service,
}: {
  network: Network;
  service: Service;
}) {
  const now = useSimNow(1000);
  const { hiddenLines, focusOn, followTrain, view } = useMapStore();
  const following = useMapStore((s) => s.follow?.trainId);
  const lines = useMemo(
    () =>
      new Map(
        network.lines.features.map((f) => [f.properties.id, f.properties]),
      ),
    [network.lines],
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
  const routes = useMemo(
    () => new Map(network.routes.features.map((f) => [f.properties.id, f])),
    [network.routes],
  );
  const states = service.trains
    .filter((t) => !hiddenLines.includes(t.lineId))
    .map((t) => service.stateAt(t, now));

  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-white text-[10px] text-slate-400">
        <tr>
          <th className="py-1 pl-4 font-normal">Train</th>
          <th className="font-normal">Line / destination</th>
          <th className="font-normal">Status</th>
          <th className="font-normal">Speed · sim.</th>
          <th className="pr-4 font-normal">Trip</th>
        </tr>
      </thead>
      <tbody>
        {states.map((s) => (
          <tr
            key={s.train.id}
            onClick={() => {
              // 3D: follow the train. 2D (no trains drawn): fly once to where it is.
              if (view === "3d") return followTrain(s.train.id);
              // The route geometry starts before its first stop; stopKm[0] is that offset.
              const route = routes.get(s.train.routeId)!;
              focusOn(
                along(route, s.km + route.properties.stopKm[0], {
                  units: "kilometers",
                }).geometry.coordinates as [number, number],
              );
            }}
            title={
              view === "3d" ? "Follow this train" : "Show where this train is"
            }
            aria-selected={following === s.train.id}
            className={`cursor-pointer border-b border-slate-50 ${following === s.train.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
          >
            <td className="py-1.5 pl-4 font-semibold whitespace-nowrap text-slate-900">
              {s.train.id}
            </td>
            <td className="py-1.5">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: lines.get(s.train.lineId)?.color }}
                />
                {lines.get(s.train.lineId)?.name.replace(" Line", "")} →{" "}
                {names.get(s.terminusId)}
              </span>
            </td>
            <td className="py-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${s.atStationId ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}
              >
                {s.atStationId
                  ? `At ${names.get(s.atStationId)}`
                  : `Next ${names.get(s.nextStationId)}`}
              </span>
            </td>
            <td className="px-2 py-1.5 whitespace-nowrap">
              <TrainSpeed state={s} />
            </td>
            <td className="w-20 min-w-16 py-1.5 pr-4">
              <div
                className="h-1.5 rounded-full bg-slate-100"
                title={`${Math.round(s.progress * 100)}% of the trip`}
              >
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${s.progress * 100}%`,
                    background: lines.get(s.train.lineId)?.color,
                  }}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StationList({ network }: { network: Network }) {
  const { selectStation, focusOn } = useMapStore();
  const lines = useMemo(
    () =>
      new Map(
        network.lines.features.map((f) => [f.properties.id, f.properties]),
      ),
    [network.lines],
  );
  const sorted = useMemo(
    () =>
      [...network.stations.features].sort((a, b) =>
        a.properties.name.localeCompare(b.properties.name),
      ),
    [network.stations],
  );
  return (
    <ul>
      {sorted.map((f) => (
        <li key={f.properties.id}>
          <button
            type="button"
            onClick={() => {
              selectStation(f.properties.id);
              focusOn(f.geometry.coordinates as [number, number]);
            }}
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs hover:bg-slate-50"
          >
            <span className="flex gap-0.5">
              {f.properties.lines.map((l) => (
                <span
                  key={l}
                  className="h-2 w-2 rounded-full"
                  style={{ background: lines.get(l)?.color }}
                />
              ))}
            </span>
            <span className="font-medium text-slate-800">
              {f.properties.name}
            </span>
            <span className="ml-auto text-[11px] text-slate-400">
              {f.properties.stationType.replace("_", "-")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
