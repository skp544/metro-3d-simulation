// UI state shared by the 2D map, the 3D scene and the panels.
import { create } from "zustand";
import type { InfraType, StationType } from "../data/types";

type LngLat = [number, number];
export type View = "2d" | "3d";

interface MapState {
  view: View;
  setView: (view: View) => void;
  hiddenLines: string[];
  hiddenTrackTypes: InfraType[];
  hiddenStationTypes: StationType[];
  showStations: boolean;
  showConstruction: boolean;
  showValidation: boolean;
  showGround: boolean; // 3D: hide the ground to see tunnels clearly
  // Bumped `key` lets the map re-fly to the same place twice.
  focus: { coordinates: LngLat; key: number } | null;
  toggleLine: (id: string) => void;
  setAllLines: (hidden: string[]) => void;
  toggleTrackType: (t: InfraType) => void;
  toggleStationType: (t: StationType) => void;
  setLayer: (layer: "showStations" | "showConstruction" | "showValidation" | "showGround", on: boolean) => void;
  focusOn: (coordinates: LngLat) => void;
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const useMapStore = create<MapState>((set) => ({
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
  toggleLine: (id) => set((s) => ({ hiddenLines: toggle(s.hiddenLines, id) })),
  setAllLines: (hidden) => set({ hiddenLines: hidden }),
  toggleTrackType: (t) => set((s) => ({ hiddenTrackTypes: toggle(s.hiddenTrackTypes, t) })),
  toggleStationType: (t) => set((s) => ({ hiddenStationTypes: toggle(s.hiddenStationTypes, t) })),
  setLayer: (layer, on) => set({ [layer]: on }),
  focusOn: (coordinates) => set((s) => ({ focus: { coordinates, key: (s.focus?.key ?? 0) + 1 } })),
}));
