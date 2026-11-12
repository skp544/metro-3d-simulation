// Loads the real OSM surroundings of the stations (built by scripts/build-city.ts) for the 3D view.
import tilesUrl from "../../data/processed/city_tiles.json?url";
import contextUrl from "../../data/processed/city_context.json?url";
import waterUrl from "../../data/processed/city_water.geojson?url";
import type { AreasFC, CityManifest, EnvironmentContext } from "./cityTypes";
export type { City } from "./cityTypes";

const get = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
};

let waterPromise:Promise<AreasFC>|undefined;
export const loadWater=()=>waterPromise??=(get<AreasFC>(waterUrl).catch(e=>{waterPromise=undefined;throw e;}));
async function environment(){
  const [manifest,context,water]=await Promise.all([get<CityManifest>(tilesUrl),get<EnvironmentContext>(contextUrl),loadWater()]);
  return {manifest,context:{...context,water}};
}
let environmentPromise:ReturnType<typeof environment>|undefined;
export const loadEnvironment=()=>environmentPromise??=environment().catch(e=>{environmentPromise=undefined;throw e;});
