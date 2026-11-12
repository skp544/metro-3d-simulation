// Loads the processed dataset. `?url` makes Vite serve (dev) or emit (build) the files from data/
// as-is, so there is one copy of the data and nothing is bundled into the JS.
import linesUrl from "../../data/processed/metro_lines.geojson?url";
import routesUrl from "../../data/processed/metro_routes.geojson?url";
import segmentsUrl from "../../data/processed/metro_segments.geojson?url";
import stationsUrl from "../../data/processed/metro_stations.geojson?url";
import interchangesUrl from "../../data/processed/interchange_stations.geojson?url";
import transfersUrl from "../../data/processed/station_transfers.geojson?url";
import constructionUrl from "../../data/processed/metro_under_construction.geojson?url";
import sourcesUrl from "../../data/metadata/sources.json?url";
import validationUrl from "../../data/metadata/validation_report.json?url";
import landmarksUrl from "../../data/processed/landmarks.geojson?url";
import type { LandmarksFC } from "./types";
import type {
  ConstructionFC,
  InterchangesFC,
  LinesFC,
  RoutesFC,
  SegmentsFC,
  StationsFC,
  ValidationReport,
  TransfersFC,
} from "./types";

export interface Network {
  landmarks: LandmarksFC;
  lines: LinesFC;
  routes: RoutesFC;
  segments: SegmentsFC;
  stations: StationsFC;
  interchanges: InterchangesFC;
  transfers: TransfersFC;
  construction: ConstructionFC;
  validation: ValidationReport;
  osmSnapshot: string;
  regionalSnapshot: string;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

export async function loadNetwork(): Promise<Network> {
  const [
    lines,
    routes,
    segments,
    stations,
    interchanges,
    transfers,
    construction,
    validation,
    sources,
    landmarks,
  ] = await Promise.all([
    get<LinesFC>(linesUrl),
    get<RoutesFC>(routesUrl),
    get<SegmentsFC>(segmentsUrl),
    get<StationsFC>(stationsUrl),
    get<InterchangesFC>(interchangesUrl),
    get<TransfersFC>(transfersUrl),
    get<ConstructionFC>(constructionUrl),
    get<ValidationReport>(validationUrl),
    get<{ sources: { id: string; snapshot?: string }[] }>(sourcesUrl),
    get<LandmarksFC>(landmarksUrl),
  ]);
  const osmSnapshot =
    sources.sources.find((s) => s.id === "osm")?.snapshot ?? "unknown";
  const regionalSnapshot =
    sources.sources.find((s) => s.id === "osm-regional")?.snapshot ?? "unknown";
  return {
    landmarks,
    lines,
    routes,
    segments,
    stations,
    interchanges,
    transfers,
    construction,
    validation,
    osmSnapshot,
    regionalSnapshot,
  };
}
