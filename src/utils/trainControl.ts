// Per-train simulation holds. All times use the shared simulation clock, never wall time.
export interface TrainControl {
  delayS: number;
  heldAtS: number | null;
}
export type TrainControls = Readonly<Record<string, TrainControl>>;

export const trainTime = (timeS: number, control?: TrainControl) =>
  (control?.heldAtS ?? timeS) - (control?.delayS ?? 0);

export const isTrainHeld = (control?: TrainControl) => control?.heldAtS != null;

/** Idempotent bulk command: one timestamp for the whole selection. Resume retains all prior delay. */
export function controlTrains(controls: TrainControls, ids: readonly string[], held: boolean, timeS: number): TrainControls {
  const next = { ...controls };
  for (const id of ids) {
    const prev = controls[id] ?? { delayS: 0, heldAtS: null };
    if (held === isTrainHeld(prev)) continue;
    next[id] = held
      ? { ...prev, heldAtS: timeS }
      : { delayS: prev.delayS + Math.max(0, timeS - prev.heldAtS!), heldAtS: null };
  }
  return next;
}

/** Nominal eased motion, retaining the existing hop duration (not a measured DMRC driving profile).
 * Accelerate/brake for up to 8 seconds each; cruise in between. Integral is exactly one hop.
 */
export function runMotion(elapsedS: number, durationS: number) {
  if (durationS <= 0) return { fraction: 1, perSecond: 0 };
  const t = Math.max(0, Math.min(durationS, elapsedS));
  const ramp = Math.min(8, durationS / 4);
  const cruise = 1 / (durationS - ramp);
  if (t < ramp) return { fraction: cruise * t * t / (2 * ramp), perSecond: cruise * t / ramp };
  if (t > durationS - ramp) {
    const remaining = durationS - t;
    return { fraction: 1 - cruise * remaining * remaining / (2 * ramp), perSecond: cruise * remaining / ramp };
  }
  return { fraction: cruise * (t - ramp / 2), perSecond: cruise };
}
