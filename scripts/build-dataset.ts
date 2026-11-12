// raw (latest OSM + Wikipedia snapshots) + data/manual → data/processed/*.geojson + data/metadata.
// OSM is the primary source; Wikipedia only cross-checks station layout. See docs/ARCHITECTURE.md.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { distance, lineString, nearestPointOnLine } from "@turf/turf";
import type { Feature, LineString } from "geojson";
import type {
  ConstructionProps,
  InfraType,
  InterchangeProps,
  LineProps,
  Platform,
  RouteProps,
  SegmentProps,
  StationProps,
  StationType,
  TransferProps,
} from "../src/data/types.ts";

type Tags = Record<string, string>;
type LngLat = [number, number];
type OsmEl = {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Tags;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  members?: { type: OsmEl["type"]; ref: number; role: string }[];
};
type LineCfg = {
  id: string;
  name: string;
  osmRouteMaster: number;
  color: string;
  colorSource: string;
  official: boolean;
  wikipedia: string;
  system?: string;
  statusSource?: string;
  expectedStations?: number;
  stationSuffix?: string;
  branches: { id: string; osmRoute: number; osmReverse: number }[];
};
type Issue = { severity: "error" | "warning" | "info"; code: string; message: string; ids?: string[] };

const latest = async (dir: string) => {
  const file = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort().at(-1);
  if (!file) throw new Error(`No snapshot in ${dir}; run the fetch scripts first`);
  return `${dir}/${file}`;
};
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

const osmPath = await latest("data/raw/osm");
const wikiPath = await latest("data/raw/wikipedia");
const osm = await readJson(osmPath);
const wiki = await readJson(wikiPath);
const { lines: dmrcCfgs } = (await readJson("data/manual/lines.json")) as { lines: LineCfg[] };
const { lines: regionalCfgs } = (await readJson("data/manual/regional-lines.json")) as { lines: LineCfg[] };
const lineCfgs = [...dmrcCfgs, ...regionalCfgs];
const regionalPath = await latest("data/raw/regional");
const regional = await readJson(regionalPath);
const manualIx = await readJson("data/manual/interchanges.json");
const { overrides } = await readJson("data/manual/station_overrides.json");

const issues: Issue[] = [];
const issue = (severity: Issue["severity"], code: string, message: string, ids?: string[]) =>
  issues.push({ severity, code, message, ...(ids && { ids }) });

// ---------- helpers ----------
const el = new Map<string, OsmEl>();
for (const e of [...osm.elements, ...regional.elements] as OsmEl[]) el.set(`${e.type}/${e.id}`, e);
const get = (type: string, id: number) => el.get(`${type}/${id}`);

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const r3 = (n: number) => Math.round(n * 1e3) / 1e3;
const pos = (e: OsmEl): LngLat => (e.center ? [e.center.lon, e.center.lat] : [e.lon!, e.lat!]);
const mean = (ps: LngLat[]): LngLat => [
  r6(ps.reduce((s, p) => s + p[0], 0) / ps.length),
  r6(ps.reduce((s, p) => s + p[1], 0) / ps.length),
];
const meters = (a: LngLat, b: LngLat) => distance(a, b, { units: "kilometers" }) * 1000;
// "Rajiv Chowk (Blue Line)" → "Rajiv Chowk", "Sarai Metro Station" → "Sarai"; also the Hindi "(… लाइन)" suffix.
const stripLine = (name: string) =>
  name
    .replace(/\s*\([^()]*(Line|लाइन)[^()]*\)\s*$/i, "")
    .replace(/\s+Metro Station$/i, "")
    .trim();
// Loose key for matching names across sources: drops any parenthetical, punctuation and case.
const norm = (name: string) =>
  stripLine(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");

function levenshtein(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Match an OSM station to a Wikipedia table row despite spelling drift ("Lal Quila" / "Lal Qila").
// Returns null rather than guess when more than one row qualifies.
function wikiMatch<T extends { name: string }>(rows: T[], names: string[]): T | null {
  const keys = (n: string) => {
    const base = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(metro)?station$/, "");
    return [base(stripLine(n).replace(/\([^)]*\)/g, "")), base(stripLine(n))];
  };
  const ours = names.flatMap(keys);
  const exact = rows.find((r) => keys(r.name).some((k) => ours.includes(k)));
  if (exact) return exact;
  const close = (a: string, b: string) => {
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    if (1 - levenshtein(a, b) / l.length >= 0.85) return true;
    return s.length >= 8 && s.length / l.length >= 0.6 && l.includes(s);
  };
  const hits = rows.filter((r) => keys(r.name).some((k) => ours.some((o) => close(k, o))));
  return hits.length === 1 ? hits[0] : null;
}

function classify(t: Tags): [InfraType, string] {
  const layer = Number(t.layer ?? 0);
  if (t.tunnel === "building_passage") return ["unknown", "osm:tunnel=building_passage"];
  if (t.tunnel && t.tunnel !== "no") return ["underground", "osm:tunnel"];
  if (t.bridge && t.bridge !== "no") return ["elevated", "osm:bridge"];
  if (layer < 0) return ["underground", "osm:layer"];
  if (layer > 0) return ["elevated", "osm:layer"];
  for (const k of ["cutting", "embankment", "covered"]) if (t[k] && t[k] !== "no") return ["at_grade", `osm:${k}`];
  // OSM convention: no bridge/tunnel tag means ground level. Flagged as estimated downstream.
  return ["at_grade", "osm:untagged"];
}

// ---------- track geometry ----------
type WayPart = { wayId: number; fromKm: number; toKm: number; type: InfraType; src: string };
type Track = { coords: LngLat[]; cum: number[]; parts: WayPart[]; line: Feature<LineString> };

function buildTrack(route: OsmEl, branchId: string): Track {
  const ways = route.members!.filter((m) => m.type === "way" && m.role === "").map((m) => get("way", m.ref));
  if (ways.some((w) => !w?.geometry)) issue("error", "MISSING_ELEMENT", `${branchId}: route way missing from snapshot`);
  const ok = ways.filter((w): w is OsmEl => !!w?.geometry);
  const geoms = ok.map((w) => w.geometry!.map((p): LngLat => [p.lon, p.lat]));
  const key = (c: LngLat) => `${c[0]},${c[1]}`;
  const coords: LngLat[] = [];
  const ranges: [number, number][] = [];
  geoms.forEach((g, i) => {
    let seg = g;
    if (i === 0 && geoms.length > 1) {
      const next = [key(geoms[1][0]), key(geoms[1].at(-1)!)];
      if (!next.includes(key(seg.at(-1)!)) && next.includes(key(seg[0]))) seg = [...seg].reverse();
    } else if (i > 0) {
      const last = coords.at(-1)!;
      if (key(seg[0]) !== key(last)) {
        if (key(seg.at(-1)!) === key(last)) seg = [...seg].reverse();
        else {
          if (meters(seg.at(-1)!, last) < meters(seg[0], last)) seg = [...seg].reverse();
          issue("error", "CHAIN_GAP", `${branchId}: ${Math.round(meters(seg[0], last))} m gap before way ${ok[i].id}`, [
            `osm:way/${ok[i - 1].id}`,
            `osm:way/${ok[i].id}`,
          ]);
        }
      }
    }
    const start = coords.length ? coords.length - 1 : 0;
    coords.push(...(coords.length && key(seg[0]) === key(coords.at(-1)!) ? seg.slice(1) : seg));
    ranges.push([start, coords.length - 1]);
  });
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + meters(coords[i - 1], coords[i]) / 1000);
  const parts = ok.map((w, i) => {
    const [type, src] = classify(w.tags ?? {});
    return { wayId: w.id, fromKm: cum[ranges[i][0]], toKm: cum[ranges[i][1]], type, src };
  });
  return { coords, cum, parts, line: lineString(coords) };
}

const partAt = (t: Track, km: number) => t.parts.find((p) => km >= p.fromKm && km <= p.toKm) ?? t.parts.at(-1)!;

// Slice by the track's own cumulative distances. turf.lineSliceAlong throws when `to` rounds past the end.
function slice(t: Track, from: number, to: number): LngLat[] {
  const at = (km: number): LngLat => {
    // km can overshoot the last vertex by float error (turf vs our distances); clamp to the final segment.
    const j = t.cum.findIndex((c) => c >= km);
    const i = Math.max(0, Math.min((j === -1 ? t.cum.length : j) - 1, t.cum.length - 2));
    const f = Math.min(1, Math.max(0, (km - t.cum[i]) / (t.cum[i + 1] - t.cum[i] || 1)));
    return [t.coords[i][0] + f * (t.coords[i + 1][0] - t.coords[i][0]), t.coords[i][1] + f * (t.coords[i + 1][1] - t.coords[i][1])];
  };
  return [at(from), ...t.coords.filter((_, i) => t.cum[i] > from && t.cum[i] < to), at(to)];
}

// Snap forward from the previous stop, so loop lines (Pink passes Maujpur-Babarpur twice) snap to the right pass.
function locate(t: Track, p: LngLat, fromKm: number) {
  const total = t.cum.at(-1)!;
  const sub = fromKm > 0 && total - fromKm > 0.001 ? lineString(slice(t, fromKm, total)) : t.line;
  const np = nearestPointOnLine(sub, p, { units: "kilometers" });
  return { km: (sub === t.line ? 0 : fromKm) + np.properties.totalDistance, offM: np.properties.pointDistance * 1000 };
}

// ---------- stops → physical stations ----------
const stationEls = [...el.values()].filter((e) => e.tags?.railway === "station");
const areaOfNode = new Map<number, OsmEl>();
for (const e of el.values())
  if (e.tags?.public_transport === "stop_area")
    for (const m of e.members!) if (m.type === "node") areaOfNode.set(m.ref, e);

function stationObjOf(stop: OsmEl): OsmEl | null {
  const area = areaOfNode.get(stop.id);
  const inArea = area?.members!.map((m) => get(m.type, m.ref)).find((e) => e?.tags?.railway === "station");
  if (inArea) return inArea;
  // Fallback: nearest same-name station object within 400 m.
  const name = norm(stop.tags?.name ?? "");
  const cand = stationEls
    .filter((s) => norm(s.tags?.name ?? "") === name)
    .map((s) => ({ s, d: meters(pos(s), pos(stop)) }))
    .sort((a, b) => a.d - b.d)[0];
  if (cand && cand.d < 400) {
    issue("info", "STOP_AREA_FALLBACK", `Stop "${stop.tags?.name}" has no stop_area; matched station object by name (${Math.round(cand.d)} m)`, [
      `osm:node/${stop.id}`,
    ]);
    return cand.s;
  }
  issue("warning", "STOP_NO_STATION", `Stop "${stop.tags?.name}" has no station object; coordinates from stop position`, [
    `osm:node/${stop.id}`,
  ]);
  return null;
}

const baseId = (stop: OsmEl, st: OsmEl | null) =>
  st?.tags?.ref
    ? `stn_${st.tags.ref.toLowerCase()}`
    : st
      ? `stn_osm_${st.type[0]}${st.id}`
      : `stn_name_${norm(stop.tags?.name ?? String(stop.id))}`;
// Station codes are operator-local. NCRTC's RRTS and Meerut services deliberately share a namespace.
const provisionalId = (stop: OsmEl, st: OsmEl | null, system?: string) =>
  baseId(stop, st).replace(/^stn_/, `stn_${system ? `${system}_` : ""}`);

type Entry = { pid: string; lineId: string; branchId: string; stop: OsmEl; station: OsmEl | null; km?: number };
const entries: Entry[] = [];
const tracks = new Map<string, Track>();
const branchStops = new Map<string, Entry[]>();
const stationCache = new Map<number, OsmEl | null>();
const stationOf = (stop: OsmEl) => {
  if (!stationCache.has(stop.id)) stationCache.set(stop.id, stationObjOf(stop));
  return stationCache.get(stop.id)!;
};

const stopsOf = (route: OsmEl) =>
  route.members!.filter((m) => m.type === "node" && m.role.startsWith("stop")).map((m) => get("node", m.ref)!);

for (const line of lineCfgs) {
  for (const b of line.branches) {
    const route = get("relation", b.osmRoute);
    const reverse = get("relation", b.osmReverse);
    if (!route || !reverse) {
      issue("error", "MISSING_ELEMENT", `${b.id}: route relation ${b.osmRoute}/${b.osmReverse} not in snapshot`);
      continue;
    }
    const track = buildTrack(route, b.id);
    tracks.set(b.id, track);
    let prevKm = 0;
    const own: Entry[] = [];
    for (const stop of stopsOf(route)) {
      const st = stationOf(stop);
      const { km, offM } = locate(track, pos(stop), prevKm);
      if (offM > 50)
        issue("warning", "STOP_OFF_TRACK", `${b.id}: stop "${stop.tags?.name}" is ${Math.round(offM)} m from the track`, [`osm:node/${stop.id}`]);
      if (own.length && km <= prevKm) issue("error", "STOP_ORDER", `${b.id}: stop "${stop.tags?.name}" is not after the previous stop`);
      prevKm = km;
      own.push({ pid: provisionalId(stop, st, line.system), lineId: line.id, branchId: b.id, stop, station: st, km });
    }
    branchStops.set(b.id, own);
    entries.push(...own);
    const rev = stopsOf(reverse).map((stop) => {
      const st = stationOf(stop);
      return { pid: provisionalId(stop, st, line.system), lineId: line.id, branchId: b.id, stop, station: st };
    });
    entries.push(...rev);
    const fwd = own.map((e) => e.pid).join(">");
    const back = rev.map((e) => e.pid).reverse().join(">");
    if (fwd !== back) issue("warning", "REVERSE_ORDER_MISMATCH", `${b.id}: opposite-direction route ${b.osmReverse} has a different stop sequence`);
  }
}

// ---------- merge into physical stations ----------
const groups = new Map<string, Entry[]>();
for (const e of entries) groups.set(e.pid, [...(groups.get(e.pid) ?? []), e]);
const groupPos = (es: Entry[]) => {
  const sts = [...new Set(es.map((e) => e.station).filter((s): s is OsmEl => !!s))];
  return sts.length ? mean(sts.map(pos)) : mean(es.map((e) => pos(e.stop)));
};

const parent = new Map<string, string>();
const find = (x: string): string => (parent.get(x) ?? x) === x ? x : find(parent.get(x)!);
const evidence = new Map<string, InterchangeProps["evidence"]>();
// The merged station keeps a DMRC-code id (stn_ptp) over an OSM-id fallback (stn_osm_n…).
const idRank = (id: string) => `${/^stn_(osm|name)_/.test(id) ? 1 : 0}${id}`;
const union = (a: string, b: string, how: InterchangeProps["evidence"]) => {
  const [ra, rb] = [find(a), find(b)].sort((x, y) => idRank(x).localeCompare(idRank(y)));
  if (ra === rb) return;
  parent.set(rb, ra);
  evidence.set(ra, how);
};
const blocked = new Set((manualIx.separate as string[][]).map(([a, b]) => [a, b].sort().join("|")));
const pids = [...groups.keys()].sort();
for (let i = 0; i < pids.length; i++) {
  for (let j = i + 1; j < pids.length; j++) {
    const [a, b] = [pids[i], pids[j]];
    const la = new Set(groups.get(a)!.map((e) => e.lineId));
    if (groups.get(b)!.some((e) => la.has(e.lineId))) continue;
    // Cross-operator proximity does not prove an interchange; regional links are explicit walking edges.
    if (groups.get(a)!.some(e => regionalCfgs.some(l => l.id === e.lineId)) || groups.get(b)!.some(e => regionalCfgs.some(l => l.id === e.lineId))) continue;
    const d = meters(groupPos(groups.get(a)!), groupPos(groups.get(b)!));
    if (d > manualIx.proximityMeters || blocked.has(`${a}|${b}`)) continue;
    union(a, b, "proximity");
    issue("info", "PROXIMITY_MERGE", `Merged ${a} + ${b} as one interchange (${Math.round(d)} m apart, different refs)`, [a, b]);
  }
}
for (const [a, b] of manualIx.merge as string[][]) union(a, b, "manual");

const merged = new Map<string, Entry[]>();
for (const [pid, es] of groups) merged.set(find(pid), [...(merged.get(find(pid)) ?? []), ...es]);
const finalId = (pid: string) => find(pid);

// ---------- station features ----------
const lineOrder = lineCfgs.map((l) => l.id);
const wikiLines = wiki.lines as Record<string, { article: string; revid: number; stations: { name: string; layout: InfraType }[] }>;
const wikiSource = (lineId: string) => `wikipedia:${wikiLines[lineId].article.replace(/ /g, "_")}@${wikiLines[lineId].revid}`;
const mostCommon = (xs: string[]) => {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0][0];
};

const stationFeatures: Feature<{ type: "Point"; coordinates: LngLat }, StationProps>[] = [];
for (const [id, es] of [...merged].sort((a, b) => a[0].localeCompare(b[0]))) {
  const sts = [...new Map(es.filter((e) => e.station).map((e) => [`${e.station!.type}/${e.station!.id}`, e.station!])).values()];
  const stationNames = sts.map((s) => stripLine(s.tags?.name ?? "")).filter(Boolean);
  const stopNames = es.map((e) => stripLine(e.stop.tags?.name ?? "")).filter(Boolean);
  const name = mostCommon(stationNames.length ? stationNames : stopNames);
  const rawNames = [...sts.map((s) => s.tags?.name ?? ""), ...es.map((e) => e.stop.tags?.name ?? ""), ...stationNames, ...stopNames];
  const aliases = [...new Set(rawNames.filter((n) => n && n !== name))].sort();
  if (new Set([...stationNames, ...stopNames].map(norm)).size > 1)
    issue("info", "NAME_VARIANTS", `${id}: OSM uses several names (${[name, ...aliases].join(" / ")})`, [id]);
  const lines = lineOrder.filter((l) => es.some((e) => e.lineId === l));
  const displaySuffix = lines.length === 1 ? lineCfgs.find(l => l.id === lines[0])?.stationSuffix : undefined;
  if (displaySuffix && !aliases.includes(name)) aliases.push(name);
  const conflicts: string[] = [];
  const source = new Set<string>([...sts.map((s) => `osm:${s.type}/${s.id}`)]);
  let allVerified = sts.length > 0;
  const ov = overrides[id];

  const platforms: Platform[] = lines.map((lineId) => {
    const les = es.filter((e) => e.lineId === lineId);
    const located = les.filter((e) => e.km !== undefined);
    const types = located.map((e) => {
      const p = partAt(tracks.get(e.branchId)!, e.km!);
      return [p.type, p.src] as const;
    });
    if (new Set(types.map((t) => t[0])).size > 1) conflicts.push(`${lineId}: track type differs between branches (${types.map((t) => t[0]).join("/")})`);
    let [trackType, trackTypeSource]: [InfraType, string] = types[0] ? [types[0][0], types[0][1]] : ["unknown", "none"];
    const w = wikiMatch(wikiLines[lineId]?.stations ?? [], [name, ...aliases]);
    const wikipediaLayout = w?.layout ?? null;
    if (w) source.add(wikiSource(lineId));
    if (!w) {
      allVerified = false;
      issue("warning", "WIKI_UNMATCHED", `${id} (${name}) not found in the ${lineId} Wikipedia table`, [id]);
    } else if (wikipediaLayout !== trackType) {
      const weak = trackTypeSource === "osm:untagged" || trackType === "unknown";
      conflicts.push(`${lineId}: OSM track ${trackType} (${trackTypeSource}) vs Wikipedia ${wikipediaLayout}`);
      issue(weak ? "info" : "warning", "TYPE_CONFLICT", `${id} (${name}) ${lineId}: OSM ${trackType} (${trackTypeSource}) vs Wikipedia ${wikipediaLayout}${weak ? "; using Wikipedia" : "; keeping OSM"}`, [id]);
      // An explicit OSM bridge/tunnel tag outranks Wikipedia; an untagged way does not.
      if (weak) [trackType, trackTypeSource] = [wikipediaLayout!, "wikipedia"];
      else allVerified = false;
    }
    const manual = ov?.platformTrackType?.[lineId] as InfraType | undefined;
    if (manual) [trackType, trackTypeSource] = [manual, "manual"];
    for (const e of les) source.add(`osm:node/${e.stop.id}`);
    return { lineId, coordinates: mean(les.map((e) => pos(e.stop))), trackType, trackTypeSource, wikipediaName: w?.name ?? null, wikipediaLayout };
  });

  const types = new Set(platforms.map((p) => p.trackType));
  const stationType: StationType = types.size === 1 ? [...types][0] : "mixed";
  if (ov) source.add("manual:station_overrides.json");
  const refs = [...new Set(sts.map((s) => s.tags?.ref).filter((r): r is string => !!r))].sort();
  if (!refs.length) issue("info", "STATION_NO_REF", `${id} (${name}) has no DMRC station code in OSM`, [id]);
  stationFeatures.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: groupPos(es) },
    properties: {
      id,
      name: ov?.name ?? `${name}${displaySuffix ?? ""}`,
      name_hi: sts.map((s) => s.tags?.["name:hi"]).find(Boolean)?.replace(/\s*\([^()]*लाइन[^()]*\)\s*$/, "") ?? null,
      aliases,
      refs,
      lines,
      isInterchange: lines.length > 1,
      stationType,
      platforms,
      status: "operational",
      source: [...source],
      verified: allVerified,
      estimated: sts.length === 0,
      conflicts,
    },
  });
}

// ---------- routes, segments, lines ----------
// Rounding can collapse a cut point onto its neighbouring vertex, so drop consecutive repeats.
const coords6 = (cs: LngLat[]): LngLat[] =>
  cs.map(([x, y]): LngLat => [r6(x), r6(y)]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
const routeFeatures: Feature<LineString, RouteProps>[] = [];
const segmentFeatures: Feature<LineString, SegmentProps>[] = [];
const lineFeatures: Feature<{ type: "MultiLineString"; coordinates: LngLat[][] }, LineProps>[] = [];
const stationProps = new Map(stationFeatures.map((f) => [f.properties.id, f.properties]));

// An untagged OSM stretch between two stretches of the same explicit type usually just lacks its
// bridge/tunnel tag (imagery shows Tis Hazari and Adarsh Nagar on viaducts). Inherit that type only when
// every station inside the stretch has the same type on Wikipedia, or when no station is inside and it
// is under 300 m. Ramps between levels and real at-grade sections (Shastri Park) are left alone.
function inferUntagged(segs: Feature<LineString, SegmentProps>[], lineId: string) {
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].properties.trackTypeSource !== "osm:untagged") continue;
    let j = i;
    while (segs[j + 1]?.properties.trackTypeSource === "osm:untagged") j++;
    const [before, after] = [segs[i - 1]?.properties, segs[j + 1]?.properties];
    const type = before?.trackType;
    const run = segs.slice(i, j + 1);
    i = j;
    if (!before || !after || type !== after.trackType || (type !== "elevated" && type !== "underground")) continue;
    // A station sits between two segments of the run wherever the station pair advances.
    const inside = run.slice(1).filter((s, k) => s.properties.fromStationId !== run[k].properties.fromStationId).map((s) => s.properties.fromStationId);
    const km = run.reduce((a, s) => a + s.properties.lengthKm, 0);
    const layouts = inside.map((id) => stationProps.get(id)?.platforms.find((p) => p.lineId === lineId)?.wikipediaLayout);
    if (inside.length ? !layouts.every((l) => l === type) : km >= 0.3) continue;
    for (const s of run) Object.assign(s.properties, { trackType: type, trackTypeSource: "inferred:neighbours" });
    issue("info", "TRACK_TYPE_INFERRED", `${run[0].properties.id}…: ${r3(km)} km untagged track set to ${type} (both neighbours ${type}${inside.length ? `; Wikipedia agrees at ${inside.map((id) => stationProps.get(id)?.name).join(", ")}` : ""})`, run.map((s) => s.properties.id));
  }
}

for (const line of lineCfgs) {
  const branchesOut: LineProps["branches"] = [];
  const multi: LngLat[][] = [];
  for (const b of line.branches) {
    const track = tracks.get(b.id);
    const stops = branchStops.get(b.id);
    if (!track || !stops?.length) continue;
    const stationIds = stops.map((e) => finalId(e.pid));
    const stopKm = stops.map((e) => r3(e.km!));
    branchesOut.push({ id: b.id, stationIds });
    multi.push(coords6(track.coords));
    routeFeatures.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords6(track.coords) },
      properties: {
        id: b.id,
        lineId: line.id,
        stationIds,
        stopKm,
        lengthKm: r3(stops.at(-1)!.km! - stops[0].km!),
        geometryLengthKm: r3(track.cum.at(-1)!),
        source: [`osm:relation/${b.osmRoute}`, `osm:relation/${b.osmReverse}`],
        verified: false,
        estimated: false,
        conflicts: [],
      },
    });
    // Cut points: every stop, plus every place the infrastructure type changes.
    const typeBreaks = track.parts.slice(1).filter((p, i) => p.type !== track.parts[i].type).map((p) => p.fromKm);
    const branchStart = segmentFeatures.length;
    let n = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const [a, z] = [stops[i].km!, stops[i + 1].km!];
      if (z <= a) continue; // already reported as STOP_ORDER
      const cuts = [a, ...typeBreaks.filter((k) => k > a && k < z), z];
      for (let c = 0; c < cuts.length - 1; c++) {
        const [from, to] = [cuts[c], cuts[c + 1]];
        if (to - from < 0.001) continue;
        const part = partAt(track, (from + to) / 2);
        const ways = track.parts.filter((p) => p.toKm > from && p.fromKm < to).map((p) => `osm:way/${p.wayId}`);
        segmentFeatures.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords6(slice(track, from, to)) },
          properties: {
            id: `${b.id}_${String(n++).padStart(3, "0")}`,
            lineId: line.id,
            routeId: b.id,
            fromStationId: finalId(stops[i].pid),
            toStationId: finalId(stops[i + 1].pid),
            trackType: part.type,
            trackTypeSource: part.src,
            lengthKm: r3(to - from),
            source: ways,
            verified: false,
            estimated: part.src === "osm:untagged" || part.type === "unknown",
            conflicts: [],
          },
        });
      }
    }
    inferUntagged(segmentFeatures.slice(branchStart), line.id);
  }
  const master = get("relation", line.osmRouteMaster);
  const osmColour = master?.tags?.colour;
  const conflicts =
    osmColour && osmColour.toUpperCase() !== line.color.toUpperCase() ? [`OSM colour ${osmColour} differs from ${line.colorSource} ${line.color}`] : [];
  lineFeatures.push({
    type: "Feature",
    geometry: { type: "MultiLineString", coordinates: multi },
    properties: {
      id: line.id,
      name: line.name,
      color: line.color,
      colorSource: line.colorSource,
      colorOfficial: line.official,
      status: "operational",
      branches: branchesOut,
      source: [`osm:relation/${line.osmRouteMaster}`, ...(line.statusSource ? [line.statusSource, "manual:regional-lines.json"] : ["manual:lines.json"])],
      verified: false,
      estimated: false,
      conflicts,
    },
  });
}

// ---------- interchanges ----------
const interchangeFeatures = stationFeatures
  .filter((f) => f.properties.isInterchange)
  .map(
    (f): Feature<{ type: "Point"; coordinates: LngLat }, InterchangeProps> => ({
      type: "Feature",
      geometry: f.geometry,
      properties: { stationId: f.properties.id, name: f.properties.name, lines: f.properties.lines, evidence: evidence.get(f.properties.id) ?? "osm-ref" },
    }),
  );

// ---------- under construction ----------
const constructionFeatures = [...el.values()]
  .filter((e) => e.type === "way" && e.tags?.railway === "construction" && e.geometry)
  .map((w): Feature<LineString, ConstructionProps> => {
    const cs = coords6(w.geometry!.map((p): LngLat => [p.lon, p.lat]));
    let km = 0;
    for (let i = 1; i < cs.length; i++) km += meters(cs[i - 1], cs[i]) / 1000;
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: cs },
      // lineId stays null: OSM construction ways don't say which line they belong to.
      properties: { id: `uc_way_${w.id}`, name: w.tags?.name ?? null, lineId: null, status: "under_construction", lengthKm: r3(km), source: [`osm:way/${w.id}`], verified: false, estimated: false, conflicts: [] },
    };
  });

// ---------- write ----------
const transferCfg = await readJson("data/manual/transfers.json") as { transfers: { id: string; from: { lineId: string; name: string }; to: { lineId: string; name: string }; walkSeconds: number; source: string[]; note: string }[] };
const transferFeatures = transferCfg.transfers.map(t => {
  const resolve = (end: typeof t.from) => {
    const hits = stationFeatures.filter(f => f.properties.lines.includes(end.lineId) && [f.properties.name, ...f.properties.aliases].some(n => norm(n) === norm(end.name)));
    if (hits.length !== 1) throw new Error(`${t.id}: ${end.lineId}/${end.name} resolves to ${hits.length} stations`);
    return hits[0];
  };
  const from = resolve(t.from), to = resolve(t.to);
  return { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: [from.geometry.coordinates, to.geometry.coordinates] }, properties: {
    id: t.id, fromStationId: from.properties.id, toStationId: to.properties.id, walkSeconds: t.walkSeconds,
    note: t.note, source: t.source, estimated: true, verified: false, conflicts: [],
  } satisfies TransferProps };
});
const fc = (features: unknown[]) => `{"type":"FeatureCollection","features":[\n${features.map((f) => JSON.stringify(f)).join(",\n")}\n]}\n`;
await mkdir("data/processed", { recursive: true });
await mkdir("data/metadata", { recursive: true });
await writeFile("data/processed/metro_lines.geojson", fc(lineFeatures));
await writeFile("data/processed/metro_routes.geojson", fc(routeFeatures));
await writeFile("data/processed/metro_segments.geojson", fc(segmentFeatures));
await writeFile("data/processed/metro_stations.geojson", fc(stationFeatures));
await writeFile("data/processed/interchange_stations.geojson", fc(interchangeFeatures));
await writeFile("data/processed/station_transfers.geojson", fc(transferFeatures));
await writeFile("data/processed/metro_under_construction.geojson", fc(constructionFeatures));

const generatedAt = new Date().toISOString();
await writeFile(
  "data/metadata/sources.json",
  JSON.stringify(
    {
      generatedAt,
      sources: [
        {
          id: "osm",
          name: "OpenStreetMap via Overpass API",
          url: osm.endpoint,
          licence: "ODbL-1.0",
          attribution: "© OpenStreetMap contributors",
          snapshot: osm.osm3s.timestamp_osm_base,
          file: osmPath,
          usedFor: "track geometry, track type (bridge/tunnel/layer tags), stops, stations, station codes, interchanges",
        },
        {
          id: "osm-regional", name: "OpenStreetMap regional networks via OSM API", url: regional.endpoint,
          licence: "ODbL-1.0", attribution: "© OpenStreetMap contributors", snapshot: regional.fetchedAt, file: regionalPath,
          usedFor: "Aqua Line, Namo Bharat and Meerut Metro tracks, stops, stations and colours",
        },
        { id: "regional-operators", urls: regionalCfgs.map(l => l.statusSource), usedFor: "operational status and station counts; see data/manual/transfers.json for connection evidence" },
        {
          id: "wikipedia",
          name: "English Wikipedia line articles (station tables)",
          licence: "CC BY-SA 4.0",
          fetchedAt: wiki.fetchedAt,
          file: wikiPath,
          revisions: Object.fromEntries(Object.entries(wikiLines).map(([k, v]) => [k, `${v.article}@${v.revid}`])),
          usedFor: "cross-check of station layout; overrides only untagged OSM track",
        },
        { id: "wikidata", name: "Wikidata P465 (sRGB colour)", licence: "CC0-1.0", usedFor: "line colours (see colorSource per line)" },
        { id: "manual", files: ["data/manual/lines.json", "data/manual/regional-lines.json", "data/manual/transfers.json", "data/manual/interchanges.json", "data/manual/station_overrides.json"], usedFor: "line config, explicit walking links, interchange and station corrections" },
      ],
    },
    null,
    2,
  ),
);

const count = (code: string) => issues.filter((i) => i.code === code).length;
const report = {
  generatedAt,
  inputs: { osm: osmPath, osmSnapshot: osm.osm3s.timestamp_osm_base, regional: regionalPath, regionalFetchedAt: regional.fetchedAt, wikipedia: wikiPath },
  counts: {
    lines: lineFeatures.length,
    routes: routeFeatures.length,
    stations: stationFeatures.length,
    interchanges: interchangeFeatures.length,
    walkingTransfers: transferFeatures.length,
    segments: segmentFeatures.length,
    underConstructionWays: constructionFeatures.length,
    stationsVerified: stationFeatures.filter((f) => f.properties.verified).length,
    stationsWithConflicts: stationFeatures.filter((f) => f.properties.conflicts.length).length,
    stationsByType: Object.fromEntries(
      ["elevated", "underground", "at_grade", "mixed", "unknown"].map((t) => [t, stationFeatures.filter((f) => f.properties.stationType === t).length]),
    ),
  },
  stationsPerLine: Object.fromEntries(lineOrder.map((l) => [l, stationFeatures.filter((f) => f.properties.lines.includes(l)).length])),
  trackKmByType: Object.fromEntries(
    lineOrder.map((l) => {
      const segs = segmentFeatures.filter((f) => f.properties.lineId === l).map((f) => f.properties);
      const km = (pred: (s: SegmentProps) => boolean) => r3(segs.filter(pred).reduce((a, s) => a + s.lengthKm, 0));
      return [
        l,
        {
          ...Object.fromEntries(["elevated", "underground", "at_grade", "unknown"].map((t) => [t, km((s) => s.trackType === t)])),
          untagged: km((s) => s.trackTypeSource === "osm:untagged"),
          inferred: km((s) => s.trackTypeSource === "inferred:neighbours"),
        },
      ];
    }),
  ),
  issueCounts: Object.fromEntries([...new Set(issues.map((i) => i.code))].map((c) => [c, count(c)])),
  issues,
};
await writeFile("data/metadata/data_quality_report.json", JSON.stringify(report, null, 2));

console.log(JSON.stringify({ counts: report.counts, stationsPerLine: report.stationsPerLine, issueCounts: report.issueCounts }, null, 2));
if (issues.some((i) => i.severity === "error")) {
  console.error(`${issues.filter((i) => i.severity === "error").length} error(s); see data/metadata/data_quality_report.json`);
  process.exitCode = 1;
}
