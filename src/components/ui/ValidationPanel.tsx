import { useState } from "react";
import { SEVERITY_COLOR } from "../../constants/map";
import type { Network } from "../../data/loadNetwork";
import type { Severity } from "../../data/types";
import { useMapStore } from "../../store/useMapStore";

const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

// Review list for the visual check: click an issue to fly there with the validation rings on.
export function ValidationPanel({ network }: { network: Network }) {
  const [open, setOpen] = useState(false);
  const { focusOn, setLayer } = useMapStore();
  const v = network.validation;
  const located = v.issues.filter((i) => i.location).sort((a, b) => RANK[a.severity] - RANK[b.severity]);

  return (
    <aside className="pointer-events-auto absolute right-3 bottom-8 z-[1000] w-[calc(100%-1.5rem)] max-w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-slate-900">Validation</span>
          <span className="text-[11px] text-slate-500">
            {v.summary.errors} errors · {v.summary.warnings} warnings · {v.summary.info} info
          </span>
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.passed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {v.passed ? "Passed" : "Failed"}
        </span>
      </button>
      {open && (
        <ul className="max-h-72 overflow-y-auto border-t border-slate-100 py-1">
          {located.map((i, n) => (
            <li key={n}>
              <button
                type="button"
                className="flex w-full gap-2 px-4 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => {
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
      )}
    </aside>
  );
}
