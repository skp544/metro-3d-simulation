import type { FeatureCollection, LineString, MultiPolygon, Point, Polygon } from "geojson";
import type { Provenance } from "./types.ts";

export interface BuildingProps extends Provenance {
  id: string; kind: string; height: number; heightSource: string;
  levels: number; roofShape: string; roofHeight: number; color?: string;
  facadeStyle?: "plain" | "historic";
}
export interface RoadProps extends Provenance {
  id: string; class: string; width: number; oneway: boolean; bridge: boolean; name: string;
}
export interface AreaProps extends Provenance { id: string; kind: string; name: string }
export interface TreeProps extends Provenance { variant: number; area: string }
export interface City {
  buildings: FeatureCollection<Polygon | MultiPolygon, BuildingProps>;
  roads: FeatureCollection<LineString, RoadProps>;
  green: FeatureCollection<Polygon | MultiPolygon, AreaProps>;
  trees: FeatureCollection<Point, TreeProps>;
}
export type AreasFC = FeatureCollection<Polygon | MultiPolygon, AreaProps>;
export interface EnvironmentContext { land: AreasFC; water: AreasFC; roads: City["roads"] }
export interface CityTile {
  id: string; url: string; center: [number, number]; bounds: [[number, number], [number, number]];
  buildings: number; trees: number; bytes: number;
}
export interface CityManifest { version: string; tileSizeM: number; tiles: CityTile[] }
