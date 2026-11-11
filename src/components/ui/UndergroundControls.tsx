import { groundVisible, useMapStore, type UndergroundMode } from "../../store/useMapStore";

const MODES: { id: UndergroundMode; label: string }[] = [
  { id: "auto", label: "Auto" }, { id: "surface", label: "Surface" }, { id: "underground", label: "Underground" },
];

export function UndergroundControls() {
  const mode = useMapStore((s) => s.undergroundMode);
  const setMode = useMapStore((s) => s.setUndergroundMode);
  const surface = useMapStore(groundVisible);
  return (
    <section className="pointer-events-auto max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg" aria-label="Underground visibility">
      <div className="mb-1 text-[11px] font-medium text-slate-700">Underground view</div>
      <div className="flex gap-0.5" role="group" aria-label="Underground mode">
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}
            className={`rounded-md px-2 py-1.5 text-[11px] ${mode === m.id ? "bg-slate-900 font-medium text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-1 max-w-56 text-[10px] text-slate-500" role="status">
        {!surface ? "X-ray active · depths and tunnel sizes nominal" : mode === "auto" ? "Reveals tunnels while following below ground" : "Surface only · underground trains hidden"}
      </p>
    </section>
  );
}
