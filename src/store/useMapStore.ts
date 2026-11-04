// UI state shared by the 2D map, the 3D scene and the panels.
import { create } from "zustand";
import type { InfraType, StationType } from "../data/types";

type LngLat = [number, number];
export type View = "2d" | "3d";
export type Speed = 1 | 2 | 4 | 8;
export type LabelMode = "trains" | "stations" | "all" | "off";
export type CameraCommand = "zoomIn" | "zoomOut" | "network" | "hub";

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
  // Bumped `key` lets the map re-fly to the same place twice.
  focus: { coordinates: LngLat; key: number } | null;
  selectedStationId: string | null;
  labels: LabelMode;
  camera: { command: CameraCommand; key: number } | null;
  // Simulation clock: sim time = simAtBase + (now − realAtBase) × speed while playing.
  playing: boolean;
  speed: Speed;
  clock: { simAtBase: number; realAtBase: number };
  toggleLine: (id: string) => void;
  setAllLines: (hidden: string[]) => void;
  toggleTrackType: (t: InfraType) => void;
  toggleStationType: (t: StationType) => void;
  setLayer: (layer: "showStations" | "showConstruction" | "showValidation" | "showGround", on: boolean) => void;
  focusOn: (coordinates: LngLat) => void;
  selectStation: (id: string | null) => void;
  setLabels: (mode: LabelMode) => void;
  cameraDo: (command: CameraCommand) => void;
  setSpeed: (speed: Speed) => void;
  togglePlay: () => void;
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Simulated seconds (Unix epoch) for the given clock state. */
export const simSeconds = (s: Pick<MapState, "playing" | "speed" | "clock">, now = performance.now()) =>
  s.clock.simAtBase + (s.playing ? ((now - s.clock.realAtBase) / 1000) * s.speed : 0);

export const useMapStore = create<MapState>((set, get) => ({
  // ?view=3d opens (and links to) the 3D view; the #zoom/lat/lng hash belongs to the 2D map.
  view: new URLSearchParams(location.search).get("view") === "3d" ? "3d" : "2d",
  setView: (view) => {
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    history.replaceState(null, "", url);
    set({ view });
  },
  hiddenLines: [],
  hiddenTrackTypes: [],
  hiddenStationTypes: [],
  showStations: true,
  showConstruction: false, // DECISIONS #3: Phase 4 corridors are off by default
  showValidation: false,
  showGround: true,
  focus: null,
  selectedStationId: null,
  labels: "trains",
  camera: null,
  playing: true,
  speed: 1,
  // The simulation starts at the real current time ("LIVE"); trains follow a simulated pattern.
  clock: { simAtBase: Date.now() / 1000, realAtBase: performance.now() },
  toggleLine: (id) => set((s) => ({ hiddenLines: toggle(s.hiddenLines, id) })),
  setAllLines: (hidden) => set({ hiddenLines: hidden }),
  toggleTrackType: (t) => set((s) => ({ hiddenTrackTypes: toggle(s.hiddenTrackTypes, t) })),
  toggleStationType: (t) => set((s) => ({ hiddenStationTypes: toggle(s.hiddenStationTypes, t) })),
  setLayer: (layer, on) => set({ [layer]: on }),
  focusOn: (coordinates) => set((s) => ({ focus: { coordinates, key: (s.focus?.key ?? 0) + 1 } })),
  selectStation: (id) => set({ selectedStationId: id }),
  setLabels: (labels) => set({ labels }),
  cameraDo: (command) => set((s) => ({ camera: { command, key: (s.camera?.key ?? 0) + 1 } })),
  // Re-base the clock on every change so simulated time stays continuous.
  setSpeed: (speed) => set({ speed, clock: { simAtBase: simSeconds(get()), realAtBase: performance.now() } }),
  togglePlay: () => set((s) => ({ playing: !s.playing, clock: { simAtBase: simSeconds(s), realAtBase: performance.now() } })),
}));
