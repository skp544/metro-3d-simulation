// UI state shared by the 2D map, the 3D scene and the panels.
import { create } from "zustand";
import type { InfraType, StationType } from "../data/types";
import { controlTrains, type TrainControls } from "../utils/trainControl";
import type { UndergroundMode } from "../utils/underground";
export { groundVisible, type UndergroundMode } from "../utils/underground";

type LngLat = [number, number];
export type View = "2d" | "3d";
export type Speed = 1 | 2 | 4 | 8;
export type LabelMode = "trains" | "stations" | "all" | "off";
export type CameraCommand =
  | "zoomIn"
  | "zoomOut"
  | "network"
  | "hub"
  | "low"
  | "oblique";
/** The view in 2D terms (centre + Leaflet zoom + viewport height): what both views write and read so a switch keeps the place. */
export type SharedView = { center: LngLat; zoom: number; heightPx: number };
/**
 * Last view of whichever map is showing. Deliberately not store state: the 3D view writes it several times a
 * second and nothing re-renders on it; a view reads it once, when it mounts. Null until a view has reported.
 */
export const viewHandoff: { current: SharedView | null } = { current: null };

interface MapState {
  view: View;
  setView: (view: View) => void;
  hiddenLines: string[];
  hiddenTrackTypes: InfraType[];
  hiddenStationTypes: StationType[];
  showStations: boolean;
  showConstruction: boolean;
  showValidation: boolean;
  showGround: boolean; // 3D: hide the ground to see tunnels and underground trains
  showWater: boolean;
  // Bumped `key` lets the map re-fly to the same place twice.
  focus: {
    coordinates: LngLat;
    key: number;
    distanceM?: number;
    heightM?: number;
  } | null;
  selectedLandmarkId: string | null;
  selectLandmark: (id: string | null) => void;
  selectedStationId: string | null;
  labels: LabelMode;
  camera: { command: CameraCommand; key: number } | null;
  // Fit both views to a box ([south-west, north-east] as lng/lat), e.g. a planned route.
  fit: { bounds: [LngLat, LngLat]; key: number } | null;
  // 3D: keep the camera on this simulated train until the user pans or stops it.
  follow: { trainId: string; key: number } | null;
  // Route highlight between two stations (the start of the journey planner).
  routeFrom: string | null;
  routeTo: string | null;
  // Simulation clock: sim time = simAtBase + (now − realAtBase) × speed while playing.
  playing: boolean;
  speed: Speed;
  clock: { simAtBase: number; realAtBase: number };
  toggleLine: (id: string) => void;
  setAllLines: (hidden: string[]) => void;
  toggleTrackType: (t: InfraType) => void;
  toggleStationType: (t: StationType) => void;
  setLayer: (
    layer:
      | "showStations"
      | "showConstruction"
      | "showValidation"
      | "showGround"
      | "showWater",
    on: boolean,
  ) => void;
  focusOn: (coordinates: LngLat, distanceM?: number, heightM?: number) => void;
  fitTo: (bounds: [LngLat, LngLat]) => void;
  followTrain: (trainId: string | null) => void;
  setRouteEnd: (end: "from" | "to", stationId: string | null) => void;
  swapRoute: () => void;
  selectStation: (id: string | null) => void;
  setLabels: (mode: LabelMode) => void;
  cameraDo: (command: CameraCommand) => void;
  setSpeed: (speed: Speed) => void;
  togglePlay: () => void;
}

const toggle = <T>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

/** Simulated seconds (Unix epoch) for the given clock state. */
export const simSeconds = (
  s: Pick<MapState, "playing" | "speed" | "clock">,
  now = performance.now(),
) =>
  s.clock.simAtBase +
  (s.playing ? ((now - s.clock.realAtBase) / 1000) * s.speed : 0);

const routeParam = (new URLSearchParams(location.search).get("route") ?? "")
  .split(",")
  .filter(Boolean);
const undergroundParam = new URLSearchParams(location.search).get(
  "underground",
);

// Keep follow command keys monotonic even after stopping, so useCommand does not discard a new follow.
let followKey = 0;

export const useMapStore = create<MapState>((set, get) => ({
  // ?view=3d opens (and links to) the 3D view; the #zoom/lat/lng hash belongs to the 2D map.
  view: new URLSearchParams(location.search).get("view") === "3d" ? "3d" : "2d",
  setView: (view) => {
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    history.replaceState(null, "", url);
    // Following a train is 3D-only (the 2D map has no trains).
    set({ view, ...(view === "2d" && { follow: null }) });
  },
  hiddenLines: [],
  hiddenTrackTypes: [],
  hiddenStationTypes: [],
  showStations: true,
  showConstruction: false, // DECISIONS #3: Phase 4 corridors are off by default
  showValidation: false,
  showGround: true,
  showWater: true,
  focus: null,
  selectedStationId: null,
  selectedLandmarkId: null,
  labels: "trains",
  camera: null,
  fit: null,
  follow: null,
  // ?route=<fromStationId>,<toStationId> opens with a route highlighted (shareable; used for visual checks).
  routeFrom: routeParam[0] ?? null,
  routeTo: routeParam[1] ?? null,
  playing: true,
  speed: 1,
  // The simulation starts at the real current time; trains follow a nominal simulated pattern.
  clock: { simAtBase: Date.now() / 1000, realAtBase: performance.now() },
  toggleLine: (id) => set((s) => ({ hiddenLines: toggle(s.hiddenLines, id) })),
  setAllLines: (hidden) => set({ hiddenLines: hidden }),
  toggleTrackType: (t) =>
    set((s) => ({ hiddenTrackTypes: toggle(s.hiddenTrackTypes, t) })),
  toggleStationType: (t) =>
    set((s) => ({ hiddenStationTypes: toggle(s.hiddenStationTypes, t) })),
  setLayer: (layer, on) => set({ [layer]: on }),
  // Moving the view somewhere else ends a train follow.
  focusOn: (coordinates, distanceM, heightM) =>
    set((s) => ({
      focus: { coordinates, distanceM, heightM, key: (s.focus?.key ?? 0) + 1 },
      follow: null,
    })),
  fitTo: (bounds) =>
    set((s) => ({ fit: { bounds, key: (s.fit?.key ?? 0) + 1 }, follow: null })),
  followTrain: (trainId) =>
    set({ follow: trainId ? { trainId, key: ++followKey } : null }),
  setRouteEnd: (end, stationId) =>
    set(end === "from" ? { routeFrom: stationId } : { routeTo: stationId }),
  swapRoute: () => set((s) => ({ routeFrom: s.routeTo, routeTo: s.routeFrom })),

  selectStation: (id) =>
    set({ selectedStationId: id, ...(id && { selectedLandmarkId: null }) }),
  selectLandmark: (id) =>
    set({ selectedLandmarkId: id, ...(id && { selectedStationId: null }) }),
  setLabels: (labels) => set({ labels }),
  // Zooming keeps a follow going; jumping to the hub or the whole network ends it.
  cameraDo: (command) =>
    set((s) => ({
      camera: { command, key: (s.camera?.key ?? 0) + 1 },
      ...((command === "hub" || command === "network") && { follow: null }),
    })),
  // Re-base the clock on every change so simulated time stays continuous.
  setSpeed: (speed) =>
    set({
      speed,
      clock: { simAtBase: simSeconds(get()), realAtBase: performance.now() },
    }),
  togglePlay: () =>
    set((s) => ({
      playing: !s.playing,
      clock: { simAtBase: simSeconds(s), realAtBase: performance.now() },
    })),
}));
