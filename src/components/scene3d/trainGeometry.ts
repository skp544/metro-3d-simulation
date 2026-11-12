import { TRAIN } from "../../constants/scene.ts";
import { pointAt, type RoutePath3D } from "./geometry.ts";

export const UNDERGROUND_Y = -2;

/** Include both ends and every car: Auto X-ray stays on until the entire consist leaves the tunnel. */
export function consistUnderground(path: RoutePath3D, km: number, cars: number = TRAIN.cars, carLength: number = TRAIN.carLength) {
  const halfKm = cars * carLength / 2000;
  for (let i = 0; i <= cars; i++) {
    const at = km - halfKm + i * carLength / 1000;
    if (pointAt(path.points, path.km, at).position[1] < UNDERGROUND_Y) return true;
  }
  return false;
}

/** Grade across a car's wheelbase-sized sample; geographic coordinates never enter this function. */
export function trainPitch(path: RoutePath3D, km: number, dir: 1 | -1) {
  const a = pointAt(path.points, path.km, km - 0.005).position;
  const b = pointAt(path.points, path.km, km + 0.005).position;
  return Math.atan2((b[1] - a[1]) * dir, Math.hypot(b[0] - a[0], b[2] - a[2]));
}
