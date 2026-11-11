import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { simSeconds, useMapStore } from "../../store/useMapStore";
import type { Service } from "../../utils/trainSim";
import type { RoutePath3D } from "./geometry";
import { consistUnderground } from "./trainGeometry";

/** Report only transitions. No React updates on each animation frame. Manual modes retain priority. */
export function UndergroundWatcher({ paths, service }: { paths: RoutePath3D[]; service: Service }) {
  const routes = useMemo(() => new Map(paths.map((p) => [p.routeId, p])), [paths]);
  const trains = useMemo(() => new Map(service.trains.map((t) => [t.id, t])), [service]);
  useFrame(() => {
    const s = useMapStore.getState();
    const train = s.follow && trains.get(s.follow.trainId);
    const path = train && routes.get(train.routeId);
    if (!train || !path) return;
    const underground = consistUnderground(path, service.stateAt(train, simSeconds(s), s.trainControls).km);
    if (s.undergroundFollow?.trainId !== train.id || s.undergroundFollow.underground !== underground)
      s.reportUnderground(train.id, underground);
  });
  return null;
}
