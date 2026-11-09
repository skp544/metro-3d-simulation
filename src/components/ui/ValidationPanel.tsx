import { SEVERITY_COLOR } from "../../constants/map";
import type { Network } from "../../data/loadNetwork";
import type { Severity } from "../../data/types";
import { useMapStore } from "../../store/useMapStore";

const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

// Review list for the visual check (Validation tab of the bottom dock): click an issue to fly there
// with the validation rings on (2D map).
export function ValidationList({ network }: { network: Network }) {
  const { focusOn, setLayer, setView } = useMapStore();
  const v = network.validation;
  const located = v.issues.filter((i) => i.location).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return (
    <div>
      <p className="flex items-center gap-2 px-4 py-2 text-[11px] text-slate-500">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${v.passed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{v.passed ? "Passed" : "Failed"}</span>
        {v.summary.errors} errors · {v.summary.warnings} warnings · {v.summary.info} info
      </p>
      <ul>
        {located.map((i, n) => (
          <li key={n}>
            <button
              type="button"
              className="flex w-full gap-2 px-4 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setView("2d");
                setLayer("showValidation", true);
                focusOn(i.location!);
              }}
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[i.severity] }} aria-label={i.severity} />
              <span>
                <span className="font-medium">{i.code}</span> · {i.message}
              </span>
            </button>
          </li>
        ))}
        {located.length === 0 && <li className="px-4 py-2 text-xs text-slate-500">No issues with a map location.</li>}
      </ul>
    </div>
  );
}
