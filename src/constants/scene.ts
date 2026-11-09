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
  deck: "#d4d0c9",
  pillar: "#bdb7ad",
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
export const STRUCTURE = {
  trackHalfWidth: 4, // coloured guideway (twin track ≈ 8 m)
  deckHalfWidth: 5.5, // viaduct deck ≈ 11 m
  deckDepth: 2,
  pillarSpacing: 30,
  pillarSize: 2.5,
  tunnelHalfWidth: 6.5, // twin bored tunnels ≈ 13 m overall
  tunnelHalfHeight: 3.5,
  stationLength: 180, // 8-car platform
  stationHalfWidth: 13,
  stationBelowTrack: 4, // elevated: concourse below the platform
  stationAboveTrack: 6, // roof above the rails
  levelThreshold: 2, // m above/below ground at which a structure starts
  railTop: 0.8, // guideway surface above the track line; trains stand on it
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
