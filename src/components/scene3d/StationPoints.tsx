import { useMemo } from "react";
import * as THREE from "three";
import { INTERCHANGE_SIZE_PX, STATION_SIZE_PX } from "../../constants/scene";
import type { StationType } from "../../data/types";
import { useMapStore } from "../../store/useMapStore";
import type { StationPoint3D } from "./geometry";

// Round marker with a dark rim; the vertex colour tints the fill, the rim stays dark.
function markerTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1f2937";
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(32, 32, 21, 0, Math.PI * 2);
  g.fill();
  return new THREE.CanvasTexture(c);
}

// Screen-size points (constant pixels at any zoom), like the 2D markers. Interchanges are drawn larger and white.
export function StationPoints({ stations, colors }: { stations: StationPoint3D[]; colors: Map<string, string> }) {
  const show = useMapStore((s) => s.showStations);
  const hiddenLines = useMapStore((s) => s.hiddenLines);
  const hiddenTypes = useMapStore((s) => s.hiddenStationTypes);
  const texture = useMemo(() => markerTexture(), []);

  const [platforms, interchanges] = useMemo(() => {
    const visible = stations.filter((s) => !hiddenTypes.includes(s.stationType as StationType));
    const toGeometry = (pts: StationPoint3D[], color: (p: StationPoint3D) => string) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap((p) => p.position), 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(pts.flatMap((p) => new THREE.Color(color(p)).toArray()), 3));
      return g;
    };
    const lineVisible = (p: StationPoint3D) => p.lineId !== null && !hiddenLines.includes(p.lineId);
    const ids = new Set(visible.filter(lineVisible).map((p) => p.stationId));
    return [
      toGeometry(visible.filter(lineVisible), (p) => colors.get(p.lineId!) ?? "#ffffff"),
      toGeometry(visible.filter((p) => p.lineId === null && ids.has(p.stationId)), () => "#ffffff"),
    ];
  }, [stations, colors, hiddenLines, hiddenTypes]);

  if (!show) return null;
  return (
    <>
      <points geometry={platforms} renderOrder={1}>
        <pointsMaterial map={texture} vertexColors size={STATION_SIZE_PX} sizeAttenuation={false} alphaTest={0.5} />
      </points>
      <points geometry={interchanges} renderOrder={2}>
        <pointsMaterial map={texture} vertexColors size={INTERCHANGE_SIZE_PX} sizeAttenuation={false} alphaTest={0.5} />
      </points>
    </>
  );
}
