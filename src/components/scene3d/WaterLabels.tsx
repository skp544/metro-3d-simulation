import { useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AreasFC } from "../../data/cityTypes";
import type { Projection } from "../../utils/projection";
import { areaPolygons } from "./buildCity";
import { useMapStore } from "../../store/useMapStore";

export function WaterLabels({data,projection}:{data:AreasFC;projection:Projection}){
  const candidates=useMemo(()=>data.features.filter(f=>f.properties.kind==="river"&&f.properties.name).flatMap(f=>areaPolygons(f.geometry).flatMap(p=>p[0].filter((_,i)=>i%8===0).map(q=>({name:f.properties.name,position:projection.project(q as [number,number])})))),[data,projection]);
  const [label,setLabel]=useState<(typeof candidates)[number]|null>(null),last=useRef(0),labels=useMapStore(s=>s.labels);
  useFrame(({camera,controls})=>{if(performance.now()-last.current<600)return;last.current=performance.now();const target=(controls as unknown as {target?:THREE.Vector3})?.target;if(!target)return;
    let nearest:typeof label=null,distance=2500;
    if(camera.position.distanceTo(target)<12000)for(const c of candidates){const d=Math.hypot(c.position[0]-target.x,c.position[1]-target.z);if(d<distance){nearest=c;distance=d;}}
    setLabel(old=>old===nearest?old:nearest);
  });
  if(!label||labels==="off")return null;
  return <Html position={[label.position[0],3,label.position[1]]} center zIndexRange={[420,0]}><span className="pointer-events-none whitespace-nowrap rounded-full border border-sky-200 bg-sky-50/90 px-3 py-1 text-xs font-semibold text-sky-800 shadow-sm">{label.name}</span></Html>;
}
