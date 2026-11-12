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
  // Count all platform frames before filters: hiding a line must not invent a new access layout.
  const sharedIds = new Set(scene.stations.filter(s => s.lineId && scene.stations.filter(o => o.stationId === s.stationId && o.lineId).length > 1).map(s => s.stationId));
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
    // Ballastless track bed; sleepers sit on it (placed near the view only, see sleeperMatrices).
    trackBed: extrudeRect(tracks.map((points) => ({ points, color: plain })), S.plinthHalfWidth, 0, S.sleeper.bottom, upper),
    tracks,
    ballast: extrudeRect(runs.filter((r) => r.type === "at_grade" || r.type === "unknown").map((r) => ({ points: r.points, color: plain })), S.ballastHalfWidth, -0.15, S.sleeper.top - 0.08, upper),
    rails: extrudeRect(rails, S.railHalfWidth, S.sleeper.top, S.railTop, upper),
    // Stations.
    aboveParts: stationParts(aboveStations, colors, sharedIds),
    circulationStations: aboveStations.filter(s => !sharedIds.has(s.stationId) && hasCirculation(s)),
    belowStations: belowStations.map((s) => boxMatrix(s.position, s.yaw!, S.stationLength, S.stationHalfWidth, -S.stationBelowTrack * VE, S.stationAboveTrack * VE)),
    belowStationIds: belowStations.map((s) => s.stationId),
  };
}

/**
 * Above-ground station platforms (one per line at a station), as instanced parts: two side platforms with
 * a yellow edge strip, an open gabled glazed roof on columns with a line-coloured fascia, and, where the track is
 * high enough, a concourse box below. Generic and nominal (DMRC elevated stations mostly have side platforms).
 */
export function stationParts(stations: Station[], colors: Map<string, string>, sharedIds = new Set<string>()): StationPart[] {
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
    const access = hasCirculation(s) && !sharedIds.has(s.stationId);
    const A = S.circulation;
    const outer = access ? A.outer : P.outer;
    const roofWidth = access ? A.roofHalfWidth : R.halfWidth;
    const roofTilt = access ? Math.atan2(R.ridge - R.eave, roofWidth) : tilt;
    for (const side of [1, -1]) {
      const slab = (lo: number, hi: number, start = -L / 2, end = L / 2) => add("platform", "box", PALETTE.platform, s, box({ across: side * (lo + hi) / 2, along: (start + end) / 2, length: end - start, halfWidth: (hi - lo) / 2, bottom: -S.deckSlab, top: P.top }));
      if (access) {
        // A continuous 3 m lane beside the tactile strip, plus two real holes in the outer band.
        const lo = A.wellAcross - A.wellWidth / 2, hi = A.wellAcross + A.wellWidth / 2;
        slab(P.inner, lo); slab(hi, outer);
        let start = -L / 2;
        for (const along of [-A.wellAlong, A.wellAlong]) { slab(lo, hi, start, along - A.wellLength / 2); start = along + A.wellLength / 2; }
        slab(lo, hi, start, L / 2);
      } else slab(P.inner, outer);
      add("edgeStrip", "box", PALETTE.edgeStrip, s, box({ across: side * E.across, length: L, halfWidth: E.halfWidth, bottom: P.top - 0.05, top: P.top + 0.03 }));
      // Roof slab from the ridge (centre line) down to the eave, tilted about the station's long axis.
      add("roof", "box", PALETTE.stationRoof, s, box({ across: (side * roofWidth) / 2, length: L, halfWidth: roofWidth / 2 / Math.cos(roofTilt), bottom: (R.eave + R.ridge) / 2 - R.thickness / 2, top: (R.eave + R.ridge) / 2 + R.thickness / 2, roll: side * roofTilt }));
      add("fascia", "box", "#ffffff", s, box({ across: side * roofWidth, length: L, halfWidth: 0.15, bottom: R.eave - 0.7, top: R.eave + 0.1 }), line);
      for (let i = 0; i < columnsPerSide; i++)
        add("column", "box", PALETTE.column, s, box({ along: (i - (columnsPerSide - 1) / 2) * R.columnSpacing, across: side * (access ? A.columnAcross : R.columnAcross), length: R.columnSize, halfWidth: R.columnSize / 2, bottom: P.top, top: R.eave }));
    }
    // The concourse sits below the platforms, so only under elevated track that leaves room for it.
    const y = s.position[1];
    if (access)
      add("concourse", "box", PALETTE.wall, s, box({ length: L * C.lengthShare, halfWidth: C.halfWidth, bottom: C.bottom - y, top: C.top - y }));
    else if (y - S.deckSlab - S.girderDepth > C.top + 1)
      add("concourse", "box", PALETTE.wall, s, box({ length: L * C.lengthShare, halfWidth: 10, bottom: C.bottom - y, top: C.top - y }));
  }
  return Object.values(parts);
}

/** Eligible for the generic circulation layout; ramps and underground platforms need site-specific plans. */
export function hasCirculation(s: Station) {
  return s.position[1] - S.deckSlab - S.girderDepth > S.concourse.top + 2.5 && s.stationType !== "mixed";
}

/** Local floor/connection metadata for future people. Schematic station-local coordinates, not a surveyed navmesh. */
export function circulationLayout(s: Station) {
  const A = S.circulation, platformY = s.position[1] + S.platform.top;
  const flights = [1, -1].flatMap(side => [-A.wellAlong, A.wellAlong].map(along => ({ side, along, across: side * A.wellAcross, fromY: S.concourse.top, toY: platformY, run: A.stairRun, width: A.wellWidth, steps: Math.ceil((platformY - S.concourse.top) / A.maxRiser) })));
  return { nominal: true, platformY, concourseY: S.concourse.top, groundY: 0, clearLaneWidth: A.clearLaneWidth, flights,
    lifts: [1, -1].map(side => ({ along: A.liftAlong, across: side * A.liftAcross, stops: [0, S.concourse.top, platformY] })),
    lanes: [1, -1].map(side => ({ across: side * A.clearLaneAcross, start: -S.stationLength / 2 + 3, end: S.stationLength / 2 - 3, y: platformY })),
  };
}

/** Nearby station detail only: steps, handrails, external access, lift shafts and furniture. */
export function stationDetailParts(stations: Station[]): StationPart[] {
  const A = S.circulation, C = S.concourse, P = S.platform;
  const parts: Record<string, StationPart> = {};
  for (const s of stations) {
    const layout = circulationLayout(s), y = s.position[1];
    const add = (key: string, color: string, o: LocalBox, opacity?: number) => {
      const p = parts[key] ??= { key, shape: "box", color, matrices: [], ids: [], opacity };
      p.matrices.push(localBox(s.position, s.yaw!, o)); p.ids.push(s.stationId);
    };
    const slab = (key: string, along: number, across: number, length: number, width: number, topY: number) => add(key, PALETTE.platform, { along, across, length, halfWidth: width / 2, bottom: topY - y - .25, top: topY - y });
    for (const along of [-75,-45,-15,15,45,75]) for (const side of [1,-1]) {
      const tilt=Math.atan2(S.roof.ridge-S.roof.eave,A.roofHalfWidth);
      add("roofRafters", PALETTE.column, { along, across:side*A.roofHalfWidth/2, length:.18, halfWidth:A.roofHalfWidth/2/Math.cos(tilt), bottom:(S.roof.eave+S.roof.ridge)/2-.22, top:(S.roof.eave+S.roof.ridge)/2-.05, roll:side*tilt });
    }
    // Open railing posts leave the circulation lane clear; supports sit outboard of it.
    for (const side of [1, -1]) {
      for (let along = -87; along <= 87; along += 6) {
        if (Math.abs(along - A.liftAlong) < 1.5) continue;
        add("guardPosts", PALETTE.column, { along, across: side * (A.outer - .08), length: .09, halfWidth: .045, bottom: P.top, top: P.top + A.railHeight });
      }
      for (const height of [.5, A.railHeight]) for (const [start,end] of [[-90,A.liftAlong-1.5],[A.liftAlong+1.5,90]]) add("guardRails", PALETTE.column, { along:(start+end)/2, across: side * (A.outer - .08), length:end-start, halfWidth: .045, bottom: P.top + height - .04, top: P.top + height + .04 });
      // Concourse support columns stay outside the tracks and the continuous platform lane.
      for (const along of [-48,-24,0,24,48]) add("supports", PALETTE.pillar, { along, across: side * 11.5, length: .7, halfWidth: .35, bottom: -y, top: P.top - .5 });
      for (const along of [-75,75]) {
        add("benches", "#717c84", { along, across: side * 10, length: 4, halfWidth: .35, bottom: P.top + .4, top: P.top + .55 });
        add("benchBack", "#717c84", { along, across: side * 10.3, length: 4, halfWidth: .07, bottom: P.top + .5, top: P.top + 1.1 });
        for (const offset of [-1.5,1.5]) add("benchLegs", PALETTE.column, { along: along+offset, across:side*10, length:.12,halfWidth:.3,bottom:P.top,top:P.top+.4 });
      }
      // Street → concourse stairs outside the station envelope, with a level top landing into the floor.
      const steps = Math.ceil(C.top / A.maxRiser), tread = A.groundStairRun / steps;
      for (let i = 0; i < steps; i++) add("streetSteps", PALETTE.platform, { along: -A.groundStairRun / 2 + (i + .5) * tread, across: side * A.groundStairAcross, length: tread, halfWidth: 1.5, bottom: i * C.top / steps - y - .2, top: (i + 1) * C.top / steps - y });
      slab("streetLanding", A.groundStairRun / 2 + 1.5, side * 14.75, 3, 5.5, C.top);
      for (const edge of [-1,1]) {
        const pos=new THREE.Vector3().setFromMatrixPosition(localBox(s.position,s.yaw!,{along:0,across:side*A.groundStairAcross+edge*1.5,length:1,halfWidth:.5,bottom:C.top/2-y+1,top:C.top/2-y+1}));
        const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),s.yaw!).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.atan2(C.top,A.groundStairRun)));
        const p=parts.streetHandrail ??= {key:"streetHandrail",shape:"box",color:PALETTE.column,matrices:[],ids:[]};
        p.matrices.push(new THREE.Matrix4().compose(pos,q,new THREE.Vector3(Math.hypot(C.top,A.groundStairRun),.1,.1))); p.ids.push(s.stationId);
      }
      // Lift landings connect the outboard shaft to platform and concourse without crossing the tracks.
      for (const level of [C.top, layout.platformY]) slab("liftLanding", A.liftAlong, side * 12.6, 3, 6.4, level);
      slab("concourseWing", 60, side * 10.9, 13, 5.2, C.top);
      add("liftGlass", "#b0cbd4", { along: A.liftAlong, across: side * A.liftAcross, length: A.liftWidth, halfWidth: A.liftWidth / 2, bottom: -y, top: P.top + 3 }, .35);
      for (const along of [A.liftAlong-A.liftWidth/2,A.liftAlong+A.liftWidth/2]) for (const across of [side*A.liftAcross-A.liftWidth/2,side*A.liftAcross+A.liftWidth/2]) add("liftFrame", PALETTE.column, { along, across, length: .13, halfWidth: .065, bottom: -y, top: P.top + 3 });
      // Perimeter on concourse leaves a three-metre opening at the street-stair landing.
      for (const [start,end] of [[-54,6.75],[9.75,54]]) add("concourseGuard", PALETTE.column, { along: (start+end)/2, across: side*C.halfWidth, length: end-start, halfWidth: .06, bottom: C.top-y+.9, top: C.top-y+1.1 });
    }
    for (const f of layout.flights) {
      const tread = f.run / f.steps, rise = (f.toY-f.fromY)/f.steps;
      for (let i=0;i<f.steps;i++) add("platformSteps", PALETTE.platform, { along: f.along-f.run/2+(i+.5)*tread, across: f.across, length: tread, halfWidth: f.width/2, bottom: f.fromY-y+i*rise-.2, top: f.fromY-y+(i+1)*rise });
      // Guard the well's sides; rising handrails follow the stair slope.
      const angle = Math.atan2(f.toY-f.fromY,f.run);
      for (const edge of [-1,1]) {
        const across = f.across + edge*(f.width/2+.04);
        add("wellRails", PALETTE.column, { along: f.along, across, length: A.wellLength, halfWidth: .05, bottom: P.top+.95, top: P.top+1.1 });
        const pos=new THREE.Vector3().setFromMatrixPosition(localBox(s.position,s.yaw!,{along:f.along,across,length:1,halfWidth:.5,bottom:(f.fromY+f.toY)/2-y+1,top:(f.fromY+f.toY)/2-y+1}));
        const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),s.yaw!);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle));
        const p=parts.stairHandrail ??= {key:"stairHandrail",shape:"box",color:PALETTE.column,matrices:[],ids:[]};
        p.matrices.push(new THREE.Matrix4().compose(pos,q,new THREE.Vector3(Math.hypot(f.run,f.toY-f.fromY),.1,.1))); p.ids.push(s.stationId);
      }
      slab("wellBottomLanding", f.along-f.run/2-1.5, f.across, 3, f.width, f.fromY);
      slab("wellTopLanding", f.along+f.run/2+.75, f.across, 1.5, f.width, f.toY);
    }
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

/**
 * Sleeper instance matrices every `spacing` metres along the given track paths, but only within `radius`
 * of `centre` (x, z) and at most `max` of them, so the whole network never needs a million instances.
 * Each sleeper spans its track (across) and is turned to the local heading.
 */
export function sleeperMatrices(tracks: V3[][], centre: [number, number], radius: number, spacing = S.sleeper.spacing, max = 40_000): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const size = new THREE.Vector3(S.sleeper.width, S.sleeper.top - S.sleeper.bottom, S.sleeper.length);
  const [cx, cz] = centre;
  const r2 = radius * radius;
  for (const t of tracks) {
    let next = 0; // distance along this track of the next sleeper
    let walked = 0; // distance along this track to the start of segment i
    for (let i = 1; i < t.length && out.length < max; i++) {
      const [a, b] = [t[i - 1], t[i]];
      const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
      const seg = Math.hypot(dx, dz);
      // Closest point of the segment to the centre: skip the whole segment if it is outside the radius.
      const k = seg > 0 ? Math.min(1, Math.max(0, ((cx - a[0]) * dx + (cz - a[2]) * dz) / (seg * seg))) : 0;
      if ((a[0] + k * dx - cx) ** 2 + (a[2] + k * dz - cz) ** 2 < r2) {
        const q = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(-dz, dx));
        for (; next <= walked + seg && out.length < max; next += spacing) {
          const u = seg > 0 ? (next - walked) / seg : 0;
          const [x, y, z] = [a[0] + u * dx, a[1] + u * (b[1] - a[1]), a[2] + u * dz];
          if ((x - cx) ** 2 + (z - cz) ** 2 < r2) out.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + (S.sleeper.bottom + S.sleeper.top) / 2, z), q, size));
        }
      }
      walked += seg;
      if (next < walked) next += Math.ceil((walked - next) / spacing) * spacing; // keep the spacing across skipped segments
    }
  }
  return out;
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
