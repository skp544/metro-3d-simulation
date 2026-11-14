import { useEffect, useMemo, useRef, useState } from "react";
import { WORK_IN_PROGRESS_SYSTEMS } from "../../constants/map";
import { PLACE_CATEGORIES } from "../../constants/places";
import type { Network } from "../../data/loadNetwork";
import { useMapStore, type Speed } from "../../store/useMapStore";
import { formatIst, useSimNow } from "../../store/useSimNow";
import { ViewToggle } from "./ViewToggle";
import { showLandmark } from "../../store/showLandmark";

const SPEEDS: Speed[] = [1, 2, 4, 8];

/** Top bar in the reference's style: brand, search, view switch, simulation speed, live clock. */
export function TopBar({ network }: { network: Network }) {
  return (
    <header className="relative z-[1100] flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2 md:flex-nowrap md:px-4">
      <div className="flex shrink-0 items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-[11px] font-bold text-white" aria-hidden>
          M
        </span>
        <span className="text-sm font-semibold text-slate-900">NCR Rail</span>
        <span className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 sm:inline">Delhi · Noida · Meerut</span>
      </div>
      <StationSearch network={network} />
      <ViewToggle />
      <SpeedControls />
      <LiveClock />
    </header>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function StationSearch({ network }: { network: Network }) {
  const { selectStation, focusOn } = useMapStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lines = useMemo(() => new Map(network.lines.features.map((f) => [f.properties.id, f.properties])), [network.lines]);
  const results = useMemo(() => {
    const k = norm(q);
    if (!k) return [];
    const stations = network.stations.features
      .filter((f) => [f.properties.name, ...f.properties.aliases, ...f.properties.refs, ...f.properties.lines.map(id => lines.get(id)?.name ?? "")].some((n) => norm(n).includes(k)))
      .sort((a, b) => Number(!norm(a.properties.name).startsWith(k)) - Number(!norm(b.properties.name).startsWith(k)))
      .slice(0, 8).map(f => ({ id: f.properties.id, name: f.properties.name, lines: f.properties.lines, ref: f.properties.refs[0], pick: () => { selectStation(f.properties.id); focusOn(f.geometry.coordinates as [number, number]); } }));
    const places = network.landmarks.features.filter(f => [f.properties.name, f.properties.region, ...f.properties.aliases, PLACE_CATEGORIES[f.properties.category].plural].some(n => norm(n).includes(k))).map(f => ({ id: f.properties.id, name: f.properties.name, lines: [] as string[], ref: PLACE_CATEGORIES[f.properties.category].label, pick: () => showLandmark(f) }));
    return [...places, ...stations].slice(0, 8);
  }, [q, network.stations, network.landmarks, lines, selectStation, focusOn]);
  // Searching for a system that is not on the map yet says so instead of finding nothing.
  const wip = useMemo(() => {
    const k = norm(q);
    return k.length < 3 ? [] : WORK_IN_PROGRESS_SYSTEMS.filter((w) => [w.name, ...w.keywords].some((n) => norm(n).includes(k)));
  }, [q]);

  // "/" focuses the search, as in the reference.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (f: (typeof results)[number]) => {
    f.pick();
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="relative order-last w-full md:order-none md:max-w-sm md:flex-1">
      <svg className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
        <path d="m14 14 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        role="combobox"
        aria-expanded={open && results.length + wip.length > 0}
        aria-controls="station-search-results"
        aria-label="Search stations and places"
        placeholder="Search stations, malls or places"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && results[active]) pick(results[active]);
          else if (e.key === "Escape") input.current?.blur();
          else return;
          e.preventDefault();
        }}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-8 pl-8 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-slate-200 px-1 text-[10px] text-slate-400">/</kbd>
      {open && results.length + wip.length > 0 && (
        <ul id="station-search-results" role="listbox" className="absolute top-full right-0 left-0 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {results.map((f, i) => (
            <li key={f.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(f)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${i === active ? "bg-slate-100" : "hover:bg-slate-50"}`}
              >
                <span className="flex gap-0.5">
                  {f.lines.map((l) => (
                    <span key={l} className="h-2 w-2 rounded-full" style={{ background: lines.get(l)?.color }} />
                  ))}
                </span>
                <span className="font-medium text-slate-800">{f.name}</span>
                {f.ref && <span className="ml-auto text-[10px] text-slate-400">{f.ref}</span>}
              </button>
            </li>
          ))}
          {wip.map((w) => (
            <li key={w.name} role="option" aria-selected={false} aria-disabled className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500">
              <span className="font-medium">{w.name}</span>
              <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Work in progress · not on this map yet</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SpeedControls() {
  const { playing, speed, togglePlay, setSpeed } = useMapStore();
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Simulation speed">
      <button type="button" onClick={togglePlay} aria-label={playing ? "Pause simulation clock" : "Resume simulation clock"} className="rounded-full px-2 py-1 text-xs text-slate-600 hover:bg-white">
        {playing ? "❚❚" : "▶"}
      </button>
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={speed === s}
          onClick={() => setSpeed(s)}
          className={`rounded-full px-2 py-1 text-xs ${speed === s ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500 hover:bg-white"}`}
        >
          ×{s}
        </button>
      ))}
    </div>
  );
}

function LiveClock() {
  const now = useSimNow(1000);
  const { playing, speed } = useMapStore();
  const live = playing && speed === 1;
  return (
    <div
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
      title="Trains follow a simulated service pattern, not live DMRC positions"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`} />
      {playing ? `SIM ×${speed}` : "PAUSED"} {formatIst(now)}
      <span className="hidden font-normal opacity-70 lg:inline">· simulated</span>
    </div>
  );
}
