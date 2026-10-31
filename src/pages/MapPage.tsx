import { useEffect, useState } from "react";
import { MetroMap } from "../components/map2d/MetroMap";
import { ControlPanel } from "../components/ui/ControlPanel";
import { ValidationPanel } from "../components/ui/ValidationPanel";
import { loadNetwork, type Network } from "../data/loadNetwork";

export function MapPage() {
  const [network, setNetwork] = useState<Network | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNetwork().then(setNetwork, (e: Error) => setError(e.message));
  }, []);

  if (error) return <Message>Could not load the metro data: {error}</Message>;
  if (!network) return <Message>Loading the Delhi Metro network…</Message>;
  return (
    <main className="relative h-dvh w-full">
      <MetroMap network={network} />
      <ControlPanel network={network} />
      <ValidationPanel network={network} />
    </main>
  );
}

const Message = ({ children }: { children: React.ReactNode }) => (
  <main className="grid h-dvh place-items-center bg-slate-50 p-4 text-sm text-slate-600" role="status">
    {children}
  </main>
);
