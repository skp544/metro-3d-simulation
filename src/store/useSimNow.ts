import { useEffect, useState } from "react";
import { simSeconds, useMapStore } from "./useMapStore";

/** Simulated time (Unix seconds), refreshed every `intervalMs`: for UI panels, not per-frame 3D. */
export function useSimNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => simSeconds(useMapStore.getState()));
  // Restart the ticker when the clock is paused, resumed or re-based.
  const clock = useMapStore((s) => s.clock);
  useEffect(() => {
    const id = setInterval(() => setNow(simSeconds(useMapStore.getState())), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, clock]);
  return now;
}

const IST = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
export const formatIst = (s: number) => IST.format(new Date(s * 1000));
