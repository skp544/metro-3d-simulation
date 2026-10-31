// UI state shared by the map, the panels and (later) the 3D view.
import { create } from "zustand";
import type { InfraType, StationType } from "../data/types";

type LngLat = [number, number];

interface MapState {
  hiddenLines: string[];
  hiddenTrackTypes: InfraType[];
  hiddenStationTypes: StationType[];
  showStations: boolean;
  showConstruction: boolean;
  showValidation: boolean;
  // Bumped `key` lets the map re-fly to the same place twice.
  focus: { coordinates: LngLat; key: number } | null;
  toggleLine: (id: string) => void;
  setAllLines: (hidden: string[]) => void;
  toggleTrackType: (t: InfraType) => void;
  toggleStationType: (t: StationType) => void;
  setLayer: (layer: "showStations" | "showConstruction" | "showValidation", on: boolean) => void;
  focusOn: (coordinates: LngLat) => void;
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const useMapStore = create<MapState>((set) => ({
  hiddenLines: [],
  hiddenTrackTypes: [],
  hiddenStationTypes: [],
  showStations: true,
  showConstruction: false, // DECISIONS #3: Phase 4 corridors are off by default
  showValidation: false,
  focus: null,
  toggleLine: (id) => set((s) => ({ hiddenLines: toggle(s.hiddenLines, id) })),
  setAllLines: (hidden) => set({ hiddenLines: hidden }),
  toggleTrackType: (t) => set((s) => ({ hiddenTrackTypes: toggle(s.hiddenTrackTypes, t) })),
  toggleStationType: (t) => set((s) => ({ hiddenStationTypes: toggle(s.hiddenStationTypes, t) })),
  setLayer: (layer, on) => set({ [layer]: on }),
  focusOn: (coordinates) => set((s) => ({ focus: { coordinates, key: (s.focus?.key ?? 0) + 1 } })),
}));
