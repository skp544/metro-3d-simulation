import { useMemo, useState } from "react";
import {
  STATION_TYPE_LABEL,
  TRACK_ORDER,
  TRACK_STYLE,
  WORK_IN_PROGRESS_SYSTEMS,
} from "../../constants/map";
import type { Network } from "../../data/loadNetwork";
import type { InfraType, StationType } from "../../data/types";
import { useMapStore } from "../../store/useMapStore";

const STATION_TYPES: StationType[] = [
  "elevated",
  "underground",
  "mixed",
  "at_grade",
  "unknown",
];

// Layer and filter card; MapPage positions it in the left column under the KPI cards.
export function ControlPanel({ network }: { network: Network }) {
  // Starts collapsed so the map stays in view; "Layers" opens it.
  const [open, setOpen] = useState(false);
  const s = useMapStore();

  const counts = useMemo(() => {
    const stations = network.stations.features.map((f) => f.properties);
    const km = (t: InfraType) =>
      network.segments.features
        .filter((f) => f.properties.trackType === t)
        .reduce((a, f) => a + f.properties.lengthKm, 0);
    return {
      perLine: new Map(
        network.lines.features.map((l) => [
          l.properties.id,
          stations.filter((st) => st.lines.includes(l.properties.id)).length,
        ]),
      ),
      perStationType: new Map(
        STATION_TYPES.map((t) => [
          t,
          stations.filter((st) => st.stationType === t).length,
        ]),
      ),
      perTrackType: new Map(TRACK_ORDER.map((t) => [t, km(t)])),
    };
  }, [network]);
  const lineIds = network.lines.features.map((f) => f.properties.id);

  return (
    <aside className="pointer-events-auto w-full max-w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Layers &amp; filters
          </h2>
          <p className="text-[11px] text-slate-500">
            {network.lines.features.length} lines · OSM{" "}
            {network.osmSnapshot.slice(0, 10)} /{" "}
            {network.regionalSnapshot.slice(0, 10)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="control-panel-body"
          className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          {open ? "Hide" : "Layers"}
        </button>
      </header>

      {open && (
        <div
          id="control-panel-body"
          className="max-h-[calc(100dvh-19rem)] space-y-4 overflow-y-auto border-t border-slate-100 px-4 py-3"
        >
          <Section
            title="Lines"
            action={
              <button
                type="button"
                className="text-[11px] text-blue-600 hover:underline"
                onClick={() =>
                  s.setAllLines(s.hiddenLines.length ? [] : lineIds)
                }
              >
                {s.hiddenLines.length ? "Show all" : "Hide all"}
              </button>
            }
          >
            {network.lines.features.map(({ properties: l }) => (
              <Row
                key={l.id}
                checked={!s.hiddenLines.includes(l.id)}
                onChange={() => s.toggleLine(l.id)}
                count={counts.perLine.get(l.id)}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: l.color }}
                />
                {l.name}
              </Row>
            ))}
          </Section>

          <Section title="Other systems">
            {WORK_IN_PROGRESS_SYSTEMS.map((w) => (
              <div
                key={w.name}
                className="flex items-center gap-2 px-1 py-1 text-xs text-slate-400"
                aria-disabled
              >
                <input
                  type="checkbox"
                  disabled
                  className="opacity-50"
                  aria-label={`${w.name} (work in progress)`}
                />
                <span className="min-w-0 flex-1">{w.name}</span>
                <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  Work in progress
                </span>
              </div>
            ))}
          </Section>

          <Section title="Track type">
            {[...TRACK_ORDER].reverse().map((t) => (
              <Row
                key={t}
                checked={!s.hiddenTrackTypes.includes(t)}
                onChange={() => s.toggleTrackType(t)}
                count={`${counts.perTrackType.get(t)!.toFixed(1)} km`}
              >
                <svg width="28" height="8" aria-hidden className="shrink-0">
                  <line
                    x1="2"
                    y1="4"
                    x2="26"
                    y2="4"
                    stroke="#334155"
                    strokeWidth="3"
                    strokeDasharray={TRACK_STYLE[t].dashArray}
                    strokeLinecap={t === "at_grade" ? "round" : "butt"}
                  />
                </svg>
                {TRACK_STYLE[t].label}
              </Row>
            ))}
          </Section>

          <Section title="Station type">
            {STATION_TYPES.map((t) => (
              <Row
                key={t}
                checked={!s.hiddenStationTypes.includes(t)}
                onChange={() => s.toggleStationType(t)}
                count={counts.perStationType.get(t)}
              >
                {STATION_TYPE_LABEL[t]}
              </Row>
            ))}
          </Section>

          <Section title="Layers">
            <Row checked={s.showWater} onChange={v=>s.setLayer("showWater",v)}>River &amp; water</Row>
            <Row
              checked={s.showStations}
              onChange={(v) => s.setLayer("showStations", v)}
            >
              Stations
            </Row>
            {s.view === "3d" && (
              <Row
                checked={s.showGround}
                onChange={(v) => s.setLayer("showGround", v)}
              >
                X-ray: hide ground, show tunnels
              </Row>
            )}
            {/* shortcut: these two layers exist only on the 2D map; add them to the 3D scene in a later phase. */}
            {s.view === "2d" && (
              <>
                <Row
                  checked={s.showConstruction}
                  onChange={(v) => s.setLayer("showConstruction", v)}
                  count={network.construction.features.length}
                >
                  Under construction
                </Row>
                <Row
                  checked={s.showValidation}
                  onChange={(v) => s.setLayer("showValidation", v)}
                >
                  Validation issues
                </Row>
              </>
            )}
          </Section>

          <p className="text-[11px] leading-snug text-slate-500">
            Colours are from Wikidata or OSM, not operator-published HEX values.
            Track type comes from OSM tags; dotted at-grade track is mostly
            untagged and estimated. Dashed walking links are schematic.
          </p>
        </div>
      )}
    </aside>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          {title}
        </h2>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Row({
  checked,
  onChange,
  count,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  count?: number | string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs text-slate-700 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-slate-900"
      />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {count !== undefined && (
        <span className="text-[11px] text-slate-400 tabular-nums">{count}</span>
      )}
    </label>
  );
}
