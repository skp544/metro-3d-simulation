import { useMapStore, type View } from "../../store/useMapStore";

const VIEWS: { id: View; label: string }[] = [
  { id: "2d", label: "2D map" },
  { id: "3d", label: "3D view" },
];

export function ViewToggle() {
  const { view, setView } = useMapStore();
  return (
    <div
      role="radiogroup"
      aria-label="View"
      className="pointer-events-auto absolute top-3 left-1/2 z-[1000] flex -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur max-md:top-auto max-md:bottom-24"
    >
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="radio"
          aria-checked={view === v.id}
          onClick={() => setView(v.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${view === v.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
