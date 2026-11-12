import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { simSeconds, useMapStore } from "../../store/useMapStore";
import { streetPose, type StreetPath } from "./buildCity";

const CAR_LIMIT=180,LAMP_LIMIT=160;
const hash=(n:number)=>{const v=Math.sin(n*17.17+8.3)*43758.3;return v-Math.floor(v);};
type Part={g:THREE.BufferGeometry;p:[number,number,number];c:string;rotation?:THREE.Euler};
function merge(parts:Part[]){
  const pos:number[]=[],col:number[]=[];
  for(const p of parts){const m=new THREE.Matrix4().compose(new THREE.Vector3(...p.p),new THREE.Quaternion().setFromEuler(p.rotation??new THREE.Euler()),new THREE.Vector3(1,1,1));
    const g=(p.g.index?p.g.toNonIndexed():p.g).applyMatrix4(m),a=g.getAttribute("position"),c=new THREE.Color(p.c);
    for(let i=0;i<a.count;i++){pos.push(a.getX(i),a.getY(i),a.getZ(i));col.push(c.r,c.g,c.b);}g.dispose();if(g!==p.g)p.g.dispose();
  }
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
}
function vehicle(type:number){
  const parts:Part[]=[],box=(s:[number,number,number],p:Part["p"],c:string)=>parts.push({g:new THREE.BoxGeometry(...s),p,c});
  const length=type===1?8:type===2?2.7:4.2,width=type===1?2.3:type===2?1.45:1.8;
  const body=type===1?"#9da85e":type===2?"#268968":"#e7dfc9";
  box([length,.65,width],[0,.7,0],body);
  box([length*.62,type===1?1.7:.72,width*.92],[-length*.08,type===1?1.8:1.35,0],type===2?"#d8b444":"#365565");
  box([length*.65,.12,width],[-length*.08,type===1?2.7:1.74,0],type===2?"#e4bd48":body);
  if(type===1)for(let x=-2.6;x<=2.6;x+=.9)box([.08,1.5,width*.95],[x,1.85,0],body);
  for(const x of [-length*.32,length*.32])for(const z of [-width*.49,width*.49])parts.push({g:new THREE.CylinderGeometry(.3,.3,.16,10),p:[x,.35,z],c:"#30373b",rotation:new THREE.Euler(Math.PI/2,0,0)});
  for(const z of [-width*.34,width*.34]){box([.06,.18,.3],[length/2+.02,.78,z],"#fff1c6");box([.06,.16,.3],[-length/2-.02,.78,z],"#a94a40");}
  return merge(parts);
}
function lamp(){return merge([
  {g:new THREE.CylinderGeometry(.07,.12,7.6,6),p:[0,3.8,0],c:"#6c777c"},
  {g:new THREE.BoxGeometry(.09,.09,1.8),p:[0,7.55,.85],c:"#6c777c"},
  {g:new THREE.BoxGeometry(.45,.12,.8),p:[0,7.5,1.55],c:"#c4c9c3"},
]);}

/** Illustrative traffic and road-edge fixtures, placed only on mapped drivable streets. */
export function UrbanLife({paths}:{paths:StreetPath[]}){
  const refs=useRef<(THREE.InstancedMesh|null)[]>([]),lamps=useRef<THREE.InstancedMesh>(null);
  const candidates=useRef<{paths:StreetPath[];source:StreetPath[];x:number;z:number;time:number}|null>(null);
  const geometries=useMemo(()=>[vehicle(0),vehicle(1),vehicle(2)],[]),pole=useMemo(()=>lamp(),[]);
  useEffect(()=>()=>{geometries.forEach(g=>g.dispose());pole.dispose();},[geometries,pole]);
  useFrame(({camera,controls})=>{
    const target=(controls as unknown as {target?:THREE.Vector3})?.target;if(!target)return;
    const visible=camera.position.distanceTo(target)<2800;
    for(const ref of refs.current)if(ref)ref.visible=visible;
    if(lamps.current)lamps.current.visible=visible;
    if(!visible)return;
    let local=candidates.current;
    if(!local||local.source!==paths||performance.now()-local.time>800||Math.hypot(local.x-target.x,local.z-target.z)>200){
      const nearby=paths.filter(p=>p.width>=4&&!["pedestrian","footway","path","cycleway","steps"].includes(p.class)&&p.length>60&&p.points.some(v=>Math.hypot(v[0]-target.x,v[2]-target.z)<1300)).sort((a,b)=>{
        const a0=streetPose(a,a.length/2,1,0).position,b0=streetPose(b,b.length/2,1,0).position;
        return Math.hypot(a0[0]-target.x,a0[2]-target.z)-Math.hypot(b0[0]-target.x,b0[2]-target.z);
      }).slice(0,100);
      local={paths:nearby,source:paths,x:target.x,z:target.z,time:performance.now()};candidates.current=local;
      const mesh=lamps.current;if(mesh){let count=0;
        for(const p of nearby.filter(p=>p.width>=6))for(let d=15;d<p.length&&count<LAMP_LIMIT;d+=60){
          const pose=streetPose(p,d,count%2?1:-1,p.width/2+.8);
          if(Math.hypot(pose.position[0]-target.x,pose.position[2]-target.z)>800)continue;
          const m=new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),pose.yaw),new THREE.Vector3(1,1,1));mesh.setMatrixAt(count++,m);
        }
        mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
      }
    }
    const counts=[0,0,0],seconds=simSeconds(useMapStore.getState());
    for(const p of local.paths){
      const id=Number(p.id.split('/')[1]),number=Math.min(5,Math.max(1,Math.floor(p.length/110)));
      for(let i=0;i<number;i++){
        const seed=id+i*97,type=p.width>=7&&hash(seed)>.91?1:hash(seed)>.67?2:0,direction=p.oneway||i%2===0?1:-1;
        if(counts[type]>=CAR_LIMIT/3)continue;
        const distance=((seconds*(7+hash(seed+1)*5)+hash(seed+2)*p.length)%p.length);
        const pose=streetPose(p,direction>0?distance:p.length-distance,direction);
        if(Math.hypot(pose.position[0]-target.x,pose.position[2]-target.z)>1100)continue;
        const mesh=refs.current[type];if(!mesh)continue;
        mesh.setMatrixAt(counts[type],new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),pose.yaw),new THREE.Vector3(1,1,1)));
        if(type===0)mesh.setColorAt(counts[type],new THREE.Color(["#faf9ed","#b7c9d4","#e3b8a5","#c6cbb8"][Math.floor(hash(seed+5)*4)]));counts[type]++;
      }
    }
    refs.current.forEach((m,i)=>{if(m){m.count=counts[i];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}});
  });
  return <>
    {geometries.map((g,i)=><instancedMesh key={i} ref={r=>{refs.current[i]=r;}} args={[g,undefined,CAR_LIMIT/3]} frustumCulled={false} castShadow><meshLambertMaterial vertexColors/></instancedMesh>)}
    <instancedMesh ref={lamps} args={[pole,undefined,LAMP_LIMIT]} frustumCulled={false} castShadow><meshLambertMaterial vertexColors/></instancedMesh>
  </>;
}
