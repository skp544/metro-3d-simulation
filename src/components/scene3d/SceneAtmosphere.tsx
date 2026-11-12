import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../../constants/scene";

export function SceneAtmosphere(){
  const fog=useMemo(()=>new THREE.Fog(PALETTE.background,2500,8000),[]);
  useFrame(({camera,controls})=>{const t=(controls as unknown as {target?:THREE.Vector3})?.target;if(t){const d=camera.position.distanceTo(t);fog.near=Math.max(2500,d*1.8);fog.far=Math.max(8000,d*4.5);}});
  return <primitive attach="fog" object={fog}/>;
}
export function EnvironmentGround({width,depth,x,z}:{width:number;depth:number;x:number;z:number}){
  const texture=useMemo(()=>{
    const canvas=document.createElement("canvas");canvas.width=canvas.height=256;const c=canvas.getContext("2d")!;
    const data=c.createImageData(256,256);let seed=7919;
    for(let i=0;i<data.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const v=228+((seed>>>24)%22);data.data[i]=v;data.data[i+1]=v;data.data[i+2]=v-3;data.data[i+3]=255;}
    c.putImageData(data,0,0);const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(width/80,depth/80);map.colorSpace=THREE.SRGBColorSpace;return map;
  },[width,depth]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh rotation-x={-Math.PI/2} position={[x,0,z]} receiveShadow><planeGeometry args={[width,depth]}/><meshLambertMaterial color={PALETTE.ground} map={texture}/></mesh>;
}
