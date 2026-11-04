// Height of a route's track along its length, from the segment track types.
// Explicit .ts: this module is also loaded directly by Node's test runner.
import { LEVEL_HEIGHT, RAMP_HALF_KM } from "../constants/scene.ts";
import type { InfraType } from "../data/types.ts";

export interface Run {
  type: InfraType;
  fromKm: number;
  toKm: number;
}

/**
 * Each run holds its level except near its ends, where the track ramps to the next level. A run
 * shorter than two ramp halves (e.g. a 300 m at-grade portal between viaduct and tunnel) collapses to
 * its midpoint, so the track passes through ground level there. Unknown runs get no level and are
 * interpolated from their neighbours.
 */
export function heightProfile(runs: Run[], rampHalfKm = RAMP_HALF_KM): (km: number) => number {
  const anchors: [number, number][] = [];
  runs.forEach((r, i) => {
    if (r.type === "unknown") return;
    const h = LEVEL_HEIGHT[r.type];
    const pad = Math.min(rampHalfKm, (r.toKm - r.fromKm) / 2);
    anchors.push([i === 0 ? r.fromKm : r.fromKm + pad, h], [i === runs.length - 1 ? r.toKm : r.toKm - pad, h]);
  });
  if (!anchors.length) return () => 0;
  return (km) => {
    if (km <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
      const [[k0, h0], [k1, h1]] = [anchors[i - 1], anchors[i]];
      if (km <= k1) return k1 === k0 ? h1 : h0 + ((h1 - h0) * (km - k0)) / (k1 - k0);
    }
    return anchors.at(-1)![1];
  };
}
