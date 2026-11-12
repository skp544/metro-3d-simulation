import { useState } from "react";
import { PLACE_CATEGORIES } from "../../constants/places";
import type { Network } from "../../data/loadNetwork";
import type { PlaceCategory } from "../../data/types";
import { useMapStore } from "../../store/useMapStore";
import { showLandmark } from "../../store/showLandmark";

export function LandmarkList({ network }: { network: Network }) {
  const [category, setCategory] = useState<PlaceCategory | "all">("all");
  const places = network.landmarks.features.filter(f => category === "all" || f.properties.category === category);
  return <div>
    <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-slate-100 bg-white px-3 py-2" role="group" aria-label="Filter places">
      {(["all", ...Object.keys(PLACE_CATEGORIES)] as (PlaceCategory | "all")[]).map(key => <button key={key} type="button" aria-pressed={category === key}
        onClick={() => setCategory(key)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${category === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
        {key === "all" ? "All" : PLACE_CATEGORIES[key].plural} {network.landmarks.features.filter(f => key === "all" || f.properties.category === key).length}
      </button>)}
    </div>
    <ul className="divide-y divide-slate-100">
    {places.map(f => <li key={f.properties.id}>
      <button type="button" onClick={() => showLandmark(f)} className="w-full px-4 py-2 text-left text-xs hover:bg-slate-50">
        <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: PLACE_CATEGORIES[f.properties.category].color, background: PLACE_CATEGORIES[f.properties.category].fill }}>{PLACE_CATEGORIES[f.properties.category].label}</span>
        <span className="font-semibold text-slate-800">{f.properties.name}</span>
        <span className="block text-[11px] text-slate-500">{f.properties.nearestStation.name} · {(f.properties.nearestStation.distanceM / 1000).toFixed(2)} km straight line</span>
      </button>
    </li>)}
    </ul>
  </div>;
}

export function LandmarkPanel({ network }: { network: Network }) {
  const id = useMapStore(s => s.selectedLandmarkId);
  const f = network.landmarks.features.find(f => f.properties.id === id);
  if (!f) return null;
  const p = f.properties;
  const category = PLACE_CATEGORIES[p.category];
  const osm = /^osm:(way|relation)\/(\d+)/.exec(p.source[0]);
  const station = network.stations.features.find(s => s.properties.id === p.nearestStation.stationId);
  return <aside aria-label={`${p.name} details`} className="pointer-events-auto max-h-full w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg">
    <div className="flex items-start gap-2">
      <div className="flex-1"><p className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: category.color }}>{category.label} · {p.geometryRole === "site" ? "mapped site" : "approximate 3D model"}</p><h2 className="text-base font-semibold text-slate-900">{p.name}</h2></div>
      <button type="button" aria-label="Close landmark details" onClick={() => useMapStore.getState().selectLandmark(null)} className="rounded px-2 text-slate-500 hover:bg-slate-100">×</button>
    </div>
    <p className="mt-2 text-xs text-slate-600">{p.scope}</p>
    <p className="mt-2 text-xs text-slate-600">{p.geometryRole === "site" ? `Site highlight thickness ${p.heightM} m · nominal` : `Height ${p.heightM} m · ${p.heightEstimated ? "nominal" : "source-backed"}`}. {p.positionSource ?? `OSM position and footprint snapshot ${p.snapshot}`}.</p>
    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
      Nearest mapped station: <strong>{p.nearestStation.name}</strong>
      <p className="mt-1">{(p.nearestStation.distanceM / 1000).toFixed(2)} km straight line to the station point. This is not a walking route or entrance distance.</p>
      {station && <button type="button" className="mt-2 font-semibold text-blue-700 hover:underline" onClick={() => { const s = useMapStore.getState(); s.selectStation(station.properties.id); s.focusOn(station.geometry.coordinates as [number, number]); }}>Show station →</button>}
    </div>
    <div className="mt-3 flex gap-4 text-xs text-blue-700"><a href={p.reference} target="_blank" rel="noreferrer">Place reference ↗</a>{osm && <a href={`https://www.openstreetmap.org/${osm[1]}/${osm[2]}`} target="_blank" rel="noreferrer">OSM {p.geometryRole === "site" ? "site outline" : "footprint"} ↗</a>}</div>
  </aside>;
}
