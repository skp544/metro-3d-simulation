import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LayersControl, MapContainer, Pane, TileLayer, useMap, ZoomControl } from "react-leaflet";
import { BASE_LAYERS, DATA_ATTRIBUTION } from "../../constants/map";
import type { Network } from "../../data/loadNetwork";
import { useMapStore } from "../../store/useMapStore";
import { ConstructionLayer } from "./ConstructionLayer";
import { SegmentLayer } from "./SegmentLayer";
import { StationLayer } from "./StationLayer";
import { ValidationLayer } from "./ValidationLayer";

function DataAttribution() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.addAttribution(DATA_ATTRIBUTION);
    return () => void map.attributionControl.removeAttribution(DATA_ATTRIBUTION);
  }, [map]);
  return null;
}

function FocusHandler() {
  const map = useMap();
  const focus = useMapStore((s) => s.focus);
  useEffect(() => {
    if (focus) map.flyTo([focus.coordinates[1], focus.coordinates[0]], Math.max(map.getZoom(), 16));
  }, [map, focus]);
  return null;
}

// Keeps the view in the URL (#zoom/lat/lng) so a review spot can be shared or reopened.
function HashView() {
  const map = useMap();
  useEffect(() => {
    const write = () => {
      const c = map.getCenter();
      history.replaceState(null, "", `#${map.getZoom()}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}`);
    };
    map.on("moveend", write);
    return () => void map.off("moveend", write);
  }, [map]);
  return null;
}

const viewFromHash = () => {
  const m = /^#(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(location.hash);
  return m ? { zoom: Number(m[1]), center: [Number(m[2]), Number(m[3])] as [number, number] } : null;
};

export function MetroMap({ network }: { network: Network }) {
  // Initial view: the URL hash if present, else fit the network itself (no hardcoded centre).
  const bounds = useMemo(() => L.geoJSON(network.lines).getBounds(), [network.lines]);
  const initial = useMemo(() => viewFromHash(), []);
  // ?base=Satellite opens a review link straight on imagery.
  const base = new URLSearchParams(location.search).get("base") ?? BASE_LAYERS[0].name;
  // On desktop the control panel covers the left ~300 px, so fit the network beside it.
  const wide = window.innerWidth >= 768;
  const view = initial ?? { bounds, boundsOptions: { paddingTopLeft: [wide ? 300 : 16, 16], paddingBottomRight: [16, 16] } as L.FitBoundsOptions };
  return (
    <MapContainer {...view} preferCanvas zoomControl={false} className="h-full w-full">
      <LayersControl position="topright">
        {BASE_LAYERS.map((b) => (
          <LayersControl.BaseLayer key={b.name} name={b.name} checked={b.name.toLowerCase() === base.toLowerCase()}>
            <TileLayer url={b.url} attribution={b.attribution} maxZoom={b.maxZoom} />
          </LayersControl.BaseLayer>
        ))}
      </LayersControl>
      <ZoomControl position="topright" />
      {/* Panes fix the stacking: construction < track < stations < validation markers. */}
      <Pane name="construction" style={{ zIndex: 390 }}>
        <ConstructionLayer network={network} />
      </Pane>
      <Pane name="track" style={{ zIndex: 400 }}>
        <SegmentLayer network={network} />
      </Pane>
      <Pane name="stations" style={{ zIndex: 450 }}>
        <StationLayer network={network} />
      </Pane>
      <Pane name="validation" style={{ zIndex: 460 }}>
        <ValidationLayer network={network} />
      </Pane>
      <DataAttribution />
      <FocusHandler />
      <HashView />
    </MapContainer>
  );
}
