"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import type { Mission, MissionOutcome, ScenarioComparison } from "@/types/api";
import { merchantRequest } from "@/lib/client-api";
import { ActualProgress, AgentEntry, MissionAgentChat } from "@/components/mission-follow-up";
import { baht, impactTone } from "@/lib/format";

const strategyNames = { bundle: "Bundle", discount: "Discount", advertising: "Advertising" };
const assumptionNames: Record<string, string> = { baseline_units: "Baseline orders", bundle_units: "Bundle units", discount_amount: "Discount per order", discount_demand_lift: "Modeled order lift", advertising_spend: "Total ad spend", advertising_incremental_orders: "Modeled extra ad orders" };

export function MissionTracking({ initialMission, comparison, initialOutcome }: { initialMission: Mission; comparison: ScenarioComparison; initialOutcome: MissionOutcome | null }) {
  const [mission, setMission] = useState(initialMission);
  const [result, setResult] = useState(initialOutcome);
  const [busy, setBusy] = useState(initialMission.status === "approved" && Boolean(initialMission.approved_strategy_id));
  const [error, setError] = useState("");
  const [showAgent, setShowAgent] = useState(false);
  const autoRun = useRef(false);
  const path = `/missions/${mission.id}`;
  const barMaximum = result ? Math.max(Number(result.baseline.estimated_contribution), Number(result.trial.estimated_contribution), 1) : 1;
  const volumeDifference = result ? result.trial.units - result.baseline.units : 0;
  const modeledDifference = result?.baseline_estimated_difference ?? comparison.contribution_difference;
  const resultStrategyName = result?.selected_strategy_id ? strategyNames[result.selected_strategy_id] : "the approved strategy";

  useEffect(() => {
    if (initialMission.status === "approved" && initialMission.approved_strategy_id && !autoRun.current) {
      autoRun.current = true;
      void runSimulation();
    }
  }, []);
  async function runSimulation() {
    setBusy(true); setError("");
    try {
      const updated = await merchantRequest<Mission>(`${path}/simulate`, { method: "POST" });
      const outcome = await merchantRequest<MissionOutcome>(`${path}/outcome`);
      setMission(updated); setResult(outcome);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate the simulated result. Please try again."); }
    finally { setBusy(false); }
  }
  async function markReviewed() {
    setBusy(true); setError("");
    try { setMission(await merchantRequest<Mission>(`${path}/transitions`, { method: "POST", body: { action: "review", reason: "Merchant reviewed simulated outcome" } })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the result review."); }
    finally { setBusy(false); }
  }
  if (showAgent && result) return <div className="page-content tracking-page"><MissionAgentChat facts={{ strategy: result.selected_strategy_id ? strategyNames[result.selected_strategy_id] : "Approved", contribution: baht(result.trial.estimated_contribution), difference: baht(modeledDifference, true), risk: result.modeled_risk_score, nextStep: result.next_step_guidance }} onBack={() => setShowAgent(false)} /></div>;
  return <div className="page-content tracking-page oneclick-results">
    <Link href="/ai" className="back-link"><ArrowLeft size={16} /> One Click</Link>
    {result ? <>
      <span className="review-badge"><CheckCircle2 size={13} /> {mission.status === "reviewed" ? "Result reviewed" : "Simulated result ready"}</span>
      <h1>{mission.trial_days}-day simulated result</h1>
      <p className="subtle">{result.selected_strategy_id ? strategyNames[result.selected_strategy_id] : "Bundle"} strategy · Estimate, not actual sales</p>
      <section className="results-hero"><h2>Modeled 7-day contribution</h2><div className="results-totals"><div><span>Baseline</span><strong>{baht(result.baseline.estimated_contribution)}</strong><small>{result.baseline.units} modeled orders</small></div><span aria-hidden="true">→</span><div><span>Approved strategy</span><strong>{baht(result.trial.estimated_contribution)}</strong><small>{result.trial.units} modeled orders</small></div></div><div className="results-comparison-bars" aria-label="Modeled contribution comparison using the same scale"><div><span>Baseline</span><i><b style={{ width: `${Math.max(0, Number(result.baseline.estimated_contribution)) / barMaximum * 100}%` }} /></i></div><div><span>Strategy</span><i><b style={{ width: `${Math.max(0, Number(result.trial.estimated_contribution)) / barMaximum * 100}%` }} /></i></div></div><div className="results-difference"><span>Difference vs. baseline</span><strong>{baht(result.baseline_estimated_difference ?? comparison.contribution_difference, true)}</strong></div>{result.modeled_risk_score !== null && <p>Illustrative risk score {result.modeled_risk_score}/100 · Not a validated probability</p>}</section>
      <ActualProgress days={mission.trial_days} />
      <AgentEntry onOpen={() => setShowAgent(true)} />
      <section className="results-card"><h2>What the simulation suggests</h2><p className="results-takeaway">In this simulation, {resultStrategyName}&apos;s modeled 7-day contribution differs from baseline by <strong className="results-takeaway-amount">{baht(modeledDifference, true)}</strong>.</p><p>{result.learning_summary}</p><p>Modeled order count {volumeDifference > 0 ? "increased by" : volumeDifference < 0 ? "decreased by" : "changed by"} {Math.abs(volumeDifference)} versus baseline under the approved volume and cost assumptions.</p><p>Actual outcomes remain uncertain because customer demand, costs, and displaced sales have not been observed.</p><h3>Before any real action</h3><p>{result.next_step_guidance}</p></section>
      <details className="assumptions-details results-assumptions"><summary>Assumptions and result details</summary><div className="assumptions-body"><p>Approved model: {result.simulation_version} · Scenario revision {mission.approved_revision}</p>{result.model_assumptions && Object.entries(result.model_assumptions).map(([key, value]) => <p key={key}>{assumptionNames[key] ?? key}: {String(value)}</p>)}<p>Baseline GMV {baht(result.baseline.gmv)} · Strategy GMV {baht(result.trial.gmv)}</p><p>This result is generated immediately from assumptions. No real seven-day period has passed, and no promotion or ad was published.</p></div></details>
      <p className="fine-print">Contribution is not net profit. Actual results depend on demand, costs, and displaced sales.</p>
      {mission.status === "completed" && <button className="primary-button full-button" disabled={busy} onClick={markReviewed}>{busy ? "Saving…" : "Mark result as reviewed"} <ArrowRight size={17} /></button>}
      {mission.status === "reviewed" && <div className="reviewed-state"><CheckCircle2 size={18} /> Result review saved</div>}
      <Link className="secondary-button full-button" href="/">Back to Home</Link>
    </> : <>
      <div className="result-loading" role="status">{busy && <LoaderCircle size={25} />}<h1>{busy ? "Opening simulated result" : mission.status === "approved" ? "Simulated result unavailable" : mission.title}</h1><p>The approved model is calculated from assumptions. No real campaign or seven-day trial has started.</p></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {mission.status === "approved" && !busy && <button className="primary-button full-button" onClick={runSimulation}>Retry opening result <ArrowRight size={17} /></button>}
      {mission.status === "proposed" && <Link href="/?oneclick=1" className="primary-button full-button">View recommendation <ArrowRight size={17} /></Link>}
    </>}
  </div>;
}
