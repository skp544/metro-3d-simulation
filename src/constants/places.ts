import type { PlaceCategory } from "../data/types.ts";

export const PLACE_CATEGORIES: Record<PlaceCategory, { label: string; plural: string; color: string; fill: string }> = {
  monument: { label: "Monument", plural: "Monuments", color: "#92400e", fill: "#fef3c7" },
  mall: { label: "Mall", plural: "Malls", color: "#6d28d9", fill: "#ede9fe" },
  zoo: { label: "Zoo", plural: "Zoo", color: "#166534", fill: "#dcfce7" },
  religious: { label: "Religious site", plural: "Religious", color: "#9f1239", fill: "#ffe4e6" },
  civic: { label: "Civic landmark", plural: "Civic", color: "#334155", fill: "#e2e8f0" },
};
