import { useMemo, useState } from "react";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import type { Service } from "../../utils/trainSim";
import { TrainControlManager } from "./TrainControlManager";
import { ValidationList } from "./ValidationPanel";
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
