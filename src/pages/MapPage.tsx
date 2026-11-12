import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { MetroMap } from "../components/map2d/MetroMap";
import { BottomDock } from "../components/ui/BottomDock";
import { ControlPanel } from "../components/ui/ControlPanel";
import { FollowCard } from "../components/ui/FollowCard";
import { KpiCards } from "../components/ui/KpiCards";
import { RoutePanel } from "../components/ui/RoutePanel";
import { SceneControls } from "../components/ui/SceneControls";
import { StationPanel } from "../components/ui/StationPanel";
import { TopBar } from "../components/ui/TopBar";
import { loadNetwork, type Network } from "../data/loadNetwork";
import { useMapStore } from "../store/useMapStore";
import { buildService } from "../utils/trainSim";

// Three.js loads only when the 3D view is opened, so the 2D map stays light.
const MetroScene = lazy(() => import("../components/scene3d/MetroScene").then((m) => ({ default: m.MetroScene })));

export function MapPage() {
  const [network, setNetwork] = useState<Network | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = useMapStore((s) => s.view);
  // One simulated service shared by the 3D trains, the KPI cards, the train list and station ETAs.
  const service = useMemo(() => (network ? buildService(network.routes) : null), [network]);

  useEffect(() => {
    loadNetwork().then(setNetwork, (e: Error) => setError(e.message));
  }, []);

  if (error) return <Message>Could not load the metro data: {error}</Message>;
  if (!network || !service) return <Message>Loading the NCR rail network…</Message>;
  return (
    <div className="flex h-dvh flex-col">
      <TopBar network={network} />
      <main className="relative min-h-0 flex-1">
        {view === "2d" ? (
          <MetroMap network={network} />
        ) : (
          <Suspense fallback={<Message>Loading the 3D view…</Message>}>
            <MetroScene network={network} service={service} />
          </Suspense>
        )}
        {/* Floating cards over the map, as in ref_image.png. pointer-events pass through the gaps. */}
        <div className="pointer-events-none absolute top-3 left-3 z-[1000] flex max-h-[calc(100%-1.5rem)] flex-col gap-3">
          <KpiCards network={network} service={service} />
          <RoutePanel network={network} />
          <ControlPanel network={network} />
        </div>
        {/* In 2D, leave room for Leaflet's own controls in the top-right corner. */}
        <div className={`pointer-events-none absolute top-3 z-[1000] flex max-h-[calc(100%-12rem)] items-start gap-3 ${view === "2d" ? "right-16" : "right-3"}`}>
          <StationPanel network={network} service={service} />
          {view === "3d" && <SceneControls />}
        </div>
        {view === "3d" && (
          // Desktop: bottom right (the dock sits bottom left). Phones: stacked above the dock, below.
          <div className="pointer-events-none absolute right-3 bottom-9 z-[1000] hidden md:block">
            <FollowCard network={network} service={service} />
          </div>
        )}
        <div className="pointer-events-none absolute right-3 bottom-8 left-3 z-[1000] flex flex-col items-center gap-2 md:right-auto">
          {view === "3d" && (
            <div className="md:hidden">
              <FollowCard network={network} service={service} />
            </div>
          )}
          <BottomDock network={network} service={service} />
        </div>
      </main>
    </div>
  );
}

const Message = ({ children }: { children: React.ReactNode }) => (
  <div className="grid h-full min-h-dvh place-items-center bg-slate-50 p-4 text-sm text-slate-600" role="status">
    {children}
  </div>
);
