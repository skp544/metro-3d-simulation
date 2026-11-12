import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMapStore } from "../../store/useMapStore";

/** Camera exploration; geographic objects remain fixed. Text inputs and browser shortcuts keep their keys. */
export function ExploreMovement(){
  const pressed=useRef(new Set<string>());
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(e.ctrlKey||e.metaKey||e.altKey||document.activeElement?.matches("input,textarea,[contenteditable=true]"))return;
      if(["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight"].includes(e.code)){
        pressed.current.add(e.code);
        if(e.code.startsWith("Key")){e.preventDefault();if(useMapStore.getState().follow)useMapStore.getState().followTrain(null);}
      }
    };
    const up=(e:KeyboardEvent)=>pressed.current.delete(e.code),blur=()=>pressed.current.clear();
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",blur);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",blur);};
  },[]);
  useFrame(({camera,controls},delta)=>{
    const c=controls as unknown as {target:THREE.Vector3;update:()=>void}|null;if(!c||!pressed.current.size)return;
    const k=pressed.current,forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
    const right=new THREE.Vector3(-forward.z,0,forward.x),movement=new THREE.Vector3();
    if(k.has("KeyW"))movement.add(forward);if(k.has("KeyS"))movement.sub(forward);if(k.has("KeyD"))movement.add(right);if(k.has("KeyA"))movement.sub(right);
    if(!movement.lengthSq())return;
    const speed=Math.max(12,Math.min(150,camera.position.distanceTo(c.target)*.11))*(k.has("ShiftLeft")||k.has("ShiftRight")?3:1);
    movement.normalize().multiplyScalar(speed*Math.min(delta,.06));camera.position.add(movement);c.target.add(movement);c.update();
  });
  return null;
}
