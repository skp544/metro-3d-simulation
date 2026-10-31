// Independent check of data/processed/*.geojson → data/metadata/validation_report.json.
// Re-derives everything from the processed files; shares no logic with build-dataset.ts.
// Usage: node scripts/validate.ts [processedDir] [reportPath]   (exit 1 on errors)
import { readdir, readFile, writeFile } from "node:fs/promises";
import { distance, length } from "@turf/turf";
import type {
  InterchangeProps,
  LineProps,
  RouteProps,
  SegmentProps,
  StationProps,
} from "../src/data/types.ts";

type LngLat = [number, number];
type Severity = "error" | "warning" | "info";
export type Issue = { severity: Severity; code: string; message: string; featureIds?: string[]; location?: LngLat };
type F<P, G = unknown> = { type: "Feature"; geometry: G; properties: P };
type Pt = { type: "Point"; coordinates: LngLat };
type Ls = { type: "LineString"; coordinates: LngLat[] };
type Mls = { type: "MultiLineString"; coordinates: LngLat[][] };

export const CHECKS: Record<string, [Severity, string]> = {
  GEOJSON_INVALID: ["error", "Each file is a FeatureCollection with the expected geometry type and finite [lng, lat] positions"],
  SCHEMA: ["error", "Required properties are present, with valid types and enum values"],
  OUT_OF_BOUNDS: ["error", "Every coordinate lies inside the NCR bounding box (28.2–28.9 N, 76.7–77.6 E)"],
  DUPLICATE_ID: ["error", "IDs are unique within each file"],
  MISSING_GEOMETRY: ["error", "Every line has geometry and every branch has a route"],
  BROKEN_REFERENCE: ["error", "Every referenced line/route/station exists, and station ↔ line membership agrees both ways"],
  SEGMENT_GAP: ["error", "A route's segments join within 1 m and run from its first to its last station in order"],
  LENGTH_INCONSISTENT: ["error", "Stored lengths match the geometry (segment ±1%, route = sum of segments ±0.5%)"],
  STATION_ORDER: ["error", "Stations project onto their route in increasing order"],
  INTERCHANGE_MISMATCH: ["error", "isInterchange ⇔ more than one line; the interchange file matches the stations; manual merges are applied"],
  NETWORK_DISCONNECTED: ["error", "All stations form one connected network"],
  DEGENERATE_GEOMETRY: ["warning", "No repeated consecutive positions in lines"],
  STOP_KM_DRIFT: ["warning", "A station's projected position agrees with the route's stopKm within 100 m"],
  STATION_FAR_FROM_LINE: ["warning", "A station point is within 150 m of each of its lines"],
  PLATFORM_FAR_FROM_TRACK: ["warning", "A platform is within 30 m of its line's track"],
  DUPLICATE_NAME: ["warning", "No two stations share a name"],
  NEARBY_STATIONS: ["warning", "No two separate stations within 300 m (possible missed interchange)"],
  REFERENCE_COUNT: ["warning", "Station count per line matches the Wikipedia infobox"],
  REFERENCE_LENGTH: ["warning", "Line length is within ±5% of the Wikipedia infobox"],
  SOURCE_CONFLICT: ["info", "Features whose sources disagree (recorded in conflicts[])"],
  UNVERIFIED_STATION: ["info", "Stations not confirmed by a second source"],
  CORRIDOR_OVERLAP: ["info", "Different lines running within 5 m of each other for over 200 m"],
};

const BBOX = { minLng: 76.7, maxLng: 77.6, minLat: 28.2, maxLat: 28.9 };
const INFRA = ["elevated", "underground", "at_grade", "unknown"];
const STATION_TYPES = [...INFRA, "mixed"];
const FILES = {
  lines: ["metro_lines.geojson", "MultiLineString"],
  routes: ["metro_routes.geojson", "LineString"],
  segments: ["metro_segments.geojson", "LineString"],
  stations: ["metro_stations.geojson", "Point"],
  interchanges: ["interchange_stations.geojson", "Point"],
  construction: ["metro_under_construction.geojson", "LineString"],
} as const;

const meters = (a: LngLat, b: LngLat) => distance(a, b, { units: "kilometers" }) * 1000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

// Projects a point onto a polyline: planar maths per segment (local metres) for the foot point,
// geodesic segment lengths for distance along the line, so km agrees with turf. Scans forward from
// fromKm and returns the first stretch within tolM, so a loop line that revisits a place matches the earlier pass.
export function locate(line: LngLat[], p: LngLat, fromKm = 0, tolM = 60) {
  let cum = 0;
  let first: { km: number; offM: number } | null = null;
  let best: { km: number; offM: number } | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const kx = 111_320 * Math.cos((line[i][1] * Math.PI) / 180);
    const ky = 110_950; // metres per degree of latitude near 28.6° N
    const xy = ([x, y]: LngLat) => [x * kx, y * ky];
    const [a, b, q] = [xy(line[i]), xy(line[i + 1]), xy(p)];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const seg2 = dx * dx + dy * dy;
    const t = seg2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / seg2)) : 0;
    const segM = meters(line[i], line[i + 1]);
    const km = (cum + t * segM) / 1000;
    const offM = Math.hypot(q[0] - (a[0] + t * dx), q[1] - (a[1] + t * dy));
    cum += segM;
    if (km < fromKm - 0.001) continue;
    if (!best || offM < best.offM) best = { km, offM };
    if (offM <= tolM) {
      if (!first || offM < first.offM) first = { km, offM };
    } else if (first) break; // the first close stretch has ended
  }
  return first ?? best ?? { km: fromKm, offM: Infinity };
}

async function readFC(dir: string, file: string, issues: Issue[]) {
  try {
    return JSON.parse(await readFile(`${dir}/${file}`, "utf8"));
  } catch (e) {
    issues.push({ severity: "error", code: "GEOJSON_INVALID", message: `${file}: cannot read/parse (${(e as Error).message})` });
    return null;
  }
}

export async function validate(dir = "data/processed", opts: { wikipedia?: string; manual?: string } = {}) {
  const issues: Issue[] = [];
  const add = (code: string, message: string, extra: Partial<Issue> = {}) =>
    issues.push({ severity: CHECKS[code][0], code, message, ...extra });

  // ---------- 1. GeoJSON structure + bounds ----------
  const fcs: Record<string, { features: F<Record<string, unknown>>[] } | null> = {};
  for (const [key, [file, geomType]] of Object.entries(FILES)) {
    const fc = await readFC(dir, file, issues);
    if (!fc) continue;
    if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
      add("GEOJSON_INVALID", `${file}: not a FeatureCollection`);
      continue;
    }
    fcs[key] = fc;
    fc.features.forEach((f: F<Record<string, unknown>, { type: string; coordinates: unknown }>, i: number) => {
      const id = String(f?.properties?.id ?? f?.properties?.stationId ?? `#${i}`);
      if (f?.type !== "Feature" || f.geometry?.type !== geomType || !f.properties) {
        add("GEOJSON_INVALID", `${file} ${id}: expected a Feature with ${geomType} geometry and properties`, { featureIds: [id] });
        return;
      }
      const isPos = (p: unknown): p is LngLat => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n));
      const lines: unknown[] =
        geomType === "Point" ? [[f.geometry.coordinates]] : geomType === "LineString" ? [f.geometry.coordinates] : (f.geometry.coordinates as unknown[]);
      for (const ln of lines) {
        if (!Array.isArray(ln) || !ln.every(isPos) || (geomType !== "Point" && ln.length < 2)) {
          add("GEOJSON_INVALID", `${file} ${id}: malformed coordinates`, { featureIds: [id] });
          return;
        }
        for (const [lng, lat] of ln as LngLat[])
          if (lng < BBOX.minLng || lng > BBOX.maxLng || lat < BBOX.minLat || lat > BBOX.maxLat) {
            add("OUT_OF_BOUNDS", `${file} ${id}: [${lng}, ${lat}] is outside the NCR box (lat/lng swapped?)`, { featureIds: [id], location: [lng, lat] });
            return;
          }
        if (geomType !== "Point") {
          const dupes = (ln as LngLat[]).filter((p, j, a) => j > 0 && p[0] === a[j - 1][0] && p[1] === a[j - 1][1]).length;
          if (dupes) add("DEGENERATE_GEOMETRY", `${file} ${id}: ${dupes} repeated consecutive position(s)`, { featureIds: [id] });
        }
      }
    });
  }
  const required = ["lines", "routes", "segments", "stations", "interchanges"];
  if (required.some((k) => !fcs[k]) || issues.some((i) => i.code === "GEOJSON_INVALID")) return finish(issues, {}, [], dir);

  const lines = fcs.lines!.features as unknown as F<LineProps, Mls>[];
  const routes = fcs.routes!.features as unknown as F<RouteProps, Ls>[];
  const segments = fcs.segments!.features as unknown as F<SegmentProps, Ls>[];
  const stations = fcs.stations!.features as unknown as F<StationProps, Pt>[];
  const interchanges = fcs.interchanges!.features as unknown as F<InterchangeProps, Pt>[];

  // ---------- 2. Schema ----------
  const types: Record<string, Record<string, string>> = {
    lines: { id: "string", name: "string", color: "string", colorSource: "string", colorOfficial: "boolean", status: "string", branches: "array" },
    routes: { id: "string", lineId: "string", stationIds: "array", stopKm: "array", lengthKm: "number", geometryLengthKm: "number" },
    segments: { id: "string", lineId: "string", routeId: "string", fromStationId: "string", toStationId: "string", trackType: "string", trackTypeSource: "string", lengthKm: "number" },
    stations: { id: "string", name: "string", aliases: "array", refs: "array", lines: "array", isInterchange: "boolean", stationType: "string", platforms: "array", status: "string" },
    interchanges: { stationId: "string", name: "string", lines: "array", evidence: "string" },
    construction: { id: "string", status: "string", lengthKm: "number" },
  };
  const provenance = { source: "array", verified: "boolean", estimated: "boolean", conflicts: "array" };
  for (const [key, spec] of Object.entries(types)) {
    const withProv = key === "interchanges" ? spec : { ...spec, ...provenance };
    for (const f of fcs[key]?.features ?? []) {
      const p = f.properties;
      const id = String(p.id ?? p.stationId);
      for (const [k, t] of Object.entries(withProv)) {
        const v = p[k];
        if (t === "array" ? !Array.isArray(v) : typeof v !== t) add("SCHEMA", `${FILES[key as keyof typeof FILES][0]} ${id}: "${k}" should be ${t}`, { featureIds: [id] });
      }
    }
  }
  const enumCheck = (id: string, field: string, v: unknown, allowed: string[]) => {
    if (!allowed.includes(v as string)) add("SCHEMA", `${id}: ${field} "${v}" not in ${allowed.join("|")}`, { featureIds: [id] });
  };
  for (const l of lines) {
    if (!/^#[0-9A-F]{6}$/i.test(l.properties.color)) add("SCHEMA", `${l.properties.id}: colour "${l.properties.color}" is not #RRGGBB`, { featureIds: [l.properties.id] });
    enumCheck(l.properties.id, "status", l.properties.status, ["operational", "under_construction"]);
  }
  for (const s of segments) enumCheck(s.properties.id, "trackType", s.properties.trackType, INFRA);
  for (const s of stations) {
    const p = s.properties;
    enumCheck(p.id, "stationType", p.stationType, STATION_TYPES);
    for (const pl of p.platforms) enumCheck(p.id, `platform ${pl.lineId} trackType`, pl.trackType, INFRA);
    const pTypes = new Set(p.platforms.map((pl) => pl.trackType));
    const expected = pTypes.size === 1 ? [...pTypes][0] : "mixed";
    if (p.stationType !== expected) add("SCHEMA", `${p.id}: stationType "${p.stationType}" but platforms give "${expected}"`, { featureIds: [p.id], location: s.geometry.coordinates });
  }
  for (const i of interchanges) enumCheck(i.properties.stationId, "evidence", i.properties.evidence, ["osm-ref", "proximity", "manual"]);

  // ---------- 3. IDs ----------
  for (const [key, feats] of Object.entries({ lines, routes, segments, stations, interchanges })) {
    const seen = new Set<string>();
    for (const f of feats as F<{ id?: string; stationId?: string }>[]) {
      const id = (f.properties.id ?? f.properties.stationId)!;
      if (seen.has(id)) add("DUPLICATE_ID", `${FILES[key as keyof typeof FILES][0]}: id "${id}" appears more than once`, { featureIds: [id] });
      seen.add(id);
    }
  }

  const lineById = new Map(lines.map((l) => [l.properties.id, l]));
  const stationById = new Map(stations.map((s) => [s.properties.id, s]));
  const routeById = new Map(routes.map((r) => [r.properties.id, r]));
  const name = (id: string) => stationById.get(id)?.properties.name ?? id;

  // ---------- 4. Lines ↔ routes ----------
  for (const l of lines) {
    const p = l.properties;
    if (!l.geometry.coordinates.length) add("MISSING_GEOMETRY", `${p.id}: line has no geometry`, { featureIds: [p.id] });
    if (l.geometry.coordinates.length !== p.branches.length)
      add("MISSING_GEOMETRY", `${p.id}: ${l.geometry.coordinates.length} geometry parts for ${p.branches.length} branches`, { featureIds: [p.id] });
    for (const b of p.branches) {
      const r = routeById.get(b.id);
      if (!r) add("MISSING_GEOMETRY", `${p.id}: branch ${b.id} has no route`, { featureIds: [p.id, b.id] });
      else if (r.properties.stationIds.join() !== b.stationIds.join())
        add("BROKEN_REFERENCE", `${p.id}: branch ${b.id} station list differs from its route`, { featureIds: [p.id, b.id] });
    }
  }
  for (const r of routes)
    if (!lineById.get(r.properties.lineId)?.properties.branches.some((b) => b.id === r.properties.id))
      add("BROKEN_REFERENCE", `route ${r.properties.id}: not listed as a branch of line "${r.properties.lineId}"`, { featureIds: [r.properties.id] });

  // ---------- 5. Stations ↔ lines ----------
  const onRoute = new Map<string, Set<string>>(); // stationId → lines whose routes stop there
  for (const r of routes) {
    for (const id of r.properties.stationIds) {
      if (!stationById.has(id)) add("BROKEN_REFERENCE", `route ${r.properties.id}: unknown station "${id}"`, { featureIds: [r.properties.id, id] });
      onRoute.set(id, (onRoute.get(id) ?? new Set()).add(r.properties.lineId));
    }
    if (r.properties.stopKm.length !== r.properties.stationIds.length)
      add("SCHEMA", `route ${r.properties.id}: stopKm and stationIds have different lengths`, { featureIds: [r.properties.id] });
  }
  for (const s of stations) {
    const p = s.properties;
    const served = [...(onRoute.get(p.id) ?? [])].sort().join();
    if (!served) add("BROKEN_REFERENCE", `${p.id} (${p.name}): not on any route`, { featureIds: [p.id], location: s.geometry.coordinates });
    else if ([...p.lines].sort().join() !== served)
      add("BROKEN_REFERENCE", `${p.id} (${p.name}): lines [${p.lines}] but routes stop for [${served}]`, { featureIds: [p.id], location: s.geometry.coordinates });
    if ([...p.platforms.map((pl) => pl.lineId)].sort().join() !== [...p.lines].sort().join())
      add("BROKEN_REFERENCE", `${p.id}: platforms don't match lines`, { featureIds: [p.id] });
    for (const l of p.lines) if (!lineById.has(l)) add("BROKEN_REFERENCE", `${p.id}: unknown line "${l}"`, { featureIds: [p.id] });
  }

  // ---------- 6. Station order, distance to track ----------
  for (const r of routes) {
    const rp = r.properties;
    let prev = 0;
    rp.stationIds.forEach((id, i) => {
      const st = stationById.get(id);
      const pl = st?.properties.platforms.find((p) => p.lineId === rp.lineId);
      if (!st || !pl) return;
      const { km, offM } = locate(r.geometry.coordinates, pl.coordinates, prev);
      if (i > 0 && (km <= prev || !Number.isFinite(offM)))
        add("STATION_ORDER", `${rp.id}: ${name(id)} (#${i + 1}) does not come after ${name(rp.stationIds[i - 1])}`, { featureIds: [rp.id, id], location: pl.coordinates });
      else if (Math.abs(km - rp.stopKm[i]) > 0.1)
        add("STOP_KM_DRIFT", `${rp.id}: ${name(id)} projects to ${r3(km)} km, stopKm says ${rp.stopKm[i]}`, { featureIds: [rp.id, id], location: pl.coordinates });
      if (offM > 30 && Number.isFinite(offM))
        add("PLATFORM_FAR_FROM_TRACK", `${name(id)} ${rp.lineId} platform is ${Math.round(offM)} m from ${rp.id}`, { featureIds: [id], location: pl.coordinates });
      prev = Math.max(prev, km);
    });
  }
  // An interchange's point is the mean of its per-line stations, which can sit between lines joined by a
  // walkway; its per-line accuracy is covered by PLATFORM_FAR_FROM_TRACK, so it gets a looser limit.
  for (const s of stations)
    for (const lineId of s.properties.lines) {
      const limit = s.properties.isInterchange ? 300 : 150;
      const d = Math.min(...routes.filter((r) => r.properties.lineId === lineId).map((r) => locate(r.geometry.coordinates, s.geometry.coordinates, 0, Infinity).offM));
      if (d > limit) add("STATION_FAR_FROM_LINE", `${s.properties.name} is ${Math.round(d)} m from the ${lineId} line`, { featureIds: [s.properties.id], location: s.geometry.coordinates });
    }

  // ---------- 7. Segments ----------
  for (const r of routes) {
    const rp = r.properties;
    const segs = segments.filter((s) => s.properties.routeId === rp.id).sort((a, b) => a.properties.id.localeCompare(b.properties.id));
    const ids = rp.stationIds;
    if (!segs.length) {
      add("SEGMENT_GAP", `${rp.id}: no segments`, { featureIds: [rp.id] });
      continue;
    }
    let k = 0;
    segs.forEach((s, j) => {
      const sp = s.properties;
      if (sp.lineId !== rp.lineId) add("BROKEN_REFERENCE", `${sp.id}: lineId ${sp.lineId} ≠ route line ${rp.lineId}`, { featureIds: [sp.id] });
      if (sp.fromStationId !== ids[k] || sp.toStationId !== ids[k + 1]) {
        if (sp.fromStationId === ids[k + 1] && sp.toStationId === ids[k + 2]) k++;
        else add("SEGMENT_GAP", `${sp.id}: ${name(sp.fromStationId)} → ${name(sp.toStationId)} is out of sequence for ${rp.id}`, { featureIds: [sp.id], location: s.geometry.coordinates[0] });
      }
      if (j > 0) {
        const gap = meters(segs[j - 1].geometry.coordinates.at(-1)!, s.geometry.coordinates[0]);
        if (gap > 1) add("SEGMENT_GAP", `${rp.id}: ${Math.round(gap)} m gap before ${sp.id}`, { featureIds: [segs[j - 1].properties.id, sp.id], location: s.geometry.coordinates[0] });
      }
      const geomKm = length(s as never, { units: "kilometers" });
      if (Math.abs(geomKm - sp.lengthKm) > 0.005 + geomKm * 0.01)
        add("LENGTH_INCONSISTENT", `${sp.id}: lengthKm ${sp.lengthKm} but geometry is ${r3(geomKm)} km`, { featureIds: [sp.id] });
    });
    if (k !== ids.length - 2) add("SEGMENT_GAP", `${rp.id}: segments stop at ${name(ids[k + 1])}, route ends at ${name(ids.at(-1)!)}`, { featureIds: [rp.id] });
    const sum = segs.reduce((a, s) => a + s.properties.lengthKm, 0);
    if (Math.abs(sum - rp.lengthKm) > 0.01 + rp.lengthKm * 0.005)
      add("LENGTH_INCONSISTENT", `${rp.id}: segments total ${r3(sum)} km, route lengthKm ${rp.lengthKm}`, { featureIds: [rp.id] });
  }

  // ---------- 8. Interchanges ----------
  const ixById = new Map(interchanges.map((i) => [i.properties.stationId, i]));
  for (const s of stations) {
    const p = s.properties;
    if (p.isInterchange !== p.lines.length > 1)
      add("INTERCHANGE_MISMATCH", `${p.id} (${p.name}): isInterchange=${p.isInterchange} with ${p.lines.length} line(s)`, { featureIds: [p.id], location: s.geometry.coordinates });
    const ix = ixById.get(p.id);
    if (p.isInterchange && !ix) add("INTERCHANGE_MISMATCH", `${p.id} (${p.name}): missing from interchange_stations`, { featureIds: [p.id], location: s.geometry.coordinates });
    if (ix && ix.properties.lines.join() !== p.lines.join())
      add("INTERCHANGE_MISMATCH", `${p.id}: interchange lines [${ix.properties.lines}] ≠ station lines [${p.lines}]`, { featureIds: [p.id] });
  }
  for (const id of ixById.keys())
    if (!stationById.get(id)?.properties.isInterchange) add("INTERCHANGE_MISMATCH", `interchange ${id} is not an interchange station`, { featureIds: [id] });
  const manual = JSON.parse(await readFile(opts.manual ?? "data/manual/interchanges.json", "utf8"));
  for (const [a, b] of manual.merge as string[][]) {
    const present = [a, b].filter((id) => stationById.has(id));
    if (present.length !== 1) add("INTERCHANGE_MISMATCH", `manual merge ${a} + ${b} not applied (${present.length} of them still exist)`, { featureIds: [a, b] });
  }

  // ---------- 9. Connectivity ----------
  const parent = new Map(stations.map((s) => [s.properties.id, s.properties.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  for (const s of segments)
    if (parent.has(s.properties.fromStationId) && parent.has(s.properties.toStationId))
      parent.set(find(s.properties.fromStationId), find(s.properties.toStationId));
  const comps = new Map<string, string[]>();
  for (const id of parent.keys()) comps.set(find(id), [...(comps.get(find(id)) ?? []), id]);
  if (comps.size > 1) {
    const parts = [...comps.values()].sort((a, b) => b.length - a.length);
    for (const c of parts.slice(1))
      add("NETWORK_DISCONNECTED", `${c.length} station(s) unreachable from the main network: ${c.slice(0, 5).map(name).join(", ")}`, {
        featureIds: c,
        location: stationById.get(c[0])!.geometry.coordinates,
      });
  }

  // ---------- 10. Names and proximity ----------
  const byName = new Map<string, string[]>();
  for (const s of stations) {
    const k = s.properties.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    byName.set(k, [...(byName.get(k) ?? []), s.properties.id]);
  }
  for (const ids of byName.values())
    if (ids.length > 1) add("DUPLICATE_NAME", `"${name(ids[0])}" is used by ${ids.join(", ")}`, { featureIds: ids, location: stationById.get(ids[0])!.geometry.coordinates });
  for (let i = 0; i < stations.length; i++)
    for (let j = i + 1; j < stations.length; j++) {
      const [a, b] = [stations[i], stations[j]];
      const d = meters(a.geometry.coordinates, b.geometry.coordinates);
      if (d < 300)
        add("NEARBY_STATIONS", `${a.properties.name} and ${b.properties.name} are ${Math.round(d)} m apart but separate stations`, {
          featureIds: [a.properties.id, b.properties.id],
          location: a.geometry.coordinates,
        });
    }

  // ---------- 11. Reference figures (Wikipedia infobox) ----------
  const wikiPath = opts.wikipedia ?? `data/raw/wikipedia/${(await readdir("data/raw/wikipedia")).filter((f) => f.endsWith(".json")).sort().at(-1)}`;
  const wiki = JSON.parse(await readFile(wikiPath, "utf8")).lines as Record<string, { article: string; infobox?: { stations: number | null; lengthKm: number | null; perBranch: boolean } }>;
  const references = lines.map((l) => {
    const id = l.properties.id;
    const ib = wiki[id]?.infobox;
    const lr = routes.filter((r) => r.properties.lineId === id);
    // Infoboxes that list branches separately count a shared junction station once per branch.
    const ours = ib?.perBranch
      ? lr.reduce((a, r) => a + new Set(r.properties.stationIds).size, 0)
      : stations.filter((s) => s.properties.lines.includes(id)).length;
    const km = r3(lr.reduce((a, r) => a + r.properties.lengthKm, 0));
    const diffPct = ib?.lengthKm ? Math.round(((km - ib.lengthKm) / ib.lengthKm) * 1000) / 10 : null;
    if (ib?.stations != null && ib.stations !== ours)
      add("REFERENCE_COUNT", `${id}: ${ours} stations vs ${ib.stations} in Wikipedia (${wiki[id].article})`, { featureIds: [id] });
    if (diffPct !== null && Math.abs(diffPct) > 5)
      add("REFERENCE_LENGTH", `${id}: ${km} km vs ${ib!.lengthKm} km in Wikipedia (${diffPct > 0 ? "+" : ""}${diffPct}%)`, { featureIds: [id] });
    return { lineId: id, stations: ours, wikipediaStations: ib?.stations ?? null, lengthKm: km, wikipediaLengthKm: ib?.lengthKm ?? null, lengthDiffPct: diffPct };
  });

  // ---------- 12. Information ----------
  for (const f of [...lines, ...stations] as F<{ id: string; name: string; conflicts: string[] }, LngLat | Pt>[])
    for (const c of f.properties.conflicts)
      add("SOURCE_CONFLICT", `${f.properties.name}: ${c}`, { featureIds: [f.properties.id], ...("type" in (f.geometry as object) && (f.geometry as Pt).type === "Point" ? { location: (f.geometry as Pt).coordinates } : {}) });
  for (const s of stations)
    if (!s.properties.verified) add("UNVERIFIED_STATION", `${s.properties.name} (${s.properties.id})`, { featureIds: [s.properties.id], location: s.geometry.coordinates });
  corridorOverlaps(routes, add);

  // ---------- stats ----------
  const kmBy = (pred: (s: SegmentProps) => boolean) => r3(segments.filter((s) => pred(s.properties)).reduce((a, s) => a + s.properties.lengthKm, 0));
  const totalKm = kmBy(() => true);
  const stats = {
    lines: lines.length,
    routes: routes.length,
    stations: stations.length,
    interchanges: interchanges.length,
    interchangesByEvidence: Object.fromEntries(["osm-ref", "proximity", "manual"].map((e) => [e, interchanges.filter((i) => i.properties.evidence === e).length])),
    segments: segments.length,
    underConstructionWays: fcs.construction?.features.length ?? 0,
    trackKm: totalKm,
    trackKmByType: Object.fromEntries(INFRA.map((t) => [t, kmBy((s) => s.trackType === t)])),
    trackKmEstimatedPct: Math.round((kmBy((s) => s.estimated) / totalKm) * 1000) / 10,
    trackKmUnknownPct: Math.round((kmBy((s) => s.trackType === "unknown") / totalKm) * 1000) / 10,
    stationsByType: Object.fromEntries(STATION_TYPES.map((t) => [t, stations.filter((s) => s.properties.stationType === t).length])),
    stationsVerified: stations.filter((s) => s.properties.verified).length,
    stationsVerifiedPct: Math.round((stations.filter((s) => s.properties.verified).length / stations.length) * 1000) / 10,
    networkComponents: comps.size,
    perLine: Object.fromEntries(
      lines.map((l) => [
        l.properties.id,
        {
          stations: stations.filter((s) => s.properties.lines.includes(l.properties.id)).length,
          km: Object.fromEntries(INFRA.map((t) => [t, kmBy((s) => s.lineId === l.properties.id && s.trackType === t)])),
        },
      ]),
    ),
  };
  return finish(issues, stats, references, dir);
}

// Samples each route every 100 m; a sample within 5 m of another line's route counts as shared corridor.
function corridorOverlaps(routes: F<RouteProps, Ls>[], add: (code: string, msg: string, extra?: Partial<Issue>) => void) {
  for (const a of routes) {
    const cs = a.geometry.coordinates;
    const runs = new Map<string, { m: number; at: LngLat }>();
    let walked = 0;
    for (let i = 1; i < cs.length; i++) {
      walked += meters(cs[i - 1], cs[i]);
      if (walked < 100) continue;
      walked = 0;
      for (const b of routes) {
        if (b.properties.lineId <= a.properties.lineId) continue; // each pair once
        if (locate(b.geometry.coordinates, cs[i], 0, Infinity).offM < 5) {
          const run = runs.get(b.properties.id) ?? { m: 0, at: cs[i] };
          runs.set(b.properties.id, { m: run.m + 100, at: run.at });
        }
      }
    }
    for (const [other, { m, at }] of runs)
      if (m > 200) add("CORRIDOR_OVERLAP", `${a.properties.id} and ${other} share about ${m} m of corridor`, { featureIds: [a.properties.id, other], location: at });
  }
}

function finish(issues: Issue[], stats: object, references: object[], dir: string) {
  const count = (s: Severity) => issues.filter((i) => i.severity === s).length;
  return {
    generatedAt: new Date().toISOString(),
    input: dir,
    passed: count("error") === 0,
    summary: { errors: count("error"), warnings: count("warning"), info: count("info") },
    checks: Object.entries(CHECKS).map(([code, [severity, description]]) => {
      const n = issues.filter((i) => i.code === code).length;
      return { code, severity, description, issues: n, status: n ? (severity === "info" ? "noted" : "fail") : "pass" };
    }),
    stats,
    references,
    issues,
  };
}

if (import.meta.main) {
  const [dir = "data/processed", out = "data/metadata/validation_report.json"] = process.argv.slice(2);
  const report = await validate(dir);
  await writeFile(out, JSON.stringify(report, null, 2));
  for (const c of report.checks) console.log(`${c.status.padEnd(5)} ${c.severity.padEnd(7)} ${c.code.padEnd(24)} ${c.issues || ""}`);
  console.log(`\n${report.passed ? "PASSED" : "FAILED"}: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.info} info → ${out}`);
  if (!report.passed) process.exitCode = 1;
}
