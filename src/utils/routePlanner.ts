// Station-to-station routing on the real network: the route highlight (Phase 8) and the start of the
// journey planner. Graph: one node per (station, route); an edge between consecutive stops of a route,
// usable both ways; a change of trains between two routes at the same station. Cost is an ESTIMATED
// travel time from the simulation's nominal constants (TRAIN) plus a nominal transfer time. Not a DMRC
// timetable and not DMRC's fare-route rules.
// Explicit .ts imports: this module is also loaded directly by Node's test runner.
import { TRAIN } from "../constants/scene.ts";
import type { RoutesFC, SegmentsFC, TransferProps, TransfersFC } from "../data/types.ts";

/** Nominal cost of changing trains: platform walk plus half a headway of waiting (DECISIONS #53). */
export const TRANSFER_S = 120 + TRAIN.headwayS / 2;

/** One ride on one route, in travel order. */
export interface Leg {
  routeId: string;
  lineId: string;
  stationIds: string[]; // boarding station … alighting station
  towardsId: string; // the route's terminus in the direction of travel
  /** Stretches along the route, as km from its first stop (the train simulation's and RoutePath3D's measure). */
  spans: [number, number][];
  segmentIds: string[];
  km: number;
}

export interface Journey {
  fromId: string;
  toId: string;
  legs: Leg[];
  walks: (TransferProps & { afterLeg: number })[]; // oriented in travel order; -1 means before the first ride
  km: number;
  stops: number; // stations travelled to, excluding the origin
  transfers: number;
  timeS: number; // estimated
}

interface Edge {
  to: number; // node index
  routeId?: string; // ride edges only
  fromKm?: number;
  toKm?: number;
  segmentIds?: string[];
  cost: number;
  walk?: TransferProps;
}

export function buildRoutePlanner(routes: RoutesFC, segments: SegmentsFC, cfg = TRAIN, transfers?: TransfersFC) {
  const speed = (cfg.cruiseKmh * 1000) / 3600; // m/s
  // Segments between two stops; a hop can have several (split where the track type changes).
  const segmentIds = new Map<string, string[]>();
  for (const { properties: s } of segments.features) {
    const key = `${s.routeId}|${s.fromStationId}|${s.toStationId}`;
    segmentIds.set(key, [...(segmentIds.get(key) ?? []), s.id]);
  }
  const routeById = new Map(routes.features.map((f) => [f.properties.id, f.properties]));

  // Nodes: (station, route). A loop route lists a station twice (Pink); both entries are one node.
  const nodes: { stationId: string; routeId: string }[] = [];
  const nodeIndex = new Map<string, number>();
  const nodesAt = new Map<string, number[]>(); // stationId → its nodes
  const node = (stationId: string, routeId: string) => {
    const key = `${stationId}|${routeId}`;
    let i = nodeIndex.get(key);
    if (i === undefined) {
      i = nodes.push({ stationId, routeId }) - 1;
      nodeIndex.set(key, i);
      nodesAt.set(stationId, [...(nodesAt.get(stationId) ?? []), i]);
    }
    return i;
  };
  const edges: Edge[][] = [];
  const addEdge = (a: number, e: Edge) => (edges[a] ??= []).push(e);

  for (const f of routes.features) {
    const r = f.properties;
    const km = r.stopKm.map((k) => k - r.stopKm[0]);
    for (let i = 0; i + 1 < r.stationIds.length; i++) {
      const [a, b] = [node(r.stationIds[i], r.id), node(r.stationIds[i + 1], r.id)];
      const segs = segmentIds.get(`${r.id}|${r.stationIds[i]}|${r.stationIds[i + 1]}`) ?? [];
      // Run time plus the dwell at the stop being left.
      const cost = (Math.abs(km[i + 1] - km[i]) * 1000) / speed + cfg.dwellS;
      addEdge(a, { to: b, routeId: r.id, fromKm: km[i], toKm: km[i + 1], segmentIds: segs, cost });
      addEdge(b, { to: a, routeId: r.id, fromKm: km[i + 1], toKm: km[i], segmentIds: segs, cost });
    }
  }
  for (const list of nodesAt.values())
    for (const a of list) for (const b of list) if (a !== b) addEdge(a, { to: b, cost: TRANSFER_S });
  for (const { properties: t } of transfers?.features ?? []) {
    for (const a of nodesAt.get(t.fromStationId) ?? []) for (const b of nodesAt.get(t.toStationId) ?? []) {
      const cost = t.walkSeconds + cfg.headwayS / 2;
      addEdge(a, { to: b, cost, walk: t });
      addEdge(b, { to: a, cost, walk: { ...t, fromStationId: t.toStationId, toStationId: t.fromStationId } });
    }
  }

  /** Fastest estimated journey between two stations, or null if either is unknown, they are the same, or unconnected. */
  function plan(fromId: string, toId: string): Journey | null {
    const starts = nodesAt.get(fromId);
    const goals = new Set(nodesAt.get(toId));
    if (!starts || !goals.size || fromId === toId) return null;
    // Dijkstra on a few hundred nodes: a linear scan for the minimum is fast enough.
    const dist = new Float64Array(nodes.length).fill(Infinity);
    const prev: ({ from: number; edge: Edge } | null)[] = new Array(nodes.length).fill(null);
    const done = new Uint8Array(nodes.length);
    for (const s of starts) dist[s] = 0;
    let goal = -1;
    for (;;) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) return null;
      if (goals.has(u)) {
        goal = u;
        break;
      }
      done[u] = 1;
      for (const e of edges[u] ?? []) {
        // Changing trains at the origin or into the destination is never useful.
        if (!e.routeId && !e.walk && (starts.includes(u) || goals.has(e.to))) continue;
        const cost = e.walk && goals.has(e.to) ? e.walk.walkSeconds : e.cost;
        if (dist[u] + cost < dist[e.to]) {
          dist[e.to] = dist[u] + cost;
          prev[e.to] = { from: u, edge: e };
        }
      }
    }

    const steps: { from: number; edge: Edge }[] = [];
    for (let n = goal; prev[n]; n = prev[n]!.from) steps.unshift(prev[n]!);
    const legs: Leg[] = [];
    const walks: Journey["walks"] = [];
    let change = true;
    for (const { from, edge } of steps) {
      if (!edge.routeId) {
        if (edge.walk) walks.push({ ...edge.walk, afterLeg: legs.length - 1 });
        change = true; // a change of trains: the next ride starts a new leg
        continue;
      }
      let leg = legs.at(-1);
      if (!leg || change) {
        const r = routeById.get(edge.routeId)!;
        const forward = edge.toKm! > edge.fromKm!;
        leg = { routeId: r.id, lineId: r.lineId, stationIds: [nodes[from].stationId], towardsId: forward ? r.stationIds.at(-1)! : r.stationIds[0], spans: [], segmentIds: [], km: 0 };
        legs.push(leg);
        change = false;
      }
      leg.stationIds.push(nodes[edge.to].stationId);
      const last = leg.spans.at(-1);
      if (last && last[1] === edge.fromKm) last[1] = edge.toKm!;
      else leg.spans.push([edge.fromKm!, edge.toKm!]);
      leg.segmentIds.push(...edge.segmentIds!);
      leg.km += Math.abs(edge.toKm! - edge.fromKm!);
    }
    return {
      fromId,
      toId,
      legs,
      walks,
      km: legs.reduce((a, l) => a + l.km, 0),
      stops: legs.reduce((a, l) => a + l.stationIds.length - 1, 0),
      transfers: Math.max(0, legs.length - 1),
      timeS: dist[goal],
    };
  }

  return { plan };
}

export type RoutePlanner = ReturnType<typeof buildRoutePlanner>;
