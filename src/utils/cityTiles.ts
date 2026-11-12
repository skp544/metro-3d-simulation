import type { CityManifest } from "../data/cityTypes.ts";
import type { Projection } from "./projection.ts";

export const CITY_TILE_LIMIT=48;
/** Budgeted streaming neighbourhood. Overview retains landscape and river, with buildings at local scales. */
export function selectCityTiles(manifest:CityManifest,projection:Projection,target:[number,number],distance:number){
  if(distance>16000)return [];
  const radius=Math.min(4500,Math.max(1500,distance*1.65));
  return manifest.tiles.map(tile=>{
    const a=projection.project(tile.bounds[0]),b=projection.project(tile.bounds[1]);
    const dx=Math.max(Math.min(a[0],b[0])-target[0],0,target[0]-Math.max(a[0],b[0]));
    const dz=Math.max(Math.min(a[1],b[1])-target[1],0,target[1]-Math.max(a[1],b[1]));
    const c=projection.project(tile.center);
    return {tile,edge:Math.hypot(dx,dz),center:Math.hypot(c[0]-target[0],c[1]-target[1])};
  }).filter(t=>t.edge<radius).sort((a,b)=>a.center-b.center).slice(0,CITY_TILE_LIMIT).map(t=>t.tile);
}
