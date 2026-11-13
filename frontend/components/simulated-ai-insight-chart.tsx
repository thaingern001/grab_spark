import { baht, impactTone } from "@/lib/format";
import { dashboard, evaluation, strategyNames } from "@/demo/fixtures/data";
import type { StrategyCase } from "@/types/api";

export function SimulatedAiInsightChart({ approved }: { approved?: StrategyCase }) {
  if (approved) {
    const baseline = Number(evaluation.baseline.estimated_7d_contribution);
    const strategy = Number(approved.estimated_7d_contribution);
    const scale = Math.max(baseline, strategy, 1);
    return <figure className="ai-insight-chart" aria-label={`Simulated seven-day contribution: baseline ${baht(evaluation.baseline.estimated_7d_contribution)}, ${strategyNames[approved.strategy_id]} ${baht(approved.estimated_7d_contribution)}`}>
      <div className="ai-chart-heading"><strong>Modeled contribution</strong><span>7-day simulation</span></div>
      <div className="ai-chart-highlight"><strong className={`impact-${impactTone(approved.estimated_difference)}`}>{baht(approved.estimated_difference, true)}</strong><span>vs baseline</span></div>
      <div className="ai-comparison-bars"><div><span>Baseline</span><i><b style={{ width: `${Math.max(0, baseline) / scale * 100}%` }} /></i><strong>{baht(evaluation.baseline.estimated_7d_contribution)}</strong></div><div><span>{strategyNames[approved.strategy_id]}</span><i><b style={{ width: `${Math.max(0, strategy) / scale * 100}%` }} /></i><strong>{baht(approved.estimated_7d_contribution)}</strong></div></div>
      <figcaption>{baht(approved.estimated_difference, true)} modeled contribution difference vs baseline. Not ROI or observed sales.</figcaption>
    </figure>;
  }

  const monthly = dashboard.monthly_trend;
  const maximum = Math.max(...monthly.map(item => Number(item.gmv)), 1);
  return <figure className="ai-insight-chart" aria-label="Synthetic monthly gross merchandise value for the past six months">
    <div className="ai-chart-heading"><strong>Sales trend</strong><span>Synthetic history</span></div>
    <div className="ai-chart-highlight"><strong>{baht(monthly.at(-1)!.gmv)}</strong><span>latest monthly GMV</span></div>
    <ol className="ai-sales-bars">{monthly.map(item => <li key={item.from} aria-label={`${new Date(`${item.from}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })}: ${baht(item.gmv)} GMV`}><span className="ai-sales-bar-track"><b style={{ height: `${Math.max(0, Number(item.gmv)) / maximum * 100}%` }} /></span><span>{new Date(`${item.from}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</span></li>)}</ol>
    <figcaption>Monthly GMV from the synthetic merchant snapshot. Historical demo data, not a forecast or ROI.</figcaption>
  </figure>;
}
