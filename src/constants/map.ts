// Rendering constants only: no coordinates, stations or line colours (those come from data/).
import type { InfraType, Severity, StationType } from "../data/types";

export const BASE_LAYERS = [
  {
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    name: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    // For the visual review of track type and station position against imagery.
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
] as const;

export const DATA_ATTRIBUTION =
  'Metro data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL), checked against Wikipedia (CC BY-SA)';

// Track type is shown by line style; colour always stays the line's colour.
export const TRACK_STYLE: Record<InfraType, { dashArray?: string; weight: number; opacity: number; label: string }> = {
  elevated: { weight: 5, opacity: 1, label: "Elevated" },
  underground: { dashArray: "8 6", weight: 4, opacity: 0.9, label: "Underground" },
  at_grade: { dashArray: "1 8", weight: 5, opacity: 1, label: "At-grade" },
  unknown: { dashArray: "2 4", weight: 2, opacity: 0.7, label: "Unknown" },
};
// Draw order: underground beneath, elevated on top.
export const TRACK_ORDER: InfraType[] = ["underground", "unknown", "at_grade", "elevated"];

export const STATION_TYPE_LABEL: Record<StationType, string> = {
  elevated: "Elevated",
  underground: "Underground",
  at_grade: "At-grade",
  mixed: "Mixed (interchange)",
  unknown: "Unknown",
};

export const SEVERITY_COLOR: Record<Severity, string> = { error: "#dc2626", warning: "#f59e0b", info: "#2563eb" };

// DECISIONS #1: other rail systems in the Delhi area are out of scope for now and appear in the UI only as
// "work in progress". Names and search words only: no stations, geometry or colours.
export const WORK_IN_PROGRESS_SYSTEMS: { name: string; keywords: string[] }[] = [
  { name: "Rapid Metro Gurugram", keywords: ["rapid metro", "gurugram rapid", "gurgaon rapid"] },
  { name: "Noida Metro Aqua Line", keywords: ["aqua", "noida metro", "nmrc"] },
  { name: "Namo Bharat (RapidX)", keywords: ["namo bharat", "rapidx", "rrts"] },
];
