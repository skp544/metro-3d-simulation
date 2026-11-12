import type { LandmarksFC } from "../data/types";
import { useMapStore } from "./useMapStore";

/** Shared picking behavior in search, lists and both geographic views. */
export function showLandmark(f: LandmarksFC["features"][number]) {
  const s = useMapStore.getState();
  s.selectLandmark(f.properties.id);
  s.focusOn(f.geometry.coordinates as [number, number], Math.max(180, f.properties.heightM * 4, f.properties.widthM * 2.5, f.properties.depthM * 2.5), f.properties.heightM * .35, f.properties.yaw + .35);
}
