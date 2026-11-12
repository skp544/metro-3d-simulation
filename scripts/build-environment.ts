// Offline OSM snapshots → continuous landscape + streamable 1 km city tiles. Rail data is untouched.
import { mkdir, readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Feature, Polygon, MultiPolygon, LineString, Point } from "geojson";
import type { City, CityManifest, BuildingProps, RoadProps, AreaProps, TreeProps, AreasFC, EnvironmentContext } from "../src/data/cityTypes.ts";
import { boundsCentre, createProjection } from "../src/utils/projection.ts";
import { osmArea, pointInRing, ringCoordinates, type OSMElement } from "./environmentGeometry.ts";

const read=async(p:string)=>JSON.parse(await readFile(p,"utf8"));
const latest=(await readdir("data/raw/environment")).filter(n=>/^\d{4}-\d{2}-\d{2}$/.test(n)).sort().at(-1);
if(!latest)throw new Error("Capture environment snapshots first: npm run data:fetch-environment");
const rawFiles=(await readdir(`data/raw/environment/${latest}`)).filter(n=>n.endsWith(".json")).sort();
const baseline="data/raw/osm-city/2026-11-04.json";
const files=[baseline,...rawFiles.map(n=>`data/raw/environment/${latest}/${n}`)];
const elements=new Map<string,OSMElement & { snapshot:string; file:string }>();
const sources:{file:string;snapshot:string}[]=[];
for(const file of files){
  const raw=await read(file),snapshot=raw.osm3s.timestamp_osm_base;
  sources.push({file,snapshot});
  for(const e of raw.elements as OSMElement[])elements.set(`${e.type}/${e.id}`,{...e,snapshot,file});
}
const all=[...elements.values()];
const provenance=(e:typeof all[number],estimated=false)=>({source:[`osm:${e.type}/${e.id}`,`${e.file}@${e.snapshot}`],verified:false,estimated,conflicts:[] as string[]});
const fc=<G extends Polygon|MultiPolygon|LineString|Point,P>(features:Feature<G,P>[])=>({type:"FeatureCollection" as const,features});
const polygons=(g:Polygon|MultiPolygon)=>g.type==="Polygon"?[g.coordinates]:g.coordinates;
const inside=(p:number[],g:Polygon|MultiPolygon)=>polygons(g).some(r=>pointInRing(p,r[0])&&!r.slice(1).some(h=>pointInRing(p,h)));
const projection=createProjection(boundsCentre(await read("data/processed/metro_lines.geojson")));
const area=(g:Polygon|MultiPolygon)=>polygons(g).reduce((sum,rs)=>sum+rs.reduce((s,r,j)=>{
  const p=r.map(q=>projection.project(q as [number,number]));let a=0;
  for(let i=1;i<p.length;i++)a+=p[i-1][0]*p[i][1]-p[i][0]*p[i-1][1];
  return s+(j===0?1:-1)*Math.abs(a/2);
},0),0);
const rng=(seed:number)=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
const nominal:Record<string,number>={house:7,detached:7,residential:12,apartments:15,commercial:12,retail:8,office:15,industrial:9,warehouse:9,school:10,college:12,university:12,hospital:15,hotel:18,roof:4,garage:3,garages:3,shed:3,hut:3,temple:10,mosque:12,church:12,yes:9};
const metres=(s:string|undefined)=>{const n=parseFloat(s??"");return /ft|feet|'/.test(s??"")?n*.3048:n;};
const buildings:City["buildings"]["features"]=[],roads:City["roads"]["features"]=[];
const land:AreasFC["features"]=[],water:AreasFC["features"]=[],green:AreasFC["features"]=[];
const heightSources:Record<string,number>={"osm:height":0,"osm:levels":0,nominal:0};
const issues:{source:string;reason:string}[]=[];
const isWater=(t:Record<string,string>)=>t.natural==="water"||t.waterway==="riverbank";
const areaKind=(t:Record<string,string>)=>isWater(t)?(t.water??"water"):(t.leisure??t.landuse??t.natural);
const memberWays=new Set<number>();
for(const e of [...all.filter(e=>e.type==="relation"),...all.filter(e=>e.type==="way")]){
  const t=e.tags??{},kind=areaKind(t);
  if(!kind||t.building||t.highway||(e.type==="way"&&memberWays.has(e.id)))continue;
  try{
    const geometry=osmArea(e);if(!geometry)continue;
    const f:Feature<Polygon|MultiPolygon,AreaProps>={type:"Feature",geometry,properties:{...provenance(e),id:`osm:${e.type}/${e.id}`,kind,name:t["name:en"]??t.name??""}};
    if(isWater(t))water.push(f);else{
      land.push(f);
      if(["park","garden","forest","wood","grass","grassland","scrub","recreation_ground","meadow","orchard","golf_course","pitch","playground","village_green"].includes(kind))green.push(f);
    }
    if(e.type==="relation")for(const m of e.members??[])if(m.type==="way")memberWays.add(m.ref);
  }catch(error){issues.push({source:`osm:${e.type}/${e.id}`,reason:String(error)});}
}
const widths:Record<string,number>={motorway:22,trunk:20,primary:16,secondary:12,tertiary:9,motorway_link:8,trunk_link:8,primary_link:8,secondary_link:7,tertiary_link:6,residential:6,unclassified:6,service:3.8,living_street:4,pedestrian:4,footway:2,path:1.6,cycleway:2,steps:1.5};
for(const e of all){
  const t=e.tags??{};if(e.type!=="way"||!e.geometry)continue;
  if(t.building&&!['transportation','train_station'].includes(t.building)&&t.railway!=="station"&&t.public_transport!=="station"){
    const geometry=osmArea(e);if(!geometry)continue;
    const tagged=metres(t.height),levels=parseFloat(t['building:levels']??'');
    const heightSource=tagged>0?"osm:height":levels>0?"osm:levels":"nominal";
    const height=tagged>0?tagged:levels>0?levels*3.2:(nominal[t.building]??9)*(.75+rng(e.id)()*.5);
    heightSources[heightSource]++;
    const properties:BuildingProps={...provenance(e,heightSource==="nominal"),id:`osm:way/${e.id}`,kind:t.building,height:Math.round(Math.min(height,250)*10)/10,heightSource,levels:levels>0?levels:Math.max(1,Math.round(height/3.2)),roofShape:t['roof:shape']??'flat',roofHeight:metres(t['roof:height'])||0,color:t['building:colour']};
    buildings.push({type:"Feature",geometry,properties});
  }
  if(t.highway&&widths[t.highway]&&t.tunnel!=="yes"&&t.area!=="yes"&&e.geometry.length>1){
    const measured=metres(t.width),lanes=parseFloat(t.lanes??''),oneway=t.oneway==="yes"||t.oneway==="-1";
    const width=Math.min(40,Math.max(1,measured>0?measured:lanes>0?lanes*3.2+.6:widths[t.highway]*(oneway&&widths[t.highway]>=9?.55:1)));
    const coordinates=ringCoordinates(e.geometry);if(t.oneway==="-1")coordinates.reverse();
    const properties:RoadProps={...provenance(e,!(measured>0)),id:`osm:way/${e.id}`,class:t.highway,width,oneway,bridge:t.bridge==="yes",name:t["name:en"]??t.name??""};
    roads.push({type:"Feature",geometry:{type:"LineString",coordinates},properties});
  }
}
// Big areas first: mapped parks / local land use can then overlay their containing district.
land.sort((a,b)=>area(b.geometry)-area(a.geometry));
const trees:City["trees"]["features"]=[],occupied=new Set<string>();
// Spatial index prevents decorative trees from growing through mapped buildings and streets.
const index=new Map<string,{bounds:number[];contains:(p:number[])=>boolean}[]>();
const put=(bounds:number[],contains:(p:number[])=>boolean)=>{
  const [minX,minZ,maxX,maxZ]=bounds;
  for(let x=Math.floor(minX/200);x<=Math.floor(maxX/200);x++)for(let z=Math.floor(minZ/200);z<=Math.floor(maxZ/200);z++){
    const key=`${x},${z}`;index.set(key,[...(index.get(key)??[]),{bounds,contains}]);
  }
};
for(const b of buildings){
  const coords=polygons(b.geometry).flat(2).map(p=>projection.project(p as [number,number]));
  const xs=coords.map(p=>p[0]),zs=coords.map(p=>p[1]);
  put([Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)],p=>inside(projection.unproject(p as [number,number]),b.geometry));
}
for(const road of roads){
  const pts=road.geometry.coordinates.map(p=>projection.project(p as [number,number])),half=road.properties.width/2+1.5;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz;if(!len2)continue;
    put([Math.min(a[0],b[0])-half,Math.min(a[1],b[1])-half,Math.max(a[0],b[0])+half,Math.max(a[1],b[1])+half],p=>{const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/len2));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz)<half;});
  }
}
for(const g of green){
  if(!["wood","forest","park","garden","orchard","recreation_ground"].includes(g.properties.kind))continue;
  const ring=polygons(g.geometry).flatMap(p=>p[0]);
  const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const wooded=["wood","forest"].includes(g.properties.kind),want=Math.min(wooded?1600:500,Math.floor(area(g.geometry)/(wooded?140:260)));
  const seed=Number(g.properties.id.split('/')[1]),rand=rng(seed);
  for(let tries=0,placed=0;placed<want&&tries<want*30;tries++){
    const p:[number,number]=[minX+rand()*(maxX-minX),minY+rand()*(maxY-minY)];if(!inside(p,g.geometry))continue;
    const [x,z]=projection.project(p),key=`${Math.floor(x/7)},${Math.floor(z/7)}`;if(occupied.has(key))continue;
    if((index.get(`${Math.floor(x/200)},${Math.floor(z/200)}`)??[]).some(b=>x>=b.bounds[0]&&z>=b.bounds[1]&&x<=b.bounds[2]&&z<=b.bounds[3]&&b.contains([x,z])))continue;
    occupied.add(key);placed++;
    const properties:TreeProps={...g.properties,source:g.properties.source,estimated:true,variant:rand()<.05?Math.floor(rand()*2):2+Math.floor(rand()*2),area:g.properties.id};
    trees.push({type:"Feature",geometry:{type:"Point",coordinates:p.map(n=>Math.round(n*1e6)/1e6)},properties});
  }
}
const city:City={buildings:fc(buildings),roads:fc(roads),green:fc(green),trees:fc(trees)};
for(const [name,data]of Object.entries(city))await writeFile(`data/processed/city_${name}.geojson`,JSON.stringify(data));
const waterFC=fc(water);await writeFile("data/processed/city_water.geojson",JSON.stringify(waterFC));
const context:EnvironmentContext={land:fc(land),water:waterFC,roads:fc(roads.filter(f=>["motorway","trunk","primary","secondary","tertiary","motorway_link","trunk_link","primary_link","secondary_link","tertiary_link"].includes(f.properties.class)))};
// Water is loaded separately by both views, avoiding a landscape download in 2D.
await writeFile("data/processed/city_context.json",JSON.stringify({...context,water:fc<Polygon|MultiPolygon,AreaProps>([])}));
const tileSizeM=1000,tiles=new Map<string,City>();
const tile=(p:number[])=>{
  const [x,z]=projection.project(p as [number,number]),id=`${Math.floor(x/tileSizeM)}_${Math.floor(z/tileSizeM)}`;
  if(!tiles.has(id))tiles.set(id,{buildings:fc<Polygon|MultiPolygon,BuildingProps>([]),roads:fc<LineString,RoadProps>([]),green:fc<Polygon|MultiPolygon,AreaProps>([]),trees:fc<Point,TreeProps>([])});
  return tiles.get(id)!;
};
for(const f of buildings)tile(polygons(f.geometry)[0][0][0]).buildings.features.push(f);
// Roads can cross multiple tiles. Register in every touched tile; renderer deduplicates by OSM id.
for(const f of roads){
  const ids=new Set<City>();const pts=f.geometry.coordinates.map(p=>projection.project(p as [number,number]));
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/400));for(let j=0;j<=n;j++)ids.add(tile(projection.unproject([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n])));}
  for(const t of ids)t.roads.features.push(f);
}
for(const f of trees)tile(f.geometry.coordinates).trees.features.push(f);
await mkdir("public/city",{recursive:true});
let previous:CityManifest|undefined;try{previous=await read("data/processed/city_tiles.json");}catch{}
const manifest:CityManifest={version:latest!,tileSizeM,tiles:[]};
for(const [id,t]of tiles){
  const [x,z]=id.split('_').map(Number),body=JSON.stringify(t),hash=createHash('sha256').update(body).digest('hex').slice(0,10),url=`/city/${id}.${hash}.json`;
  await writeFile(`public${url}`,body);
  manifest.tiles.push({id,url,center:projection.unproject([(x+.5)*tileSizeM,(z+.5)*tileSizeM]),bounds:[projection.unproject([x*tileSizeM,(z+1)*tileSizeM]),projection.unproject([(x+1)*tileSizeM,z*tileSizeM])],buildings:t.buildings.features.length,trees:t.trees.features.length,bytes:Buffer.byteLength(body)});
}
await writeFile("data/processed/city_tiles.json",JSON.stringify(manifest));
const liveUrls=new Set(manifest.tiles.map(t=>t.url));
for(const t of previous?.tiles??[])if(!liveUrls.has(t.url)&&/^\/city\/-?\d+_-?\d+\.[0-9a-f]+\.json$/.test(t.url))await unlink(`public${t.url}`).catch(()=>{});
const report={generatedAt:new Date().toISOString(),sources,counts:{buildings:buildings.length,roads:roads.length,greenAreas:green.length,trees:trees.length,landAreas:land.length,waterAreas:water.length,tiles:tiles.size},buildingHeightSources:heightSources,issues,notes:["Station context expanded to 650 m; landmark districts to 2.3 km. Continuous arterial roads, real land-use and water across network bounds.","Geometry from OSM; untagged heights/road widths and facade details nominal. Trees decorative inside mapped green areas, excluded from mapped buildings/roads.","Multipolygon islands and courtyards retained. Incomplete source rings omitted and logged, never joined by invented edges.","City tiles stream near the camera; water and background landscape are shared static context. No rail geography changes."]};
await writeFile("data/metadata/city_report.json",JSON.stringify(report,null,2));
console.log(JSON.stringify({counts:report.counts,buildingHeightSources:heightSources,geometryIssues:issues.length},null,2));
