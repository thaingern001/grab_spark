"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles, X } from "lucide-react";
import type { Mission, ScenarioArm, ScenarioComparison, ScenarioField, StrategyAssumptions, StrategyCase, StrategyEvaluation, StrategyId } from "@/types/api";
import { baht, impactTone } from "@/lib/format";
import { merchantRequest, MerchantApiError } from "@/lib/client-api";
import { StrategyVisual } from "@/components/strategy-visual";

type View = "overview" | "compare" | "detail" | "assumptions" | "costs";
type ArmKey = "baseline" | "proposed";
const fields: { key: ScenarioField; label: string; kind: "money" | "rate" }[] = [
  { key: "unit_price", label: "Selling price", kind: "money" }, { key: "food_cost", label: "Food cost", kind: "money" },
  { key: "packaging_cost", label: "Packaging", kind: "money" }, { key: "other_variable_cost", label: "Other variable cost", kind: "money" },
  { key: "deduction_rate", label: "Modeled platform deduction", kind: "rate" }, { key: "merchant_discount", label: "Merchant discount", kind: "money" },
];
function draftArm(arm: ScenarioArm) {
  return Object.fromEntries(fields.map(field => [field.key, field.key === "deduction_rate" ? String(Number(arm.deduction_rate) * 100) : arm[field.key] ?? ""])) as Record<ScenarioField, string>;
}
function scenarioDraft(value: ScenarioComparison) { return { baseline: draftArm(value.baseline), proposed: draftArm(value.proposed) }; }
const labels = { bundle: "Bundle", discount: "Discount", advertising: "Advertising" };
const riskLabels: Record<string, string> = { financial_downside: "Modeled contribution below baseline", demand_uncertainty: "Demand uncertainty", assumption_uncertainty: "Assumption uncertainty", operational_complexity: "Operational complexity", additional_spend: "Additional spending" };

export function HomeOpportunityPopup({ mission, initialComparison, initialEvaluation, forceOpen }: { mission: Mission; initialComparison: ScenarioComparison; initialEvaluation: StrategyEvaluation; forceOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [selected, setSelected] = useState<StrategyId>(initialEvaluation.recommended_strategy_id);
  const [detailStrategy, setDetailStrategy] = useState<StrategyId>(initialEvaluation.recommended_strategy_id);
  const [evaluation, setEvaluation] = useState(initialEvaluation);
  const [comparison, setComparison] = useState(initialComparison);
  const [assumptions, setAssumptions] = useState(initialEvaluation.assumptions);
  const [draft, setDraft] = useState(() => scenarioDraft(initialComparison));
  const [confirmed, setConfirmed] = useState(false);
  const [simulationConfirmed, setSimulationConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const approvalKey = useRef<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const path = `/missions/${mission.id}`;
  const recommended = evaluation.strategies.find(item => item.strategy_id === evaluation.recommended_strategy_id)!;
  const detail = evaluation.strategies.find(item => item.strategy_id === detailStrategy)!;

  useEffect(() => { setOpen(true); }, [mission.id]);
  useEffect(() => {
    if (!open) return;
    const main = document.querySelector(".app-main");
    main?.classList.add("has-opportunity-popup");
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled)")];
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { main?.classList.remove("has-opportunity-popup"); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);
  function dismiss() {
    setOpen(false);
    if (forceOpen) router.replace("/");
    requestAnimationFrame(() => { document.querySelector(".home-for-you")?.scrollIntoView({ behavior: "auto", block: "start" }); document.querySelector<HTMLElement>(".home-recommendation-hitarea")?.focus({ preventScroll: true }); });
  }
  function show(next: View, strategy?: StrategyId) { if (strategy) setDetailStrategy(strategy); setError(""); setView(next); bodyRef.current?.scrollTo({ top: 0 }); }
  async function refresh() {
    const [newEvaluation, newComparison] = await Promise.all([merchantRequest<StrategyEvaluation>(`${path}/strategies`), merchantRequest<ScenarioComparison>(`${path}/scenarios`)]);
    setEvaluation(newEvaluation); setComparison(newComparison); setAssumptions(newEvaluation.assumptions); setDraft(scenarioDraft(newComparison));
    setConfirmed(false); setSimulationConfirmed(false); approvalKey.current = null;
    if (!newEvaluation.strategies.some(item => item.strategy_id === selected && item.eligible)) setSelected(newEvaluation.recommended_strategy_id);
  }
  async function refreshAfterConflict(message: string) {
    try { await refresh(); setError(message); }
    catch { setError("Could not load the latest data. Please try again."); }
  }
  async function saveAssumptions() {
    setBusy(true); setError("");
    try {
      const updated = await merchantRequest<StrategyEvaluation>(`${path}/strategies/assumptions`, { method: "PUT", revision: evaluation.evaluation_revision, body: assumptions });
      setEvaluation(updated); setAssumptions(updated.assumptions); setConfirmed(false); setSimulationConfirmed(false); approvalKey.current = null; show("compare");
    } catch (cause) {
      if (cause instanceof MerchantApiError && cause.status === 409) await refreshAfterConflict("Assumptions changed in another window. Review the latest values before continuing.");
      else setError(cause instanceof Error ? cause.message : "Could not save assumptions.");
    } finally { setBusy(false); }
  }
  async function saveCosts() {
    const invalid = (Object.keys(draft) as ArmKey[]).some(arm => fields.some(field => !/^(?:\d+)(?:\.\d{1,2})?$/.test(draft[arm][field.key]) || (field.kind === "rate" && Number(draft[arm][field.key]) > 100)));
    if (invalid) { setError("Enter nonnegative values with at most two decimal places and a deduction rate no higher than 100%."); return; }
    setBusy(true); setError("");
    try {
      const convert = (arm: ArmKey) => Object.fromEntries(fields.map(field => [field.key, field.kind === "rate" ? (Number(draft[arm][field.key]) / 100).toFixed(4) : draft[arm][field.key]]));
      await merchantRequest<ScenarioComparison>(`${path}/scenarios`, { method: "PUT", revision: comparison.revision, body: { baseline: { label: comparison.baseline.label, ...convert("baseline") }, proposed: { label: comparison.proposed.label, ...convert("proposed") } } });
      await refresh(); show("compare");
    } catch (cause) {
      if (cause instanceof MerchantApiError && cause.status === 409) await refreshAfterConflict("Prices or costs changed in another window. Review the latest values before continuing.");
      else setError(cause instanceof Error ? cause.message : "Could not save costs.");
    } finally { setBusy(false); }
  }
  async function approve() {
    if (!confirmed || !simulationConfirmed || busy) return;
    setBusy(true); setError(""); approvalKey.current ??= crypto.randomUUID();
    try {
      await merchantRequest<Mission>(`${path}/approve`, { method: "POST", idempotencyKey: approvalKey.current, body: { reviewed_revision: evaluation.scenario_revision, evaluation_revision: evaluation.evaluation_revision, selected_strategy_id: selected, confirm_material_inputs: true, acknowledge_simulation: true } });
      try { await merchantRequest<Mission>(`${path}/simulate`, { method: "POST" }); }
      catch { /* The mission page retries a pending simulation and shows any backend error. */ }
      router.push(path); router.refresh();
    } catch (cause) {
      if (cause instanceof MerchantApiError && cause.status === 409) await refreshAfterConflict("Mission data changed. Review the latest evaluation and confirm again.");
      else setError(cause instanceof Error ? cause.message : "Could not approve the simulated trial.");
      setBusy(false);
    }
  }
  if (!open) return null;
  const phoneFrame = document.querySelector(".phone-frame");
  if (!phoneFrame) return null;
  return createPortal(<div className="opportunity-popup-layer" onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <div ref={dialogRef} className="opportunity-popup strategy-sheet" role="dialog" aria-modal="true" aria-labelledby="popup-title">
      <div className="strategy-sheet-handle" aria-hidden="true" />
      <button ref={closeRef} className="opportunity-popup-close" type="button" aria-label="Close One Click recommendation" onClick={dismiss}><X size={20} /></button>
      <div ref={bodyRef} className="strategy-sheet-body">
        {view === "overview" ? <>
          <div className="strategy-sheet-kicker"><Sparkles size={16} /> One Click · AI growth recommendation</div>
          <h2 id="popup-title">Recommended: {labels[recommended.strategy_id]}</h2>
          <p className="strategy-sheet-intro">Compare three prepared strategies for your store.</p>
          <p className="strategy-risk-explainer">Illustrative risk (0–100; lower is better, not a validated probability). Figures show estimated 7-day contribution vs. baseline, not net profit.</p>
          <div className="strategy-sheet-cards">{[recommended, ...evaluation.strategies.filter(item => item.strategy_id !== recommended.strategy_id)].map(item => <StrategyRow key={item.strategy_id} item={item} recommended={item.strategy_id === recommended.strategy_id} selected={item.strategy_id === selected} onSelect={() => { setSelected(item.strategy_id); approvalKey.current = null; }} onDetails={() => show("detail", item.strategy_id)} />)}</div>
          <p className="strategy-sheet-explain"><ShieldCheck size={15} /> {evaluation.recommendation_reason} A lower score indicates lower modeled risk, not a real-world probability.</p>
          <div className="strategy-sheet-assumption-summary"><strong>Baseline: {evaluation.baseline.estimated_units} orders · {baht(evaluation.baseline.estimated_7d_contribution)} contribution / 7 days</strong><span>{evaluation.assumptions.bundle_units} bundles · {baht(evaluation.assumptions.discount_amount)} discount per redeemed order with {(Number(evaluation.assumptions.discount_demand_lift) * 100).toFixed(0)}% assumed order lift · {baht(evaluation.assumptions.advertising_spend)} ad spend with {evaluation.assumptions.advertising_incremental_orders} assumed extra orders</span><span>Extra orders are synthetic assumptions, not validated forecasts.</span></div>
          <div className="strategy-sheet-body-actions"><button className="strategy-sheet-secondary" onClick={() => show("compare")}>View details and compare</button><button className="strategy-sheet-secondary" onClick={dismiss}>Review later in Home</button></div>
        </> : <>
          <button className="strategy-sheet-back" onClick={() => show("overview")}><ArrowLeft size={16} /> Back to recommendation</button>
          <h2 id="popup-title">{view === "compare" ? "Compare assumptions" : view === "detail" ? `${labels[detailStrategy]} details` : view === "assumptions" ? "Edit trial assumptions" : "Edit prices and costs"}</h2>
          {view === "compare" && <><p className="strategy-sheet-intro">All 7-day estimates use the same baseline. Actual sales are not guaranteed.</p><p className="strategy-risk-explainer">Estimated contribution difference vs. baseline · 7 days · Illustrative risk score (0–100), lower is better</p><div className="strategy-compare-list">{evaluation.strategies.map(item => <StrategyRow key={item.strategy_id} item={item} recommended={item.strategy_id === recommended.strategy_id} selected={item.strategy_id === selected} compact onSelect={() => { setSelected(item.strategy_id); approvalKey.current = null; }} onDetails={() => show("detail", item.strategy_id)} />)}</div><button className="secondary-button" onClick={() => show("assumptions")}>Edit volume and spending assumptions</button><button className="secondary-button" onClick={() => show("costs")}>Edit unit prices and costs</button></>}
          {view === "detail" && <StrategyDetail item={detail} evaluation={evaluation} comparison={comparison} onAssumptions={() => show("assumptions")} onCosts={() => show("costs")} />}
          {view === "assumptions" && <><p className="strategy-sheet-intro">These are synthetic assumptions. Saving asks the backend to recalculate estimates and scores.</p><div className="strategy-input-grid">{([
            ["baseline_units", "Baseline orders over 7 days", "number"], ["bundle_units", "Bundle units over 7 days", "number"],
            ["discount_amount", "Merchant-funded discount per order (฿)", "text"], ["discount_demand_lift", "Assumed discount order lift (e.g. 0.2500 = 25%)", "text"],
            ["advertising_spend", "Total 7-day ad spend (฿)", "text"], ["advertising_incremental_orders", "Assumed extra orders from ads", "number"],
          ] as const).map(([key, label, type]) => <label key={key}>{label}<input type={type} inputMode="decimal" value={assumptions[key]} onChange={event => setAssumptions(old => ({ ...old, [key]: type === "number" ? Number(event.target.value) : event.target.value }))} /></label>)}</div><button className="primary-button full-button" disabled={busy} onClick={saveAssumptions}>{busy ? "Recalculating…" : "Save and recalculate"}</button></>}
          {view === "costs" && <><p className="strategy-sheet-intro">Prices, costs, and deduction rates use the same Decimal engine. Saving creates a new backend revision.</p>{(["baseline", "proposed"] as const).map(arm => <fieldset className="cost-fieldset" key={arm}><legend>{arm === "baseline" ? "Current item" : "Proposed bundle"}</legend>{fields.map(field => <label className="cost-field" key={field.key}><span>{field.label}</span><span className="input-wrap"><input aria-label={`${arm === "baseline" ? "Current item" : "Proposed bundle"} ${field.label}`} inputMode="decimal" value={draft[arm][field.key]} onChange={event => setDraft(old => ({ ...old, [arm]: { ...old[arm], [field.key]: event.target.value } }))} /><em>{field.kind === "rate" ? "%" : "฿"}</em></span></label>)}</fieldset>)}<button className="primary-button full-button" disabled={busy} onClick={saveCosts}>{busy ? "Recalculating…" : "Save and recalculate"}</button></>}
        </>}
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
      <div className="strategy-sheet-footer">{view === "overview" ? <><p>{mission.trial_days}-day simulation · No real promotion or ad · Data revision {evaluation.scenario_revision}/{evaluation.evaluation_revision}</p><label className="consent-row"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the prices, costs, volumes, spending, and assumptions.</span></label><label className="consent-row"><input type="checkbox" checked={simulationConfirmed} onChange={event => setSimulationConfirmed(event.target.checked)} /><span>I understand this is a simulation and no real campaign will be published.</span></label><button className="primary-button" disabled={!confirmed || !simulationConfirmed || busy} onClick={approve}>{busy ? "Opening result…" : `Confirm ${labels[selected]} and view simulated result`} <ArrowRight size={16} /></button></> : <button className="primary-button" onClick={() => show("overview")}>Back to review and approval <ArrowRight size={16} /></button>}</div>
    </div>
  </div>, phoneFrame);
}

function StrategyRow({ item, recommended, selected, compact = false, onSelect, onDetails }: { item: StrategyCase; recommended: boolean; selected: boolean; compact?: boolean; onSelect: () => void; onDetails: () => void }) {
  return <div className={`strategy-sheet-card ${recommended ? "is-recommended" : ""} ${selected ? "is-selected" : ""}`}>
    {recommended && !compact && <StrategyVisual strategyId={item.strategy_id} variant="hero" />}
    <span className="strategy-sheet-card-main"><button type="button" className="strategy-card-select" aria-pressed={selected} onClick={onSelect} aria-label={`Select ${labels[item.strategy_id]} strategy, ${baht(item.estimated_difference, true)} estimated difference, risk ${item.risk_score} out of 100`}><span className={`strategy-card-radio ${selected ? "is-on" : ""}`} aria-hidden="true" />{(!recommended || compact) && <StrategyVisual strategyId={item.strategy_id} />}<span className="strategy-sheet-card-copy"><strong>{labels[item.strategy_id]} {recommended && <em>Recommended · Lowest risk</em>}{selected && <em className="is-selected-label">Selected</em>}</strong><small>{item.description}</small>{(!recommended || compact) && <small className="strategy-visual-inline-label">AI-generated concept preview</small>}</span><span className="strategy-sheet-card-metric"><strong className={`impact-${impactTone(item.estimated_difference)}`}>{baht(item.estimated_difference, true)}</strong><small>7-day difference</small><b>Risk {item.risk_score}/100</b><i className="strategy-risk-track"><i style={{ width: `${item.risk_score}%` }} /></i></span></button><button type="button" className="strategy-card-details" onClick={onDetails} aria-label={`View ${labels[item.strategy_id]} details`}><ArrowRight size={17} aria-hidden="true" /></button></span>
  </div>;
}

function StrategyDetail({ item, evaluation, comparison, onAssumptions, onCosts }: { item: StrategyCase; evaluation: StrategyEvaluation; comparison: ScenarioComparison; onAssumptions: () => void; onCosts: () => void }) {
  const rows: [string, string][] = [["Strategy unit price", item.unit_price], ["Merchant discount per strategy order", item.merchant_discount_per_order], ["Platform deduction per order", item.platform_deduction_per_order], ["Food cost per strategy order", item.food_cost_per_order], ["Packaging per strategy order", item.packaging_cost_per_order], ["Other cost per strategy order", item.other_cost_per_order], ["Contribution per strategy order", item.unit_contribution], ["Total ad spend", item.additional_spend], ["Modeled 7-day GMV", item.estimated_gmv]];
  if (item.platform_deduction_total !== null) rows.push(["Total platform deductions", item.platform_deduction_total]);
  if (item.merchant_discount_total !== null) rows.push(["Total merchant discounts", item.merchant_discount_total]);
  rows.push(["Modeled 7-day merchant revenue", item.merchant_revenue]);
  if (item.variable_cost_total !== null) rows.push(["Total variable costs", item.variable_cost_total]);
  rows.push(["Modeled 7-day contribution", item.estimated_7d_contribution], ["7-day difference vs. baseline", item.estimated_difference]);
  return <div className="strategy-sheet-detail">
    <p className="strategy-sheet-intro">{item.description} · {item.estimated_units} modeled orders total · Model {item.model_version}</p>
    <details className="assumptions-details strategy-visual-expander"><summary>Expand strategy concept preview</summary><StrategyVisual strategyId={item.strategy_id} variant="detail" /></details>
    <div className="strategy-detail-highlight"><span>Illustrative modeled risk <strong>{item.risk_score}/100</strong> · Lower is better</span><span>Baseline {baht(evaluation.baseline.estimated_7d_contribution)} → Strategy {baht(item.estimated_7d_contribution)}</span><span>Difference <strong className={`impact-${impactTone(item.estimated_difference)}`}>{baht(item.estimated_difference, true)}</strong></span></div>
    <p className="strategy-sheet-intro">{item.strategy_id === evaluation.recommended_strategy_id ? `Recommended because its illustrative risk score, ${item.risk_score}/100, is the lowest of the three under current assumptions. Actual returns are not guaranteed.` : `Not recommended because its illustrative risk score, ${item.risk_score}/100, is higher than the recommended strategy's (${evaluation.strategies.find(candidate => candidate.strategy_id === evaluation.recommended_strategy_id)?.risk_score}/100). Returns may differ with actual demand and costs.`}</p>
    {Number(item.estimated_difference) < 0 && <p className="strategy-sheet-intro">A negative difference means modeled contribution is below baseline; it does not mean the store has a net loss.</p>}
    {item.volume_breakdown && <p className="strategy-sheet-intro strategy-volume-note">{item.volume_breakdown.retained_baseline_orders} baseline orders remain + {item.volume_breakdown.strategy_orders} strategy-affected orders = {item.estimated_units} modeled orders. The strategy-affected orders comprise {item.volume_breakdown.substituted_baseline_orders} existing orders and {item.volume_breakdown.incremental_orders} assumed extra orders.</p>}
    <div className="strategy-breakdown">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong className={label === "7-day difference vs. baseline" ? `impact-${impactTone(item.estimated_difference)}` : undefined}>{baht(value, label === "7-day difference vs. baseline")}</strong></div>)}</div>
    <details className="assumptions-details"><summary>Risk factors and scoring</summary><div className="assumptions-body"><p>{evaluation.risk_methodology}</p>{Object.entries(item.risk_dimensions).map(([key, value]) => <p key={key}>{riskLabels[key] ?? key}: {value}/100</p>)}<p>Illustrative weights: financial downside 30%, demand 25%, assumptions 20%, operations 15%, extra spending 10%.</p><ul>{item.risk_factors.map(factor => <li key={factor}>{factor}</li>)}</ul></div></details>
    <details className="assumptions-details"><summary>Assumptions, sources, and limitations</summary><div className="assumptions-body"><p>{evaluation.provenance}</p>{Object.entries(evaluation.assumption_details).map(([key, detail]) => <p key={key}><strong>{detail.name}: {detail.value} {detail.unit}</strong><br />{detail.explanation} · Source: {detail.source} · {detail.editable ? "Editable" : "Fixed in this demo"} · {detail.merchant_confirmation_required ? "Confirm before approval" : "No confirmation required"}</p>)}{(["baseline", "proposed"] as const).map(arm => <p key={arm}><strong>{arm === "baseline" ? "Current item" : "Bundle"} · Price and cost sources</strong><br />{Object.entries(comparison[arm].sources).map(([name, source]) => `${name}: ${source.source_kind} (${source.source_note ?? "Not specified"})`).join(" · ")}</p>)}<p>The platform deduction is an assumption based on the pre-discount price, not a real Grab fee. Contribution excludes fixed costs and tax.</p></div></details>
    <div className="strategy-secondary"><button className="secondary-button" onClick={onAssumptions}>Edit assumptions</button><button className="secondary-button" onClick={onCosts}>Edit prices/costs</button></div>
  </div>;
}
