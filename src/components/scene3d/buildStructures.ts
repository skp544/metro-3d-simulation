// Pure geometry builders for 3D structures: rectangular extrusions along a track, pillar and station
// placements, and buildStructures() which assembles the whole network's structures for <Structures>.
// Explicit .ts imports: this module is also loaded directly by Node's test runner.
import * as THREE from "three";
import { COLORS, STRUCTURE as S, VERTICAL_EXAGGERATION as VE } from "../../constants/scene.ts";
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

/** Everything <Structures> draws, for the lines, track types and stations the filters leave visible. */
export function buildStructures(scene: Scene3DData, colors: Map<string, string>, f: StructureFilters) {
  const rgb = (lineId: string) => new THREE.Color(colors.get(lineId)).toArray() as RGB;
  const paths = scene.paths.filter((p) => !f.hiddenLines.includes(p.lineId));
  const level = S.levelThreshold * VE;
  const above = paths.flatMap((p) => spansWhere(p.points, (y) => y > level).map((points) => ({ points, color: rgb(p.lineId) })));
  const below = paths.flatMap((p) => spansWhere(p.points, (y) => y < -level).map((points) => ({ points, color: rgb(p.lineId) })));
  const all: Face[] = ["top", "bottom", "left", "right"];
  const showElevated = !f.hiddenTrackTypes.includes("elevated");
  const showUnderground = !f.hiddenTrackTypes.includes("underground");

  const stations = scene.stations.filter(
    (s) => f.showStations && s.lineId !== null && !f.hiddenLines.includes(s.lineId) && !f.hiddenStationTypes.includes(s.stationType as StationType),
  );
  const box = (s: (typeof stations)[number]) =>
    boxMatrix(s.position, s.yaw!, S.stationLength, S.stationHalfWidth, -S.stationBelowTrack * VE, S.stationAboveTrack * VE);
  const aboveStations = stations.filter((s) => s.position[1] >= -level);
  const belowStations = stations.filter((s) => s.position[1] < -level);
  const white = new THREE.Color(COLORS.stationAbove);

  return {
    deck: showElevated ? extrudeRect(above, S.deckHalfWidth, -S.deckDepth * VE, -0.3, all) : null,
    pillars: showElevated ? pillarMatrices(above.map((s) => s.points), S.pillarSpacing, S.pillarSize, S.deckDepth * VE, level) : [],
    tunnel: showUnderground ? extrudeRect(below, S.tunnelHalfWidth, -S.tunnelHalfHeight * VE, S.tunnelHalfHeight * VE, all) : null,
    ribbon: extrudeRect(
      scene.runs.filter((r) => !f.hiddenLines.includes(r.lineId) && !f.hiddenTrackTypes.includes(r.type)).map((r) => ({ points: r.points, color: rgb(r.lineId) })),
      S.trackHalfWidth,
      0,
      0.8,
      ["top", "left", "right"],
    ),
    aboveStations: aboveStations.map(box),
    // Above-ground station roofs are white, tinted 30% toward their line colour.
    aboveColors: aboveStations.map((s) => white.clone().lerp(new THREE.Color(colors.get(s.lineId!)), 0.3)),
    belowStations: belowStations.map(box),
  };
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
    // Horizontal left-hand normal from the averaged neighbour direction.
    const left = points.map((_, i) => {
      const [a, b] = [points[Math.max(0, i - 1)], points[Math.min(points.length - 1, i + 1)]];
      const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
      const len = Math.hypot(dx, dz) || 1;
      return [dz / len, -dx / len];
    });
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

/** Pillar instance matrices every `spacing` metres along elevated spans, from the ground to under the deck. */
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
        if (height > minHeight)
          out.push(new THREE.Matrix4().compose(
            new THREE.Vector3(a[0] + t * (b[0] - a[0]), height / 2, a[2] + t * (b[2] - a[2])),
            new THREE.Quaternion(),
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
