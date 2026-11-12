import { useMapStore, type LabelMode } from "../../store/useMapStore";
import { UndergroundControls } from "./UndergroundControls";

const LABELS: { id: LabelMode; label: string }[] = [
  { id: "trains", label: "Trains" },
  { id: "stations", label: "Stations" },
  { id: "all", label: "All" },
  { id: "off", label: "Off" },
];

/** 3D map controls on the right, like the reference: zoom, views, label mode. */
export function SceneControls() {
  const { cameraDo, labels, setLabels } = useMapStore();
  const button = "grid h-9 w-9 place-items-center text-slate-600 hover:bg-slate-50 hover:text-slate-900";
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-3">
      <div className="hidden md:block"><UndergroundControls /></div>
      <div className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg">
        <button type="button" className={button} onClick={()=>cameraDo("low")} aria-label="Low angle view" title="Low angle view">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2.5"/></svg>
        </button>
        <button type="button" className={button} onClick={()=>cameraDo("oblique")} aria-label="Oblique view" title="Oblique view">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="m2 12 8-5 8 5-8 5-8-5Z M10 7V2 M7 5l3-3 3 3"/></svg>
        </button>
        <button type="button" className={button} onClick={() => cameraDo("zoomIn")} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={button} onClick={() => cameraDo("zoomOut")} aria-label="Zoom out">
          −
        </button>
        <button type="button" className={button} onClick={() => cameraDo("hub")} aria-label="Go to the main interchange" title="Main interchange">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M3 9.5 10 4l7 5.5V16H3z" />
          </svg>
        </button>
        <button type="button" className={button} onClick={() => cameraDo("network")} aria-label="Show the whole network" title="Whole network">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
          </svg>
        </button>
      </div>
      {/* Hidden on phones, where it would cover the left-hand cards. */}
      <div className="hidden rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg sm:block">
        <div className="mb-1 text-[11px] text-slate-500">Labels</div>
        <div className="flex gap-0.5" role="radiogroup" aria-label="Labels">
          {LABELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={labels === l.id}
              onClick={() => setLabels(l.id)}
              className={`rounded-md px-2 py-1 text-[11px] ${labels === l.id ? "bg-blue-600 font-medium text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">WASD to move · Shift for speed</p>
      </div>
    </div>
  );
}
