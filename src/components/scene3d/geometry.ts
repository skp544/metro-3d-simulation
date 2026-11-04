// Network GeoJSON → 3D track runs, continuous route paths and station points (metres; x east, y up, z south).
// Explicit .ts imports: this module is also loaded directly by Node's test runner.
import { VERTICAL_EXAGGERATION } from "../../constants/scene.ts";
import type { InfraType, LinesFC, RoutesFC, SegmentsFC, StationsFC } from "../../data/types.ts";
import { boundsCentre, createProjection, type Projection } from "../../utils/projection.ts";
import { heightProfile, type Run } from "../../utils/trackProfile.ts";

export type V3 = [number, number, number];

/** Consecutive segments of one route with the same track type, as one polyline. */
export interface TrackRun3D {
  id: string;
  lineId: string;
  type: InfraType;
  points: V3[];
}

/** A whole route as one polyline (for structures that follow height rather than type, e.g. viaducts on ramps). */
export interface RoutePath3D {
  routeId: string;
  lineId: string;
  points: V3[];
}

export interface StationPoint3D {
  stationId: string;
  lineId: string | null; // null = the interchange marker itself
  stationType: string;
  position: V3;
  /** Track heading at the platform, radians about +y (0 = +x). Null for interchange markers. */
  yaw: number | null;
}

export interface Scene3DData {
  projection: Projection;
  runs: TrackRun3D[];
  paths: RoutePath3D[];
  stations: StationPoint3D[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** The parts of the loaded network the 3D scene needs (a full `Network` fits). */
export interface NetworkGeometry {
  lines: LinesFC;
  routes: RoutesFC;
  segments: SegmentsFC;
  stations: StationsFC;
}

export function buildScene3D(network: NetworkGeometry): Scene3DData {
  const projection = createProjection(boundsCentre(network.lines));
  const runs: TrackRun3D[] = [];
  const paths: RoutePath3D[] = [];
  const platforms = new Map<string, { position: V3; yaw: number }>(); // `${stationId}|${lineId}`
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

  for (const route of network.routes.features) {
    const r = route.properties;
    const segs = network.segments.features.filter((s) => s.properties.routeId === r.id).sort((a, b) => a.properties.id.localeCompare(b.properties.id));

    // Distance along the route (km from the first stop) where each segment starts.
    const starts: number[] = [];
    let km = 0;
    for (const s of segs) {
      starts.push(km);
      km += s.properties.lengthKm;
    }
    const typeRuns: Run[] = [];
    segs.forEach((s, i) => {
      const last = typeRuns.at(-1);
      const end = starts[i] + s.properties.lengthKm;
      if (last?.type === s.properties.trackType) last.toKm = end;
      else typeRuns.push({ type: s.properties.trackType, fromKm: starts[i], toKm: end });
    });
    const heightAt = heightProfile(typeRuns);

    const path: RoutePath3D = { routeId: r.id, lineId: r.lineId, points: [] };
    const pathKm: number[] = [];
    let current: TrackRun3D | null = null;
    segs.forEach((s, i) => {
      const xz = s.geometry.coordinates.map((c) => projection.project(c as [number, number]));
      // Spread the segment's length over its vertices in proportion to planar distance.
      const cum = [0];
      for (let j = 1; j < xz.length; j++) cum.push(cum[j - 1] + Math.hypot(xz[j][0] - xz[j - 1][0], xz[j][1] - xz[j - 1][1]));
      const kms = cum.map((c) => starts[i] + (cum.at(-1)! ? (c / cum.at(-1)!) * s.properties.lengthKm : 0));
      const pts: V3[] = xz.map(([x, z], j) => {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxZ = Math.max(bounds.maxZ, z);
        return [x, heightAt(kms[j]) * VERTICAL_EXAGGERATION, z];
      });
      const skip = path.points.length ? 1 : 0; // consecutive segments share their joint point
      path.points.push(...pts.slice(skip));
      pathKm.push(...kms.slice(skip));
      if (current?.type === s.properties.trackType) current.points.push(...pts.slice(1));
      else {
        current = { id: `${r.id}:${runs.length}`, lineId: r.lineId, type: s.properties.trackType, points: pts };
        runs.push(current);
      }
    });
    paths.push(path);

    // Platforms sit on the track at each stop, facing along it. A station shared by two branches of
    // one line (Yamuna Bank) takes the first branch.
    r.stationIds.forEach((id, i) => {
      const key = `${id}|${r.lineId}`;
      if (!platforms.has(key)) platforms.set(key, pointAt(path.points, pathKm, r.stopKm[i] - r.stopKm[0]));
    });
  }

  const stations: StationPoint3D[] = [];
  for (const f of network.stations.features) {
    const p = f.properties;
    const placed = p.platforms.map((pl) => platforms.get(`${p.id}|${pl.lineId}`));
    p.platforms.forEach((pl, i) => {
      const at = placed[i];
      // Fallback (should not happen: every platform's line stops there) keeps the 2D position on the ground.
      const [x, z] = projection.project(pl.coordinates);
      stations.push({ stationId: p.id, lineId: pl.lineId, stationType: p.stationType, position: at?.position ?? [x, 0, z], yaw: at?.yaw ?? 0 });
    });
    if (p.isInterchange) {
      const [x, z] = projection.project(f.geometry.coordinates as [number, number]);
      const top = Math.max(...placed.map((a) => a?.position[1] ?? 0));
      stations.push({ stationId: p.id, lineId: null, stationType: p.stationType, position: [x, top + 2, z], yaw: null });
    }
  }
  return { projection, runs, paths, stations, bounds };
}

/** Point and heading at distance `km` along a polyline whose vertices sit at `kms`. */
function pointAt(points: V3[], kms: number[], km: number) {
  let i = kms.findIndex((k) => k >= km);
  if (i <= 0) i = i === 0 ? 1 : points.length - 1;
  const [a, b] = [points[i - 1], points[i]];
  const t = kms[i] > kms[i - 1] ? Math.min(1, Math.max(0, (km - kms[i - 1]) / (kms[i] - kms[i - 1]))) : 0;
  return {
    position: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])] as V3,
    yaw: Math.atan2(-(b[2] - a[2]), b[0] - a[0]),
  };
}
