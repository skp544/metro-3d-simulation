// Pure geometry builders for 3D structures: rectangular extrusions along a track, path offsets, pier and
// station part placements, and buildStructures() which assembles the whole network's structures for <Structures>.
// Explicit .ts imports: this module is also loaded directly by Node's test runner.
import * as THREE from "three";
import { PALETTE, STRUCTURE as S, VERTICAL_EXAGGERATION as VE } from "../../constants/scene.ts";
import type { InfraType, StationType } from "../../data/types.ts";
import type { Scene3DData } from "./geometry.ts";

type V3 = [number, number, number];
type RGB = [number, number, number];
type Face = "top" | "bottom" | "left" | "right";

export interface StructureFilters {
  hiddenLines: string[];
  hiddenTrackTypes: InfraType[];
  hiddenStationTypes: StationType[];
  showStations: boolean;
}

type Station = Scene3DData["stations"][number];

/** One instanced part of the stations (platforms, roof, …): a matrix and a station id per instance. */
export interface StationPart {
  key: string;
  shape: "box" | "cylinder";
  color: string;
  colors?: THREE.Color[]; // per instance (line-coloured fascia)
  opacity?: number; // < 1: see-through (the glazed roof, so trains at the platform stay visible)
  matrices: THREE.Matrix4[];
  ids: string[];
}

/** Everything <Structures> draws, for the lines, track types and stations the filters leave visible. */
export function buildStructures(scene: Scene3DData, colors: Map<string, string>, f: StructureFilters) {
  const rgb = (lineId: string) => new THREE.Color(colors.get(lineId)).toArray() as RGB;
  const plain: RGB = [1, 1, 1]; // single-colour meshes: the material sets the colour
  const paths = scene.paths.filter((p) => !f.hiddenLines.includes(p.lineId));
  const level = S.levelThreshold * VE;
  const above = paths.flatMap((p) => spansWhere(p.points, (y) => y > level).map((points) => ({ points, color: rgb(p.lineId) })));
  const below = paths.flatMap((p) => spansWhere(p.points, (y) => y < -level).map((points) => ({ points, color: rgb(p.lineId) })));
  const all: Face[] = ["top", "bottom", "left", "right"];
  const upper: Face[] = ["top", "left", "right"];
  const showElevated = !f.hiddenTrackTypes.includes("elevated");
  const showUnderground = !f.hiddenTrackTypes.includes("underground");
  const runs = scene.runs.filter((r) => !f.hiddenLines.includes(r.lineId) && !f.hiddenTrackTypes.includes(r.type));
  // Both tracks of every run (left-hand running: one each side of the centre line), and their rails.
  const half = S.trackSpacing / 2;
  const tracks = runs.flatMap((r) => [half, -half].map((d) => offsetPath(r.points, d)));
  const rails = tracks.flatMap((t) => [S.railHalfGauge, -S.railHalfGauge].map((d) => ({ points: offsetPath(t, d), color: plain })));

  const stations = scene.stations.filter(
    (s) => f.showStations && s.lineId !== null && !f.hiddenLines.includes(s.lineId) && !f.hiddenStationTypes.includes(s.stationType as StationType),
  );
  const aboveStations = stations.filter((s) => s.position[1] >= -level);
  const belowStations = stations.filter((s) => s.position[1] < -level);
  const deckBottom = S.deckSlab + S.girderDepth + S.pierCap.depth;
  const piers = showElevated ? pillarMatrices(above.map((s) => s.points), S.pillarSpacing, S.pillarSize, deckBottom, level) : [];

  return {
    // Viaduct, drawn at every distance.
    deck: showElevated ? extrudeRect(above.map((s) => ({ ...s, color: plain })), S.deckHalfWidth, -S.deckSlab, 0, all) : null,
    // The deck's edge faces carry the line colour, so lines stay readable without painting the track.
    deckEdges: showElevated ? extrudeRect(above, S.deckHalfWidth + 0.02, -S.deckSlab + 0.05, -0.05, ["left", "right"]) : null,
    girder: showElevated ? extrudeRect(above.map((s) => ({ ...s, color: plain })), S.girderHalfWidth, -S.deckSlab - S.girderDepth, -S.deckSlab, ["bottom", "left", "right"]) : null,
    piers,
    pierCaps: piers.map((m) => {
      const [p, q, scale] = [new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3()];
      m.decompose(p, q, scale);
      return new THREE.Matrix4().compose(p.setY(scale.y + S.pierCap.depth / 2), q, new THREE.Vector3(S.pierCap.along, S.pierCap.depth, S.pierCap.across));
    }),
    tunnel: showUnderground ? extrudeRect(below, S.tunnelHalfWidth, -S.tunnelHalfHeight * VE, S.tunnelHalfHeight * VE, all) : null,
    // Close-up detail.
    parapets: showElevated
      ? extrudeRect(above.flatMap((s) => [1, -1].map((side) => ({ points: offsetPath(s.points, side * (S.deckHalfWidth - S.parapetHalfThickness)), color: plain }))), S.parapetHalfThickness, 0, S.parapetHeight, upper)
      : null,
    plinths: extrudeRect(tracks.map((points) => ({ points, color: plain })), S.plinthHalfWidth, 0, S.plinthHeight, upper),
    ballast: extrudeRect(runs.filter((r) => r.type === "at_grade" || r.type === "unknown").map((r) => ({ points: r.points, color: plain })), S.ballastHalfWidth, -0.15, S.plinthHeight - 0.1, upper),
    rails: extrudeRect(rails, S.railHalfWidth, S.plinthHeight, S.railTop, upper),
    // Stations.
    aboveParts: stationParts(aboveStations, colors),
    belowStations: belowStations.map((s) => boxMatrix(s.position, s.yaw!, S.stationLength, S.stationHalfWidth, -S.stationBelowTrack * VE, S.stationAboveTrack * VE)),
    belowStationIds: belowStations.map((s) => s.stationId),
  };
}

/**
 * Above-ground station platforms (one per line at a station), as instanced parts: two side platforms with
 * a yellow edge strip, an open gabled glazed roof on columns with a line-coloured fascia, and, where the track is
 * high enough, a concourse box below. Generic and nominal (DMRC elevated stations mostly have side platforms).
 */
export function stationParts(stations: Station[], colors: Map<string, string>): StationPart[] {
  const { platform: P, edgeStrip: E, roof: R, concourse: C, stationLength: L } = S;
  const parts: Record<string, StationPart> = {};
  const add = (key: string, shape: StationPart["shape"], color: string, s: Station, m: THREE.Matrix4, instanceColor?: THREE.Color) => {
    const part = (parts[key] ??= { key, shape, color, matrices: [], ids: [], ...(instanceColor && { colors: [] }), ...(key === "roof" && { opacity: S.roof.opacity }) });
    part.matrices.push(m);
    part.ids.push(s.stationId);
    if (instanceColor) part.colors!.push(instanceColor);
  };
  const tilt = Math.atan2(R.ridge - R.eave, R.halfWidth);
  const columnsPerSide = Math.floor(L / R.columnSpacing);
  for (const s of stations) {
    const box = (o: LocalBox) => localBox(s.position, s.yaw!, o);
    const line = new THREE.Color(colors.get(s.lineId!));
    for (const side of [1, -1]) {
      const mid = (P.inner + P.outer) / 2;
      add("platform", "box", PALETTE.platform, s, box({ across: side * mid, length: L, halfWidth: (P.outer - P.inner) / 2, bottom: -S.deckSlab, top: P.top }));
      add("edgeStrip", "box", PALETTE.edgeStrip, s, box({ across: side * E.across, length: L, halfWidth: E.halfWidth, bottom: P.top - 0.05, top: P.top + 0.03 }));
      // Roof slab from the ridge (centre line) down to the eave, tilted about the station's long axis.
      add("roof", "box", PALETTE.stationRoof, s, box({ across: (side * R.halfWidth) / 2, length: L, halfWidth: R.halfWidth / 2 / Math.cos(tilt), bottom: (R.eave + R.ridge) / 2 - R.thickness / 2, top: (R.eave + R.ridge) / 2 + R.thickness / 2, roll: side * tilt }));
      add("fascia", "box", "#ffffff", s, box({ across: side * R.halfWidth, length: L, halfWidth: 0.15, bottom: R.eave - 0.7, top: R.eave + 0.1 }), line);
      for (let i = 0; i < columnsPerSide; i++)
        add("column", "box", PALETTE.column, s, box({ along: (i - (columnsPerSide - 1) / 2) * R.columnSpacing, across: side * R.columnAcross, length: R.columnSize, halfWidth: R.columnSize / 2, bottom: P.top, top: R.eave }));
    }
    // The concourse sits below the platforms, so only under elevated track that leaves room for it.
    const y = s.position[1];
    if (y - S.deckSlab - S.girderDepth > C.top + 1)
      add("concourse", "box", PALETTE.wall, s, box({ length: L * C.lengthShare, halfWidth: C.halfWidth, bottom: C.bottom - y, top: C.top - y }));
  }
  return Object.values(parts);
}

export interface LocalBox {
  along?: number; // metres along the station's axis (yaw direction)
  across?: number; // metres to its left (+) or right (−)
  length: number;
  halfWidth: number;
  bottom: number; // relative to `position`
  top: number;
  roll?: number; // tilt about the long axis; + lowers the left (+across) edge
}

/** A box in a station's frame: placed `along`/`across` from `position`, oriented by `yaw`, optionally tilted. */
export function localBox(position: V3, yaw: number, { along = 0, across = 0, length, halfWidth, bottom, top, roll = 0 }: LocalBox) {
  const up = new THREE.Vector3(0, 1, 0);
  // Local +x (along) is (cos yaw, 0, −sin yaw); local +z is (sin yaw, 0, cos yaw), the RIGHT of travel, so
  // `across` (left) runs along −z and a positive roll turns about +x by −roll to lower the left (−z) edge.
  const q = new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -roll));
  const [c, sn] = [Math.cos(yaw), Math.sin(yaw)];
  return new THREE.Matrix4().compose(
    new THREE.Vector3(position[0] + along * c - across * sn, position[1] + (bottom + top) / 2, position[2] - along * sn - across * c),
    q,
    new THREE.Vector3(length, top - bottom, halfWidth * 2),
  );
}

/** Horizontal unit normals to the left of travel at each point (averaged over the neighbouring segments). */
function leftNormals(points: V3[]): [number, number][] {
  return points.map((_, i) => {
    const [a, b] = [points[Math.max(0, i - 1)], points[Math.min(points.length - 1, i + 1)]];
    const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
    const len = Math.hypot(dx, dz) || 1;
    return [dz / len, -dx / len];
  });
}

/** The path moved `d` metres sideways (left of travel when positive), at the same heights. */
export function offsetPath(points: V3[], d: number): V3[] {
  const n = leftNormals(points);
  return points.map((p, i) => [p[0] + n[i][0] * d, p[1], p[2] + n[i][1] * d]);
}

/**
 * One BufferGeometry for many paths: a rectangle (±halfWidth across, `bottom`..`top` relative to the
 * track) swept along each path. Per-vertex colours allow one draw call for every line.
 * shortcut: no miter scaling at bends and no end caps; OSM track is dense enough that bends are gentle.
 */
export function extrudeRect(paths: { points: V3[]; color: RGB }[], halfWidth: number, bottom: number, top: number, faces: Face[]) {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const { points, color } of paths) {
    if (points.length < 2) continue;
    const left = leftNormals(points);
    const corner = (i: number, side: 1 | -1, y: number): V3 => [
      points[i][0] + side * left[i][0] * halfWidth,
      points[i][1] + y,
      points[i][2] + side * left[i][1] * halfWidth,
    ];
    const edges: Record<Face, [(i: number) => V3, (i: number) => V3]> = {
      top: [(i) => corner(i, 1, top), (i) => corner(i, -1, top)],
      bottom: [(i) => corner(i, -1, bottom), (i) => corner(i, 1, bottom)],
      left: [(i) => corner(i, 1, bottom), (i) => corner(i, 1, top)],
      right: [(i) => corner(i, -1, top), (i) => corner(i, -1, bottom)],
    };
    for (const f of faces) {
      const base = pos.length / 3;
      points.forEach((_, i) => {
        pos.push(...edges[f][0](i), ...edges[f][1](i));
        col.push(...color, ...color);
      });
      for (let i = 0; i < points.length - 1; i++) {
        const [a, b, c, d] = [base + 2 * i, base + 2 * i + 1, base + 2 * i + 2, base + 2 * i + 3];
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Contiguous stretches of a path where `keep(y)` holds, each padded by one point so it meets its neighbour. */
export function spansWhere(points: V3[], keep: (y: number) => boolean): V3[][] {
  const spans: V3[][] = [];
  let start = -1;
  for (let i = 0; i <= points.length; i++) {
    const inside = i < points.length && keep(points[i][1]);
    if (inside && start < 0) start = i;
    if (!inside && start >= 0) {
      spans.push(points.slice(Math.max(0, start - 1), Math.min(points.length, i + 1)));
      start = -1;
    }
  }
  return spans;
}

/** Pier instance matrices every `spacing` metres along elevated spans, from the ground up to `deckBottom` below the track. */
export function pillarMatrices(spans: V3[][], spacing: number, size: number, deckBottom: number, minHeight: number): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  for (const span of spans) {
    let next = spacing / 2;
    let walked = 0;
    for (let i = 1; i < span.length; i++) {
      const [a, b] = [span[i - 1], span[i]];
      const seg = Math.hypot(b[0] - a[0], b[2] - a[2]);
      while (seg > 0 && next <= walked + seg) {
        const t = (next - walked) / seg;
        const height = a[1] + t * (b[1] - a[1]) - deckBottom;
        // Turned to the track (local +x along it), so a pier cap can sit across the track.
        if (height > minHeight)
          out.push(new THREE.Matrix4().compose(
            new THREE.Vector3(a[0] + t * (b[0] - a[0]), height / 2, a[2] + t * (b[2] - a[2])),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-(b[2] - a[2]), b[0] - a[0])),
            new THREE.Vector3(size, height, size),
          ));
        next += spacing;
      }
      walked += seg;
    }
  }
  return out;
}

/** A box `length` long (along `yaw`), ±halfWidth across, `bottom`..`top` relative to `position`. */
export function boxMatrix(position: V3, yaw: number, length: number, halfWidth: number, bottom: number, top: number) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(position[0], position[1] + (bottom + top) / 2, position[2]),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    new THREE.Vector3(length, top - bottom, halfWidth * 2),
  );
}
