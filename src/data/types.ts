// Schema of data/processed/*.geojson. Shared by scripts/ (build, validate) and the app.
import type { Feature, FeatureCollection, LineString, MultiLineString, Point } from "geojson";

export type PlaceCategory = "monument" | "mall" | "zoo" | "religious" | "civic";
export interface PlaceFootprint {
  outer: [number, number][];
  holes: [number, number][][];
}

export interface LandmarkProps extends Provenance {
  id: string;
  name: string;
  category: PlaceCategory;
  aliases: string[];
  /** A site outline must not suppress the real buildings/trees inside its grounds. */
  geometryRole: "building" | "site";
  footprint: [number, number][];
  footprintParts: PlaceFootprint[];
  /** Source polygons in local Blender XY metres, via projection.ts, for model authoring. */
  modelFootprints: PlaceFootprint[];
  footprintHoles?: [number, number][][];
  positionSource?: string;
  model: string;
  widthM: number;
  depthM: number;
  heightM: number;
  heightEstimated: boolean;
  yaw: number;
  orientationSource: string;
  scope: string;
  nearestStation: { stationId: string; name: string; distanceM: number };
  reference: string;
  snapshot: string;
}
export type LandmarksFC = FeatureCollection<Point, LandmarkProps>;

export type InfraType = "elevated" | "underground" | "at_grade" | "unknown";
// "mixed": an interchange whose platforms differ, e.g. Kashmere Gate (Red elevated, Yellow/Violet underground).
export type StationType = InfraType | "mixed";
export type Status = "operational" | "under_construction";

/** On every feature. source entries look like "osm:node/123" or "wikipedia:Red_Line_(Delhi_Metro)@rev". */
export interface Provenance {
  source: string[];
  verified: boolean;
  estimated: boolean;
  conflicts: string[];
}

export interface LineProps extends Provenance {
  id: string;
  name: string;
  color: string;
  colorSource: string;
  colorOfficial: boolean;
  status: Status;
  branches: { id: string; stationIds: string[] }[];
}

export interface RouteProps extends Provenance {
  id: string;
  lineId: string;
  stationIds: string[]; // in travel order; a loop line may list a station twice (Pink: Maujpur-Babarpur)
  stopKm: number[]; // distance along this route's geometry for each stationIds entry
  lengthKm: number; // first to last stop
  geometryLengthKm: number; // full geometry, including tail tracks beyond the termini
}

export interface SegmentProps extends Provenance {
  id: string;
  lineId: string;
  routeId: string;
  fromStationId: string;
  toStationId: string;
  trackType: InfraType;
  trackTypeSource: string; // "osm:tunnel" | "osm:bridge" | "osm:layer" | "osm:cutting" | "osm:untagged" | "inferred:neighbours" ...
  lengthKm: number;
}

export interface Platform {
  lineId: string;
  coordinates: [number, number]; // [lng, lat], mean of this line's stop positions
  trackType: InfraType;
  trackTypeSource: string;
  wikipediaName: string | null; // the Wikipedia row matched (may differ in spelling)
  wikipediaLayout: InfraType | null;
}

export interface StationProps extends Provenance {
  id: string;
  name: string;
  name_hi: string | null;
  aliases: string[];
  refs: string[]; // DMRC station codes from OSM `ref`
  lines: string[];
  isInterchange: boolean;
  stationType: StationType;
  platforms: Platform[];
  status: Status;
}

export interface InterchangeProps {
  stationId: string;
  name: string;
  lines: string[];
  evidence: "osm-ref" | "proximity" | "manual";
}

/** Bidirectional pedestrian connection between distinct stations. Geometry is a schematic connector. */
export interface TransferProps extends Provenance {
  id: string;
  fromStationId: string;
  toStationId: string;
  walkSeconds: number; // nominal walking time, excludes the wait for the next train
  note: string;
}

export interface ConstructionProps extends Provenance {
  id: string;
  name: string | null;
  lineId: string | null;
  status: "under_construction";
  lengthKm: number;
}

// data/metadata/validation_report.json (written by scripts/validate.ts)
export type Severity = "error" | "warning" | "info";
export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  featureIds?: string[];
  location?: [number, number]; // [lng, lat]
}
export interface ValidationReport {
  generatedAt: string;
  passed: boolean;
  summary: { errors: number; warnings: number; info: number };
  checks: { code: string; severity: Severity; description: string; issues: number; status: "pass" | "fail" | "noted" }[];
  issues: ValidationIssue[];
}

export type LinesFC = FeatureCollection<MultiLineString, LineProps>;
export type RoutesFC = FeatureCollection<LineString, RouteProps>;
export type SegmentsFC = FeatureCollection<LineString, SegmentProps>;
export type StationsFC = FeatureCollection<Point, StationProps>;
export type InterchangesFC = FeatureCollection<Point, InterchangeProps>;
export type TransfersFC = FeatureCollection<LineString, TransferProps>;
export type ConstructionFC = FeatureCollection<LineString, ConstructionProps>;
export type StationFeature = Feature<Point, StationProps>;
