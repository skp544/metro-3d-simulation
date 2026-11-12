import { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";
import { loadWater } from "../../data/loadCity";
import type { AreasFC } from "../../data/cityTypes";
import { useMapStore } from "../../store/useMapStore";

export function WaterLayer(){
  const [data,setData]=useState<AreasFC|null>(null),shown=useMapStore(s=>s.showWater);
  useEffect(()=>{let active=true;loadWater().then(d=>{if(active)setData(d);},e=>console.error("Water data:",e));return()=>{active=false;};},[]);
  if(!shown||!data)return null;
  return <GeoJSON data={data} style={{color:"#4e8c9f",weight:1,fillColor:"#70a8b7",fillOpacity:.5}} onEachFeature={(f,l)=>{if(f.properties.name)l.bindTooltip(f.properties.name);}}/>;
}
