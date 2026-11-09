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
      className="flex shrink-0 rounded-full border border-slate-200 bg-slate-50 p-0.5"
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
