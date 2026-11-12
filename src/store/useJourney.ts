import { useMemo } from "react";
import type { Network } from "../data/loadNetwork";
import { buildRoutePlanner, type RoutePlanner } from "../utils/routePlanner";
import { useMapStore } from "./useMapStore";

// One planner per loaded network, shared by the route panel and both views.
const planners = new WeakMap<Network["routes"], RoutePlanner>();

/** The highlighted journey between the chosen stations, or null until both ends are set. */
export function useJourney(network: Network) {
  const from = useMapStore((s) => s.routeFrom);
  const to = useMapStore((s) => s.routeTo);
  return useMemo(() => {
    if (!from || !to) return null;
    let planner = planners.get(network.routes);
    if (!planner)
      planners.set(
        network.routes,
        (planner = buildRoutePlanner(
          network.routes,
          network.segments,
          undefined,
          network.transfers,
        )),
      );
    return planner.plan(from, to);
  }, [network, from, to]);
}
