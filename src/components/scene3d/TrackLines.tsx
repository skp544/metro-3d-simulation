import { Line } from "@react-three/drei";
import { TRACK_WIDTH_PX } from "../../constants/scene";
import { useMapStore } from "../../store/useMapStore";
import type { TrackRun3D } from "./geometry";

// Level is shown by height; underground runs are also dashed (as in 2D) since they sit under the ground plane.
export function TrackLines({ runs, colors, dashSize = 120, gapSize = 80 }: { runs: TrackRun3D[]; colors: Map<string, string>; dashSize?: number; gapSize?: number }) {
  const hiddenLines = useMapStore((s) => s.hiddenLines);
  const hiddenTypes = useMapStore((s) => s.hiddenTrackTypes);
  return runs
    .filter((r) => !hiddenLines.includes(r.lineId) && !hiddenTypes.includes(r.type))
    .map((r) => (
      <Line
        key={r.id}
        points={r.points}
        color={colors.get(r.lineId)}
        lineWidth={r.type === "underground" ? TRACK_WIDTH_PX - 0.5 : TRACK_WIDTH_PX}
        dashed={r.type === "underground" || r.type === "unknown"}
        dashSize={dashSize}
        gapSize={gapSize}
      />
    ));
}
