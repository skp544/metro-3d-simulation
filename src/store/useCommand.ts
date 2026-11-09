import { useEffect } from "react";

// Last key each command has been run for, by whichever view was showing.
const done = new Map<string, number>();

/**
 * Runs `run` once per new command key (focus, fit, camera, follow) once the view is `ready`. A key is run by
 * one view only: switching between 2D and 3D does not replay the last command over the view carried across,
 * while a command issued before the lazy 3D view finished loading still runs when it is ready.
 */
export function useCommand(name: string, key: number | undefined, ready: boolean, run: () => void) {
  useEffect(() => {
    if (!ready || key === undefined || done.get(name) === key) return;
    done.set(name, key);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per key
  }, [name, key, ready]);
}
