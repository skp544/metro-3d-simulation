import { useEffect, useState } from "react";
import { simSeconds, useMapStore } from "./useMapStore";

/** Simulated time (Unix seconds), refreshed every `intervalMs`: for UI panels, not per-frame 3D. */
export function useSimNow(intervalMs = 1000) {
  const [, tick] = useState(0);
  // Restart the ticker when the clock is paused, resumed or re-based.
  const clock = useMapStore((s) => s.clock);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, clock]);
  // Sample on each render too: a Start/Stop action must not use a timestamp from the previous tick.
  return simSeconds(useMapStore.getState());
}

const IST = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
export const formatIst = (s: number) => IST.format(new Date(s * 1000));
