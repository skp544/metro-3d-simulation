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
/** Heights are exaggerated so levels stay readable at city scale. */
export const VERTICAL_EXAGGERATION = 4;

export const SCENE_BACKGROUND = "#eef2f6";
export const GROUND_COLOR = "#f8fafc";
export const GROUND_OPACITY = 0.72; // translucent so underground track shows through
export const TRACK_WIDTH_PX = 3;
export const STATION_SIZE_PX = 7;
export const INTERCHANGE_SIZE_PX = 12;

// Structures (Phase 6). NOMINAL metres, typical of twin-track metro, not per-site data. Horizontal sizes are
// real-world; vertical sizes are multiplied by VERTICAL_EXAGGERATION where they are drawn.
export const STRUCTURE = {
  trackHalfWidth: 4, // coloured track ribbon (twin track ≈ 8 m)
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
  levelThreshold: 2, // m (before exaggeration) above/below ground at which a structure starts
};
/** Metres per screen pixel above which the track is drawn as screen-space lines instead of geometry. */
export const LOD_METRES_PER_PIXEL = 3;

export const COLORS = {
  deck: "#d6d3d1",
  pillar: "#a8a29e",
  tunnel: "#334155",
  stationAbove: "#ffffff",
  stationBelow: "#475569",
};
