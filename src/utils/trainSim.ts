// Simulated metro service: where every train is at a given time. Deterministic (a pure function of
// time), so pausing or speeding up the clock never drifts. No operator timetable or live-position feed
// is used: nominal motion/dwells/headway are combined with the sourced express speed caps.
// Explicit .ts imports: this module is also loaded directly by Node's test runner.
import { TRAIN } from "../constants/scene.ts";
import type { RoutesFC } from "../data/types.ts";
import { trainSpeedProfile } from "../constants/trainSpeeds.ts";
import { buildRun, motionAt, type RunProfile } from "./trainMotion.ts";

/** One leg of a route's round trip: a dwell (fromKm === toKm) or a run between two stops. */
interface Leg {
  t0: number;
  t1: number;
  fromKm: number;
  toKm: number;
  dir: 1 | -1;
  stop: number; // dwell: index of the stop; run: index of the stop being approached
  motion: RunProfile | null;
}

export interface SimRoute {
  routeId: string;
  lineId: string;
  stationIds: string[];
  stopKm: number[]; // from the first stop
  cycleS: number; // full round trip including terminal dwells
  legs: Leg[];
  maxSpeedKmh: number; // simulation cap; published status is recorded in trainSpeeds.ts
}

export interface SimTrain {
  id: string; // e.g. "RD-07" (simulated identifier)
  routeId: string;
  lineId: string;
  offsetS: number;
}

export interface TrainState {
  train: SimTrain;
  km: number; // along the route from its first stop
  dir: 1 | -1; // 1 = towards the last stop
  atStationId: string | null; // dwelling here
  nextStationId: string; // next stop in the direction of travel (or current, while dwelling)
  terminusId: string; // where this trip ends
  progress: number; // 0..1 of the current one-way trip
  speedKmh: number; // instantaneous speed in simulated time; zero during station dwells
}

const LINE_CODE: Record<string, string> = {
  red: "RD", yellow: "YL", blue: "BL", green: "GN", violet: "VT", pink: "PK", magenta: "MG", grey: "GY", airport_express: "AX",
  aqua: "AQ", rrts: "NB", meerut_metro: "MM",
};

export function buildService(routes: RoutesFC, cfg = TRAIN) {
  const simRoutes: SimRoute[] = routes.features.map((f) => {
    const p = f.properties;
    const maxSpeedKmh = trainSpeedProfile(p.lineId, cfg.cruiseKmh).simulationMaxKmh;
    const stopKm = p.stopKm.map((k) => k - p.stopKm[0]);
    const legs: Leg[] = [];
    let t = 0;
    const trip = (order: number[], dir: 1 | -1) =>
      order.forEach((s, j) => {
        const dwell = j === 0 ? cfg.terminalDwellS : cfg.dwellS;
        legs.push({ t0: t, t1: (t += dwell), fromKm: stopKm[s], toKm: stopKm[s], dir, stop: s, motion: null });
        const next = order[j + 1];
        if (next !== undefined) {
          const motion = buildRun(Math.abs(stopKm[next] - stopKm[s]) * 1000, maxSpeedKmh, cfg.accelerationMps2, cfg.brakingMps2);
          legs.push({ t0: t, t1: (t += motion.durationS), fromKm: stopKm[s], toKm: stopKm[next], dir, stop: next, motion });
        }
      });
    const forward = stopKm.map((_, i) => i);
    trip(forward, 1);
    trip([...forward].reverse(), -1);
    return { routeId: p.id, lineId: p.lineId, stationIds: p.stationIds, stopKm, cycleS: t, legs, maxSpeedKmh };
  });

  // Trains evenly spaced around each round trip, one every `headwayS` per direction.
  const trains: SimTrain[] = [];
  const perLine = new Map<string, number>();
  for (const r of simRoutes) {
    const count = Math.max(1, Math.round(r.cycleS / cfg.headwayS));
    for (let k = 0; k < count; k++) {
      const n = (perLine.get(r.lineId) ?? 0) + 1;
      perLine.set(r.lineId, n);
      trains.push({ id: `${LINE_CODE[r.lineId] ?? r.lineId.slice(0, 2).toUpperCase()}-${String(n).padStart(2, "0")}`, routeId: r.routeId, lineId: r.lineId, offsetS: (k * r.cycleS) / count });
    }
  }
  const routeById = new Map(simRoutes.map((r) => [r.routeId, r]));

  function stateAt(train: SimTrain, timeS: number): TrainState {
    const r = routeById.get(train.routeId)!;
    const phase = (((timeS + train.offsetS) % r.cycleS) + r.cycleS) % r.cycleS;
    let lo = 0;
    let hi = r.legs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (r.legs[mid].t1 <= phase) lo = mid + 1;
      else hi = mid;
    }
    const leg = r.legs[lo];
    const motion = leg.motion ? motionAt(leg.motion, phase - leg.t0) : { distanceM: 0, speedKmh: 0 };
    const km = leg.fromKm + Math.sign(leg.toKm - leg.fromKm) * motion.distanceM / 1000;
    const last = r.stationIds.length - 1;
    const total = r.stopKm[last] || 1;
    return {
      train,
      km,
      dir: leg.dir,
      atStationId: leg.fromKm === leg.toKm ? r.stationIds[leg.stop] : null,
      nextStationId: r.stationIds[leg.stop],
      terminusId: r.stationIds[leg.dir === 1 ? last : 0],
      progress: leg.dir === 1 ? km / total : 1 - km / total,
      speedKmh: motion.speedKmh,
    };
  }

  /** Soonest arrival per (route, direction) at a station, in seconds from `timeS`. */
  function nextArrivals(stationId: string, timeS: number) {
    const out: { lineId: string; routeId: string; terminusId: string; inS: number; trainId: string }[] = [];
    for (const r of simRoutes) {
      const arrivals = r.legs.filter((l) => l.fromKm === l.toKm && r.stationIds[l.stop] === stationId);
      for (const dir of [1, -1] as const) {
        let best: (typeof out)[number] | null = null;
        for (const leg of arrivals.filter((l) => l.dir === dir))
          for (const t of trains.filter((x) => x.routeId === r.routeId)) {
            const phase = (((timeS + t.offsetS) % r.cycleS) + r.cycleS) % r.cycleS;
            const inS = (((leg.t0 - phase) % r.cycleS) + r.cycleS) % r.cycleS;
            if (!best || inS < best.inS)
              best = { lineId: r.lineId, routeId: r.routeId, terminusId: r.stationIds[dir === 1 ? r.stationIds.length - 1 : 0], inS, trainId: t.id };
          }
        if (best) out.push(best);
      }
    }
    return out.sort((a, b) => a.inS - b.inS);
  }

  return { routes: simRoutes, trains, stateAt, nextArrivals };
}

export type Service = ReturnType<typeof buildService>;
