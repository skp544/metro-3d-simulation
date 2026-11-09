import { useMemo, useState } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMapStore } from "../../store/useMapStore";
import type { Journey } from "../../utils/routePlanner";
import { pointAt, type RoutePath3D, type StationPoint3D, type V3 } from "./geometry";

const LIFT_M = 2.5; // just above the deck so the highlight is not hidden by the track

/** The part of a route path between two km marks (either order), endpoints interpolated. */
function slice(path: RoutePath3D, a: number, b: number): V3[] {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const pts = [pointAt(path.points, path.km, lo).position, ...path.points.filter((_, i) => path.km[i] > lo && path.km[i] < hi), pointAt(path.points, path.km, hi).position];
  return a < b ? pts : pts.reverse();
}

/**
 * The planned journey in 3D: a cased line in each leg's colour, drawn over everything (no depth test) so it
 * reads at any distance, plus start and end tags. With the ground shown, underground stretches are drawn
 * at the surface, like the dashed underground lines.
 */
export function RouteOverlay({ journey, paths, stations, colors, names }: { journey: Journey; paths: RoutePath3D[]; stations: StationPoint3D[]; colors: Map<string, string>; names: Map<string, string> }) {
  const showGround = useMapStore((s) => s.showGround);
  // Mount the tags after the first frame: when two drei <Html> mount in the scene's first render, the
  // first one's content is lost (seen 2026-11-09 with drei 10.7; later-mounting labels are unaffected).
  const [framed, setFramed] = useState(false);
  useFrame(() => {
    if (!framed) setFramed(true);
  });
  const pieces = useMemo(() => {
    const byId = new Map(paths.map((p) => [p.routeId, p]));
    return journey.legs.flatMap((leg, i) =>
      leg.spans.map((span, j) => ({
        key: `${i}-${j}`,
        lineId: leg.lineId,
        points: slice(byId.get(leg.routeId)!, span[0], span[1]).map(([x, y, z]) => [x, (showGround ? Math.max(y, 0) : y) + LIFT_M, z] as V3),
      })),
    );
  }, [journey, paths, showGround]);

  const ends = useMemo(() => {
    const at = (stationId: string, lineId: string) => stations.find((s) => s.stationId === stationId && s.lineId === lineId)?.position;
    const first = journey.legs[0];
    const last = journey.legs.at(-1)!;
    return [
      { label: "From", stationId: journey.fromId, position: at(journey.fromId, first.lineId) },
      { label: "To", stationId: journey.toId, position: at(journey.toId, last.lineId) },
    ];
  }, [journey, stations]);

  return (
    <>
      {pieces.map((p) => (
        <group key={p.key}>
          <Line points={p.points} color="#ffffff" lineWidth={9} depthTest={false} renderOrder={10} />
          <Line points={p.points} color={colors.get(p.lineId)} lineWidth={5} depthTest={false} renderOrder={11} />
        </group>
      ))}
      {framed && ends.map(
        (e) =>
          e.position && (
            <Html key={e.label} position={[e.position[0], (showGround ? Math.max(e.position[1], 0) : e.position[1]) + 24, e.position[2]]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
              <div className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white shadow-md">
                {e.label}: {names.get(e.stationId)}
              </div>
            </Html>
          ),
      )}
    </>
  );
}
