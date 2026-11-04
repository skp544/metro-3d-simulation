import { lazy, Suspense, useEffect, useState } from "react";
import { MetroMap } from "../components/map2d/MetroMap";
import { ControlPanel } from "../components/ui/ControlPanel";
import { ValidationPanel } from "../components/ui/ValidationPanel";
import { ViewToggle } from "../components/ui/ViewToggle";
import { loadNetwork, type Network } from "../data/loadNetwork";
import { useMapStore } from "../store/useMapStore";

// Three.js loads only when the 3D view is opened, so the 2D map stays light.
const MetroScene = lazy(() => import("../components/scene3d/MetroScene").then((m) => ({ default: m.MetroScene })));

export function MapPage() {
  const [network, setNetwork] = useState<Network | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = useMapStore((s) => s.view);

  useEffect(() => {
    loadNetwork().then(setNetwork, (e: Error) => setError(e.message));
  }, []);

  if (error) return <Message>Could not load the metro data: {error}</Message>;
  if (!network) return <Message>Loading the Delhi Metro network…</Message>;
  return (
    <main className="relative h-dvh w-full">
      {view === "2d" ? (
        <MetroMap network={network} />
      ) : (
        <Suspense fallback={<Message>Loading the 3D view…</Message>}>
          <MetroScene network={network} />
        </Suspense>
      )}
      <ControlPanel network={network} />
      {view === "2d" && <ValidationPanel network={network} />}
      <ViewToggle />
    </main>
  );
}

const Message = ({ children }: { children: React.ReactNode }) => (
  <main className="grid h-dvh place-items-center bg-slate-50 p-4 text-sm text-slate-600" role="status">
    {children}
  </main>
);
