// OSM geometry → small merged chunks, UV-scaled facades, roofs, streets and landscape.
import * as THREE from "three";
import type { Polygon, MultiPolygon } from "geojson";
import type { City, EnvironmentContext, RoadProps } from "../../data/cityTypes.ts";
import type { LandmarksFC } from "../../data/types.ts";
import type { Projection } from "../../utils/projection.ts";

type V3=[number,number,number];
type XZ=[number,number];
type Acc={pos:number[];col:number[];uv:number[]};
const acc=():Acc=>({pos:[],col:[],uv:[]});
const hash=(n:number)=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
export const areaPolygons=(g:Polygon|MultiPolygon)=>g.type==="Polygon"?[g.coordinates]:g.coordinates;
export const landmarkExclusions=(landmarks:LandmarksFC)=>landmarks.features
  .filter(f=>f.properties.geometryRole!=="site")
  .flatMap(f=>f.properties.footprintParts.map(p=>({footprint:p.outer,holes:p.holes,osmId:f.properties.source[0].split("@")[0]})));
const color=(s:string)=>new THREE.Color(s);
function tri(a:Acc,p:V3,q:V3,r:V3,c:THREE.Color,uv?:number[]){a.pos.push(...p,...q,...r);for(let i=0;i<3;i++)a.col.push(c.r,c.g,c.b);a.uv.push(...(uv??[p[0]/30,p[2]/30,q[0]/30,q[2]/30,r[0]/30,r[2]/30]));}
function quad(a:Acc,p:V3,q:V3,r:V3,s:V3,c:THREE.Color,uv?:number[]){
  tri(a,p,q,r,c,uv&&[uv[0],uv[1],uv[2],uv[3],uv[4],uv[5]]);
  tri(a,p,r,s,c,uv&&[uv[0],uv[1],uv[4],uv[5],uv[6],uv[7]]);
}
function surface(a:Acc,rings:XZ[][],y:number,c:THREE.Color){
  const shapes=rings.map(r=>r.slice(0,-1).map(p=>new THREE.Vector2(...p)));
  if(shapes[0].length<3)return;
  const points=shapes.flat();
  for(const [i,j,k]of THREE.ShapeUtils.triangulateShape(shapes[0],shapes.slice(1))){
    const p=points[i],q=points[j],r=points[k];
    tri(a,[p.x,y,p.y],[r.x,y,r.y],[q.x,y,q.y],c);
  }
}
function geometry(a:Acc){
  if(!a.pos.length)return null;
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(a.pos,3));g.setAttribute("color",new THREE.Float32BufferAttribute(a.col,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(a.uv,2));
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function insideArea(p:number[],rings:number[][][]){
  const inside=(r:number[][])=>{let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
  return inside(rings[0])&&!rings.slice(1).some(inside);
}
const walls=["#c9b8a2","#b7b6a9","#ddd0b6","#ba9b84","#d5c7ba","#aab7b8","#e0d9c8","#b4aaa2"];
const roofs=["#96928a","#b6b3a5","#c2bda9","#a6978b"];
export function landColor(kind:string){
  if(["wood","forest","orchard"].includes(kind))return "#68886a";
  if(["park","garden","recreation_ground","village_green"].includes(kind))return "#92ae78";
  if(["grass","grassland","meadow","golf_course"].includes(kind))return "#a0b980";
  if(["scrub"].includes(kind))return "#9ca57c";
  if(["farmland","farmyard","allotments"].includes(kind))return "#bdbe87";
  if(["residential","retail","commercial"].includes(kind))return "#c4bfb2";
  if(["industrial","railway","construction"].includes(kind))return "#b9b5aa";
  if(["sand","quarry","bare_rock"].includes(kind))return "#cebd95";
  if(kind==="pitch")return "#7ca477";
  return "#b7bea3";
}

export interface StreetPath { id:string; points:V3[]; distances:number[]; length:number; width:number; oneway:boolean; class:string }
export function streetPath(coordinates:number[][],p:RoadProps,project:Projection["project"]):StreetPath{
  const source=coordinates.map(q=>project(q as XZ)),xz:XZ[]=[source[0]],distances=[0];
  for(let i=1;i<source.length;i++){
    const a=source[i-1],b=source[i],n=p.bridge?Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/25)):1;
    for(let j=1;j<=n;j++)xz.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);
  }
  for(let i=1;i<xz.length;i++)distances.push(distances[i-1]+Math.hypot(xz[i][0]-xz[i-1][0],xz[i][1]-xz[i-1][1]));
  const length=distances.at(-1)!;
  const points:V3[]=xz.map(([x,z],i)=>[x,.22+(p.bridge?Math.min(6,distances[i]/20,(length-distances[i])/20):0),z]);
  return {id:p.id,points,distances,length,width:p.width,oneway:p.oneway,class:p.class};
}
/** Continuous pose on actual road geometry; left-hand lane offset, distance in metres. */
export function streetPose(path:StreetPath,distance:number,direction=1,laneOffset=path.width*.23){
  const d=Math.max(0,Math.min(path.length,distance));let i=1;
  while(i<path.distances.length-1&&path.distances[i]<d)i++;
  const a=path.points[i-1],b=path.points[i],span=path.distances[i]-path.distances[i-1],t=span?(d-path.distances[i-1])/span:0;
  const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1;
  return {position:[a[0]+dx*t+direction*laneOffset*dz/len,a[1]+(b[1]-a[1])*t,a[2]+dz*t-direction*laneOffset*dx/len] as V3,yaw:Math.atan2(-dz,dx)+(direction<0?Math.PI:0)};
}
function ribbon(a:Acc,path:V3[],width:number,c:THREE.Color,raise=0){
  const edge=path.map((p,i)=>{
    const before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)];
    const dx=after[0]-before[0],dz=after[2]-before[2],len=Math.hypot(dx,dz)||1,nx=dz/len*width/2,nz=-dx/len*width/2;
    return [[p[0]+nx,p[1]+raise,p[2]+nz],[p[0]-nx,p[1]+raise,p[2]-nz]] as [V3,V3];
  });
  for(let i=1;i<edge.length;i++)quad(a,edge[i-1][0],edge[i-1][1],edge[i][1],edge[i][0],c);
}

export function buildCity(city:City,projection:Projection,exclusions:{footprint:XZ[];holes?:XZ[][];osmId:string}[]=[],context?:EnvironmentContext){
  const chunks=new Map<string,{walls:Acc;roofs:Acc;roads:Acc;curbs:Acc;markings:Acc;land:Acc;water:Acc;banks:Acc}>();
  const chunk=(p:number[])=>{const key=`${Math.floor(p[0]/1000)},${Math.floor(p[1]/1000)}`;if(!chunks.has(key))chunks.set(key,{walls:acc(),roofs:acc(),roads:acc(),curbs:acc(),markings:acc(),land:acc(),water:acc(),banks:acc()});return chunks.get(key)!;};
  const project=(p:number[])=>projection.project(p as XZ);
  let buildings=0;
  for(const f of city.buildings.features){
    // A separate OSM building outline can enclose the landmark without any building corner
    // falling inside its footprint (India Gate). Check containment in both directions.
    if(exclusions.some(e=>f.properties.id===e.osmId||areaPolygons(f.geometry).some(rs=>
      rs[0].some(p=>insideArea(p,[e.footprint,...(e.holes??[])]))||e.footprint.some(p=>insideArea(p,rs)))))continue;
    const p=f.properties,id=Number(p.id.split('/')[1]),h=p.height;
    const base=p.color&&(/^#[\da-f]{6}$/i.test(p.color)||p.color in THREE.Color.NAMES)?p.color:p.facadeStyle==="historic"?"#bda584":walls[Math.floor(hash(id)*walls.length)];
    const wall=color(base),roof=color(roofs[Math.floor(hash(id+4)*roofs.length)]);
    for(const poly of areaPolygons(f.geometry)){
      const rings=poly.map(r=>r.map(project)),ch=chunk(rings[0][0]);
      for(const ring of rings)for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i],width=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(width<.05)continue;
        quad(ch.walls,[a[0],0,a[1]],[b[0],0,b[1]],[b[0],h,b[1]],[a[0],h,a[1]],wall,p.facadeStyle?[.01,.01,.01,.01,.01,.01,.01,.01]:[0,0,width/3,0,width/3,h/3.2,0,h/3.2]);
      }
      surface(ch.roofs,rings,h,roof);
    }
    buildings++;
  }
  const paths:StreetPath[]=[];
  const roadFeatures=context?.roads.features??city.roads.features;
  for(const f of roadFeatures){
    if(f.geometry.coordinates.length<2)continue;
    const path=streetPath(f.geometry.coordinates,f.properties,projection.project);if(path.length<1)continue;
    const ch=chunk([path.points[0][0],path.points[0][2]]),walking=["footway","path","pedestrian","cycleway","steps"].includes(path.class);
    const offset=context?-.07:0;
    ribbon(ch.curbs,path.points,path.width+(walking?.5:1.6),color(walking?"#c9bfaa":"#bab7ad"),offset-.035);
    ribbon(ch.roads,path.points,path.width,color(walking?"#c2b498":"#56616a"),offset);
    // Background context has only arterial ribbons; loaded city tiles supply nearby lane details.
    if(!context){
      paths.push(path);
      if(!walking&&path.width>=7&&path.length<5000)for(let d=3;d<path.length;d+=12){
        const a=streetPose(path,d,1,0),b=streetPose(path,Math.min(d+4,path.length),1,0);
        ribbon(ch.markings,[a.position,b.position],.16,color("#dddcc7"),.025);
      }
    }
  }
  let layer=0;
  for(const f of context?.land.features??city.green.features){
    for(const poly of areaPolygons(f.geometry)){
      const rings=poly.map(r=>r.map(project));surface(chunk(rings[0][0]).land,rings,.025+Math.min(layer++,20000)*.000002,color(landColor(f.properties.kind)));
    }
  }
  for(const f of context?.water.features??[]){
    for(const poly of areaPolygons(f.geometry)){
      const rings=poly.map(r=>r.map(project)),ch=chunk(rings[0][0]);
      surface(ch.water,rings,.12,color(f.properties.kind==="river"?"#4d8997":"#5c969b"));
      for(const ring of rings)ribbon(ch.banks,ring.map(([x,z])=>[x,.105,z] as V3),2.4,color("#c4ba99"));
    }
  }
  const trees:THREE.Matrix4[][]=[[],[],[],[]];
  for(const f of city.trees.features){
    if(exclusions.some(e=>insideArea(f.geometry.coordinates,[e.footprint,...(e.holes??[])])))continue;
    const [x,z]=project(f.geometry.coordinates),seed=x+z,s=5.4+hash(seed)*3.1;
    trees[f.properties.variant%4].push(new THREE.Matrix4().compose(new THREE.Vector3(x,0,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),hash(seed+.5)*Math.PI*2),new THREE.Vector3(s,s,s)));
  }
  return {chunks:[...chunks].map(([key,c])=>({key,...Object.fromEntries(Object.entries(c).map(([k,v])=>[k,geometry(v)]))})) as ({key:string}&Record<"walls"|"roofs"|"roads"|"curbs"|"markings"|"land"|"water"|"banks",THREE.BufferGeometry|null>)[],trees,paths,stats:{buildings,trees:trees.flat().length}};
}
