import { CircleMarker, Popup } from "react-leaflet";
import { SEVERITY_COLOR } from "../../constants/map";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";

// Rings around every validation issue that has a location (validation_report.json).
export function ValidationLayer({ network }: { network: Network }) {
  const show = useMapStore((s) => s.showValidation);
  if (!show) return null;
  return network.validation.issues
    .filter((i) => i.location)
    .map((i, n) => (
      <CircleMarker
        key={`${i.code}-${n}`}
        pane="validation"
        center={[i.location![1], i.location![0]]}
        radius={12}
        pathOptions={{ color: SEVERITY_COLOR[i.severity], weight: 3, fillOpacity: 0.08 }}
      >
        <Popup>
          <div className="text-xs">
            <div className="font-semibold" style={{ color: SEVERITY_COLOR[i.severity] }}>
              {i.severity.toUpperCase()} · {i.code}
            </div>
            <div className="mt-1 text-slate-700">{i.message}</div>
          </div>
        </Popup>
      </CircleMarker>
    ));
}
