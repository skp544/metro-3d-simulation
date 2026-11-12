// Deterministic rest-to-rest motion. Acceleration/braking are nominal; no line-specific speed restrictions.
export interface RunProfile {
  distanceM: number;
  peakMps: number;
  accelerationMps2: number;
  brakingMps2: number;
  accelerationS: number;
  cruiseS: number;
  brakingS: number;
  durationS: number;
}

/** Short hops have a triangular speed curve; longer ones reach the cap and cruise before braking. */
export function buildRun(distanceM: number, maxKmh: number, accelerationMps2: number, brakingMps2: number): RunProfile {
  if (!Number.isFinite(distanceM) || distanceM < 0 || ![maxKmh, accelerationMps2, brakingMps2].every(n => Number.isFinite(n) && n > 0)) throw new Error("Invalid train motion parameters");
  const peakMps = Math.min(maxKmh / 3.6, Math.sqrt((2 * distanceM) / (1 / accelerationMps2 + 1 / brakingMps2)));
  const accelerationS = peakMps / accelerationMps2;
  const brakingS = peakMps / brakingMps2;
  const cruiseM = Math.max(0, distanceM - 0.5 * peakMps * (accelerationS + brakingS));
  const cruiseS = peakMps > 0 ? cruiseM / peakMps : 0;
  return { distanceM, peakMps, accelerationMps2, brakingMps2, accelerationS, cruiseS, brakingS, durationS: accelerationS + cruiseS + brakingS };
}

/** Position and physical speed in simulated time; independent of the app's playback multiplier. */
export function motionAt(run: RunProfile, elapsedS: number) {
  const t = Math.max(0, Math.min(run.durationS, elapsedS));
  if (t === 0) return { distanceM: 0, speedKmh: 0 };
  if (t === run.durationS) return { distanceM: run.distanceM, speedKmh: 0 };
  if (t < run.accelerationS) return { distanceM: 0.5 * run.accelerationMps2 * t * t, speedKmh: run.accelerationMps2 * t * 3.6 };
  const accelerationM = 0.5 * run.peakMps * run.accelerationS;
  if (t < run.accelerationS + run.cruiseS) return { distanceM: accelerationM + run.peakMps * (t - run.accelerationS), speedKmh: run.peakMps * 3.6 };
  const remainingS = run.durationS - t;
  return { distanceM: run.distanceM - 0.5 * run.brakingMps2 * remainingS * remainingS, speedKmh: run.brakingMps2 * remainingS * 3.6 };
}
