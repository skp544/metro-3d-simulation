// Loads the real OSM surroundings of the stations (built by scripts/build-city.ts) for the 3D view.
import buildingsUrl from "../../data/processed/city_buildings.geojson?url";
import roadsUrl from "../../data/processed/city_roads.geojson?url";
import greenUrl from "../../data/processed/city_green.geojson?url";
import treesUrl from "../../data/processed/city_trees.geojson?url";
import type { FeatureCollection, LineString, Point, Polygon } from "geojson";

export interface City {
  buildings: FeatureCollection<Polygon, { id: string; kind: string; height: number; heightSource: string }>;
  roads: FeatureCollection<LineString, { id: string; class: string; width: number }>;
  green: FeatureCollection<Polygon, { id: string; kind: string }>;
  trees: FeatureCollection<Point, { variant: number; area: string }>;
}

const get = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
};

export async function loadCity(): Promise<City> {
  const [buildings, roads, green, trees] = await Promise.all([get<City["buildings"]>(buildingsUrl), get<City["roads"]>(roadsUrl), get<City["green"]>(greenUrl), get<City["trees"]>(treesUrl)]);
  return { buildings, roads, green, trees };
}
