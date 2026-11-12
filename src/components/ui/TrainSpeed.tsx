import { TRAIN } from "../../constants/scene";
import { trainSpeedProfile } from "../../constants/trainSpeeds";
import type { TrainState } from "../../utils/trainSim";

/** Source-backed operating maximum, kept separate from current simulated speed and design capability. */
export function TrainSpeedLimit({ lineId, showDesign = false }: { lineId: string; showDesign?: boolean }) {
  const p = trainSpeedProfile(lineId, TRAIN.cruiseKmh);
  return <span className="text-[10px] text-slate-500">
    {p.source ? <a href={p.source.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
      title={`${p.source.label}; checked ${p.source.checkedOn}`} className="underline decoration-dotted underline-offset-2">
      Operating max {p.publishedMaxKmh} km/h
    </a> : <span>Model cap {p.simulationMaxKmh} km/h · nominal</span>}
    {showDesign && p.designKmh !== null && <span> · Design {p.designKmh} km/h</span>}
  </span>;
}

/** Speed in simulated seconds: increasing playback speed must not multiply the displayed km/h. */
export function TrainSpeed({ state, showLimit = false }: { state: TrainState; showLimit?: boolean }) {
  const p = trainSpeedProfile(state.train.lineId, TRAIN.cruiseKmh);
  const max = p.publishedMaxKmh === null ? `Nominal model cap ${p.simulationMaxKmh}` : `Published operating maximum ${p.publishedMaxKmh}`;
  return <span className={`inline-flex ${showLimit ? "flex-col" : "items-baseline gap-0.5"}`} title={`Simulated speed. ${max} km/h; playback multiplier changes time only.`}>
    <span className="whitespace-nowrap font-semibold text-slate-800 tabular-nums" aria-label={`Simulated speed ${Math.round(state.speedKmh)} kilometres per hour`}>
      {Math.round(state.speedKmh)} <span className="text-[10px] font-normal text-slate-500">km/h</span>
    </span>
    {showLimit && <TrainSpeedLimit lineId={state.train.lineId} />}
  </span>;
}
