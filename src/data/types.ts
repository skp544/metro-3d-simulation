// Schema of data/processed/*.geojson. Shared by scripts/ (build, validate) and the app.
import type { Feature, FeatureCollection, LineString, MultiLineString, Point } from "geojson";

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
  trackTypeSource: string; // "osm:tunnel" | "osm:bridge" | "osm:layer" | "osm:cutting" | "osm:untagged" ...
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

export interface ConstructionProps extends Provenance {
  id: string;
  name: string | null;
  lineId: string | null;
  status: "under_construction";
  lengthKm: number;
}

export type LinesFC = FeatureCollection<MultiLineString, LineProps>;
export type RoutesFC = FeatureCollection<LineString, RouteProps>;
export type SegmentsFC = FeatureCollection<LineString, SegmentProps>;
export type StationsFC = FeatureCollection<Point, StationProps>;
export type InterchangesFC = FeatureCollection<Point, InterchangeProps>;
export type ConstructionFC = FeatureCollection<LineString, ConstructionProps>;
export type StationFeature = Feature<Point, StationProps>;
