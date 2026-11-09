// 3D rendering constants. Heights are NOMINAL (no per-station height/depth data exists; see
// docs/phase1-research-and-plan.md §5.3) and are shown as estimated in the UI.
import type { InfraType } from "../data/types.ts";

/** Track level in metres relative to ground. Unknown has no level: it is interpolated from its neighbours. */
export const LEVEL_HEIGHT: Record<Exclude<InfraType, "unknown">, number> = {
  elevated: 12,
  at_grade: 0,
  underground: -15,
};
/** Half the length of the ramp where the track changes level (800 m total ≈ 3.4% grade underground↔elevated). */
export const RAMP_HALF_KM = 0.4;
/**
 * True scale since the low-poly restyle (DECISIONS #42): trains, trees and OSM buildings have real
 * proportions, so structures must too. (Was ×4 for the Phase 5/6 overview look.)
 */
export const VERTICAL_EXAGGERATION = 1;

// Low-poly palette, matched to ref_image.png: warm light ground, cream buildings, soft shadows.
export const PALETTE = {
  background: "#e7e2da",
  ground: "#dcd6cc",
  road: "#c9c3b8",
  green: "#c3d19f",
  wall: "#f5f2ec",
  roof: "#e6e1d7",
  deck: "#d4d0c9", // concrete
  pillar: "#bdb7ad",
  plinth: "#a8a299",
  ballast: "#b3a896",
  rail: "#6e737a",
  platform: "#d9d4cb",
  edgeStrip: "#e2b31b",
  stationRoof: "#dfe8ee", // light glazing
  column: "#9ea4ab",
  tunnel: "#334155",
  stationAbove: "#ffffff",
  stationBelow: "#475569",
  sun: "#fff3e0",
  sky: "#ffffff",
  bounce: "#c8c0b2",
};
export const TRACK_WIDTH_PX = 3;
export const STATION_SIZE_PX = 7;
export const INTERCHANGE_SIZE_PX = 12;

// Structures (Phase 6). NOMINAL metres, typical of twin-track metro, not per-site data.
// Nominal sizes (m) of a generic DMRC-style twin-track viaduct and elevated station. DMRC publishes no
// per-station drawings, so these are typical values, not measurements (DECISIONS #57).
// Vertical values are relative to the track line, which the height profile places.
export const STRUCTURE = {
  // Viaduct: deck slab on a narrower box girder, single round piers with a cap across the track.
  deckHalfWidth: 5, // ≈ 10 m twin-track deck
  deckSlab: 0.5,
  girderHalfWidth: 2.8,
  girderDepth: 1.8,
  parapetHeight: 1.1,
  parapetHalfThickness: 0.15,
  pillarSpacing: 30,
  pillarSize: 2, // pier diameter
  pierCap: { along: 2.2, across: 6.4, depth: 1 },
  // Track: two tracks, each a concrete plinth with two rails; ballast where the track is at grade.
  trackSpacing: 4, // between track centres; trains run on the left one (TRAIN.trackOffset = half this)
  plinthHalfWidth: 1.3,
  plinthHeight: 0.5,
  railHalfGauge: 0.75,
  railHalfWidth: 0.09,
  ballastHalfWidth: 4.2,
  railTop: 0.8, // rail head above the track line; trains stand on it
  // Tunnels.
  tunnelHalfWidth: 6.5, // twin bored tunnels ≈ 13 m overall
  tunnelHalfHeight: 3.5,
  // Elevated station: two side platforms, an open gabled roof on columns, a concourse below.
  stationLength: 180, // 8-car platform
  platform: { inner: 3.8, outer: 8.2, top: 1.9 }, // across from the track centre line; top = rail + 1.1 m
  edgeStrip: { across: 4.1, halfWidth: 0.3 }, // yellow tactile strip near the platform edge
  roof: { halfWidth: 10, eave: 7.4, ridge: 8.9, thickness: 0.35, columnAcross: 7.8, columnSpacing: 15, columnSize: 0.5, opacity: 0.45 }, // glazed, like the reference's see-through roof
  concourse: { halfWidth: 10, bottom: 4, top: 7.5, lengthShare: 0.6 }, // absolute heights above ground
  stationHalfWidth: 13, // underground station boxes (X-ray)
  stationBelowTrack: 4,
  stationAboveTrack: 6,
  levelThreshold: 2, // m above/below ground at which a structure starts
};
/** Metres per screen pixel above which the track is drawn as screen-space lines instead of geometry. */
export const LOD_METRES_PER_PIXEL = 3;

// Trains (simulated service, DECISIONS #44). NOMINAL values typical of DMRC operation, not a timetable.
export const TRAIN = {
  cars: 6,
  carLength: 21.6, // m (DMRC broad-gauge car, nominal)
  carWidth: 3.2,
  carHeight: 3.9,
  cruiseKmh: 45, // with dwell ≈ 34 km/h average, close to DMRC's reported average speed
  dwellS: 30,
  terminalDwellS: 180,
  headwayS: 360, // one train every 6 min per direction
  trackOffset: 2, // m left of the centreline: Indian Railways/DMRC run on the left track
  labelRadiusM: 1500, // labels only for trains this close to the view target
  maxLabels: 16,
};

export const SHADOW = { size: 900, mapSize: 2048 }; // shadow camera half-size (m) around the view target
