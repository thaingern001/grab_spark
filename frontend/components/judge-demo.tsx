"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChartNoAxesCombined, Check, CheckCircle2, ChevronRight, CircleEllipsis, CircleHelp, ClipboardList, House, Link2, ListChecks, RotateCcw, ShieldCheck, Sparkles, Store, UtensilsCrossed, X } from "lucide-react";
import { StrategyVisual } from "@/components/strategy-visual";
import { SimulatedAiWorkspace } from "@/components/simulated-ai-workspace";
import { ActualProgress, AgentEntry, MissionAgentChat } from "@/components/mission-follow-up";
import { TrendBars } from "@/components/trend-bars";
import { baht, impactTone, thaiDate } from "@/lib/format";
import type { StrategyCase, StrategyId } from "@/types/api";
import { dashboard, evaluation, scopeDefinitions, strategyNames } from "@/demo/fixtures/data";
import { clearDemoState, initialDemoState, loadDemoState, saveDemoState, type Client, type DemoState, type DemoView, type Scope } from "@/demo/state";

const ordered = [evaluation.strategies.find(item => item.strategy_id === evaluation.recommended_strategy_id)!, ...evaluation.strategies.filter(item => item.strategy_id !== evaluation.recommended_strategy_id)];
const recommendation = evaluation.strategies.find(item => item.strategy_id === evaluation.recommended_strategy_id)!;
const aiClients: Client[] = ["ChatGPT", "Claude", "Other"];

function ClientIcon({ client }: { client: Client }) {
  if (client === "Other") return <span className="judge-client-icon judge-client-icon-other" aria-hidden="true"><CircleEllipsis size={19} /></span>;
  return <span className={`judge-client-icon${client === "Claude" ? " judge-client-icon-claude" : ""}`} aria-hidden="true"><img src={`/provider-icons/${client === "Claude" ? "claude" : "openai"}.svg`} alt="" width={19} height={19} /></span>;
}

export function JudgeDemo() {
  const [state, setState] = useState<DemoState>(initialDemoState);
  const [loaded, setLoaded] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [homeTab, setHomeTab] = useState("Home");
  const recommendationRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setState(loadDemoState()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) saveDemoState(state); }, [loaded, state]);
  useEffect(() => {
    if (!shortcutsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setShortcutsOpen(false); };
    const closeOutside = (event: PointerEvent) => { if (!(event.target as Element).closest(".judge-quick-actions")) setShortcutsOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => { document.removeEventListener("keydown", closeOnEscape); document.removeEventListener("pointerdown", closeOutside); };
  }, [shortcutsOpen]);
  useEffect(() => { if (state.view === "c1-home") requestAnimationFrame(() => document.querySelector(".judge-main .home-for-you")?.scrollIntoView({ behavior: "auto", block: "start" })); }, [state.view]);
  useEffect(() => {
    if (state.view !== "recommendation") return;
    recommendationRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setState(old => ({ ...old, view: "c1-home" })); return; }
      if (event.key !== "Tab") return;
      const focusable = [...document.querySelectorAll<HTMLElement>(".judge-recommendation button:not(:disabled), .judge-approval-footer input:not(:disabled), .judge-approval-footer button:not(:disabled)")];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state.view]);
  const update = (change: (old: DemoState) => DemoState) => setState(change);
  const go = (view: DemoView) => { setShortcutsOpen(false); setHomeTab("Home"); update(old => ({ ...old, view })); };
  function openHomeSection(id: string, tab: string) {
    setShortcutsOpen(false);
    setHomeTab(tab);
    update(old => ({ ...old, view: "home" }));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" }));
  }
  const chosen = evaluation.strategies.find(item => item.strategy_id === state.c1.selected)!;
  const detail = evaluation.strategies.find(item => item.strategy_id === state.c1.detail)!;
  const approved = evaluation.strategies.find(item => item.strategy_id === state.c1.approved);
  const granted = (scope: Scope) => state.c2.status === "connected" && state.c2.grantedScopes.includes(scope);
  function reset() { setShortcutsOpen(false); setHomeTab("Home"); clearDemoState(); setState(initialDemoState); }
  function select(id: StrategyId) { update(old => ({ ...old, c1: { ...old.c1, selected: id } })); }
  function details(id: StrategyId) { update(old => ({ ...old, view: "details", c1: { ...old.c1, detail: id } })); }
  function toggleScope(scope: Scope) {
    update(old => {
      const removing = old.c2.scopes.includes(scope);
      const scopes = removing ? old.c2.scopes.filter(item => item !== scope) : [...old.c2.scopes, scope];
      const grantedScopes = removing ? old.c2.grantedScopes.filter(item => item !== scope) : old.c2.grantedScopes;
      return { ...old, c2: { ...old.c2, scopes, grantedScopes, status: old.c2.status === "connected" && grantedScopes.length === 0 ? "revoked" : old.c2.status, draftReviewed: removing ? false : old.c2.draftReviewed } };
    });
  }
  function authorize() {
    if (!state.c2.client || state.c2.scopes.length === 0) return;
    update(old => ({ ...old, c2: { ...old.c2, status: "connected", grantedScopes: [...old.c2.scopes], asked: false, lastPrompt: "", draftReviewed: false } }));
  }
  function revoke() {
    update(old => ({ ...old, c2: { ...old.c2, status: "revoked", scopes: [], grantedScopes: [], asked: false, lastPrompt: "", draftReviewed: false }, view: "connections" }));
  }
  if (state.view === "workspace" && state.c2.client) return <SimulatedAiWorkspace client={state.c2.client} c1={state.c1} c2={state.c2} approved={approved} onBack={() => go("connections")} onAsk={message => update(old => ({ ...old, c2: { ...old.c2, asked: true, lastPrompt: message, draftReviewed: false } }))} onReview={() => update(old => ({ ...old, c2: { ...old.c2, draftReviewed: true } }))} onRevoke={revoke} onReset={reset} />;
  return <div className="judge-stage">
    <div className="judge-topline"><span><Sparkles size={16} /> GrabSpark · 2C Interactive Demo</span><button type="button" onClick={reset}><RotateCcw size={15} /> Reset demo</button></div>
    <div className="judge-frame">
      <header className="judge-header"><button type="button" className="judge-brand" onClick={() => go("home")} aria-label="Return to Merchant Home"><span className="brand-mark"><Store size={18} /></span><span><strong>GrabMerchant</strong><small>Westrong Kitchen · Synthetic store</small></span></button><div className="judge-header-actions"><div className="judge-quick-actions"><button type="button" aria-label="Quick actions" aria-expanded={shortcutsOpen} aria-controls="judge-quick-menu" onClick={() => setShortcutsOpen(open => !open)}><CircleEllipsis size={20} /></button>{shortcutsOpen && <nav id="judge-quick-menu" className="judge-quick-menu" aria-label="Quick actions"><button type="button" onClick={() => go(state.c1.approved ? "results" : "recommendation")}><Sparkles size={18} /> One Click</button><button type="button" onClick={() => go("connections")}><Link2 size={18} /> Connector</button></nav>}</div><button type="button" onClick={reset} title="Reset demo" aria-label="Reset demo"><RotateCcw size={19} /></button><span title="Unofficial interactive concept" aria-label="Unofficial interactive concept"><CircleHelp size={20} /></span></div></header>
      <div className="judge-ribbon">Interactive Concept Demo · Synthetic Merchant Data · No Grab integration</div>
      <main id="main-content" className="judge-main" key={state.view}>
        {(state.view === "home" || state.view === "c1-home" || state.view === "recommendation") && <JudgeMerchantHome approvedStrategy={state.c1.approved} resultReady={state.c1.resultReady} reviewed={state.c1.reviewed} onOneClick={() => go(state.c1.approved ? "results" : "recommendation")} onConnector={() => go("connections")} />}
        {state.view === "recommendation" && <div ref={recommendationRef} className="judge-recommendation" role="dialog" aria-modal="true" aria-label="One Click recommendation" aria-owns="judge-consent-footer"><div className="judge-sheet-heading"><Back onClick={() => go("c1-home")} label="Merchant Home" /><span className="strategy-sheet-kicker"><Sparkles size={16} /> One Click · AI growth recommendation</span><h1>Recommended: {strategyNames[recommendation.strategy_id]}</h1><p>Compare three prepared strategies. The merchant can select any eligible option.</p><small>Illustrative risk (0–100), lower is better. Estimates are 7-day contribution differences, not validated forecasts.</small></div><div className="judge-cards">{ordered.map(item => <JudgeStrategyCard key={item.strategy_id} item={item} selected={state.c1.selected === item.strategy_id} recommended={item.strategy_id === evaluation.recommended_strategy_id} onSelect={() => select(item.strategy_id)} onDetails={() => details(item.strategy_id)} />)}</div><div className="judge-recommendation-note"><ShieldCheck size={17} /><span>AI recommends Bundle for its lowest illustrative modeled risk. <strong>You selected {strategyNames[chosen.strategy_id]}.</strong></span></div><div className="judge-inline-actions"><button type="button" onClick={() => go("comparison")}>Compare details</button><button type="button" onClick={() => go("c1-home")}>Review later</button></div></div>}

        {state.view === "comparison" && <div className="judge-page"><Back onClick={() => go("recommendation")} label="Recommendation" /><span className="judge-eyebrow">OPTIONAL COMPARISON</span><h1>Compare strategies</h1><p className="judge-lead">Same 40-order baseline and 7-day synthetic assumptions for each option.</p><div className="judge-compare-table" role="table" aria-label="Three-strategy financial comparison"><div className="judge-compare-head" role="row"><span>Strategy</span><span>Contribution</span><span>Risk</span></div>{ordered.map(item => <div className="judge-compare-row" role="row" key={item.strategy_id}><strong>{strategyNames[item.strategy_id]}{state.c1.selected === item.strategy_id ? " · Selected" : ""}</strong><span>{baht(item.estimated_7d_contribution)}<small className={`impact-${impactTone(item.estimated_difference)}`}>{baht(item.estimated_difference, true)} vs baseline</small></span><b>{item.risk_score}/100</b></div>)}</div><p className="judge-disclosure">Illustrative risk score, not a validated probability. Higher modeled contribution does not guarantee actual sales.</p><button type="button" className="primary-button" onClick={() => go("recommendation")}>Back to selection and approval <ArrowRight size={17} /></button></div>}

        {state.view === "details" && <JudgeStrategyDetail item={detail} onBack={() => go("recommendation")} />}

        {state.view === "results" && approved && state.c1.resultReady && <div className="judge-page oneclick-results"><Back onClick={() => go("c1-home")} label="Merchant Home" /><span className="review-badge"><CheckCircle2 size={14} /> {state.c1.reviewed ? "Result reviewed" : "Simulated result ready"}</span><h1>7-day simulated result</h1><p className="subtle">{strategyNames[approved.strategy_id]} · Estimate, not actual sales</p><AgentEntry onOpen={() => go("agent")} /><section className="results-hero"><h2>Modeled 7-day contribution</h2><div className="results-totals"><div><span>Baseline</span><strong>{baht(evaluation.baseline.estimated_7d_contribution)}</strong><small>{evaluation.baseline.estimated_units} modeled orders</small></div><span aria-hidden="true">→</span><div><span>Approved strategy</span><strong>{baht(approved.estimated_7d_contribution)}</strong><small>{approved.estimated_units} modeled orders</small></div></div><div className="results-difference"><span>Difference vs. baseline</span><strong className={`impact-${impactTone(approved.estimated_difference)}`}>{baht(approved.estimated_difference, true)}</strong></div><p>Illustrative risk score {approved.risk_score}/100 · Not a validated probability</p></section><ActualProgress days={7} /><section className="results-card"><h2>What the simulation suggests</h2><p className="results-takeaway">{strategyNames[approved.strategy_id]} models a {baht(approved.estimated_difference, true)} contribution difference over 7 days.</p><p>Modeled orders: {evaluation.baseline.estimated_units} baseline → {approved.estimated_units} with the selected strategy. Customer demand and displaced sales have not been observed.</p><p>Check real costs and demand before any live action. No campaign or promotion was created.</p></section><details className="assumptions-details results-assumptions"><summary>Model assumptions</summary><p>{evaluation.provenance}</p><p>Discount demand lift {Number(evaluation.assumptions.discount_demand_lift) * 100}% and {evaluation.assumptions.advertising_incremental_orders} advertising orders are synthetic assumptions, not validated forecasts.</p></details>{!state.c1.reviewed ? <button type="button" className="primary-button" onClick={() => update(old => ({ ...old, c1: { ...old.c1, reviewed: true } }))}>Mark result as reviewed <Check size={17} /></button> : <div className="reviewed-state"><CheckCircle2 size={18} /> Result review saved</div>}<button type="button" className="judge-text-button" onClick={() => go("home")}>Return to Merchant Home</button></div>}
        {state.view === "agent" && approved && <MissionAgentChat facts={{ strategyId: approved.strategy_id, strategy: strategyNames[approved.strategy_id], contribution: baht(approved.estimated_7d_contribution), difference: baht(approved.estimated_difference, true), risk: approved.risk_score, nextStep: "Check actual costs and demand before considering a live offer." }} onBack={() => go("results")} />}

        {state.view === "connections" && <div className="judge-page"><Back onClick={() => go("home")} label="Merchant Home" /><span className="judge-eyebrow">MERCHANT SETTINGS → AI CONNECTIONS</span><h1>AI Connections</h1><p className="judge-lead">Conceptually grant your preferred AI workspace access to selected read-only merchant capabilities.</p><div className="judge-status"><Link2 size={20} /><span><strong>{state.c2.status === "connected" ? "Connected — Simulated" : state.c2.status === "revoked" ? "Access Revoked" : state.c2.scopes.length ? "Permissions Selected" : "Not Connected"}</strong><small>No real AI provider linked</small></span></div><h2>Choose a simulated AI client</h2><div className="judge-client-options">{aiClients.map(client => <button type="button" key={client} className={state.c2.client === client ? "is-active" : ""} aria-pressed={state.c2.client === client} onClick={() => update(old => ({ ...old, c2: { ...old.c2, client, status: "not_connected", grantedScopes: [], asked: false, lastPrompt: "", draftReviewed: false } }))}><ClientIcon client={client} /><span className="judge-client-name">{client}</span><small>Concept option</small></button>)}</div><h2>Read-only permissions</h2><p className="judge-disclosure">Select each capability explicitly. Removing access applies immediately; new permissions need authorization.</p><div className="judge-scope-list">{scopeDefinitions.map(scope => <label key={scope.id}><input type="checkbox" checked={state.c2.scopes.includes(scope.id)} onChange={() => toggleScope(scope.id)} /><span><strong>{scope.name} — Read</strong><small>{scope.detail}</small></span></label>)}</div><button type="button" className="primary-button" disabled={!state.c2.client || state.c2.scopes.length === 0 || state.c2.status === "connected" && sameScopes(state.c2.scopes, state.c2.grantedScopes)} onClick={authorize}>{state.c2.status === "connected" ? "Update authorized permissions" : "Authorize simulated connection"} <ArrowRight size={17} /></button>{state.c2.status === "connected" && <><button type="button" className="secondary-button" onClick={() => go("workspace")}>Open simulated AI workspace <ArrowRight size={17} /></button><button type="button" className="judge-danger-button" onClick={revoke}>Revoke access now</button></>}<p className="judge-disclosure">This is a local browser demonstration. No OAuth, MCP, Grab API, or real ChatGPT/Claude session is used.</p></div>}

      </main>
      {state.view === "recommendation" && <div id="judge-consent-footer" className="judge-approval-footer"><small>7-day simulation · No real promotion or ad</small><label><input type="checkbox" checked={state.c1.consentInputs} onChange={event => update(old => ({ ...old, c1: { ...old.c1, consentInputs: event.target.checked } }))} /><span>I reviewed the prices, costs, volumes, spending, and assumptions.</span></label><label><input type="checkbox" checked={state.c1.consentSimulation} onChange={event => update(old => ({ ...old, c1: { ...old.c1, consentSimulation: event.target.checked } }))} /><span>I understand this is a simulation and no real campaign will be published.</span></label><button type="button" className="primary-button" disabled={!state.c1.consentInputs || !state.c1.consentSimulation || Boolean(state.c1.approved)} onClick={() => update(old => ({ ...old, view: "results", c1: { ...old.c1, approved: old.c1.selected, resultReady: true, reviewed: false } }))}>{state.c1.approved ? "Decision confirmed" : `Confirm ${strategyNames[chosen.strategy_id]} and view simulated result`} <ArrowRight size={16} /></button></div>}
      <nav className="judge-bottom-nav" aria-label="Merchant navigation"><button type="button" className={(state.view === "home" || state.view === "c1-home") && homeTab === "Home" ? "is-current" : ""} onClick={() => go("home")}><House size={19} /> Home</button><button type="button" className={homeTab === "Orders" && state.view === "home" ? "is-current" : ""} onClick={() => openHomeSection("judge-orders", "Orders")}><ClipboardList size={19} /> Orders</button><button type="button" className={homeTab === "Menu" && state.view === "home" ? "is-current" : ""} onClick={() => openHomeSection("judge-menu", "Menu")}><UtensilsCrossed size={19} /> Menu</button><button type="button" className={homeTab === "Insights" && state.view === "home" ? "is-current" : ""} onClick={() => openHomeSection("judge-insights", "Insights")}><ChartNoAxesCombined size={19} /> Insights</button><button type="button" className={["recommendation", "comparison", "details", "results", "agent"].includes(state.view) ? "is-current" : ""} onClick={() => go(state.c1.approved ? "results" : "recommendation")}><Sparkles size={19} /> One Click</button></nav>
    </div><p className="judge-footer">GrabSpark 2026 · Unofficial concept preview</p>
  </div>;
}

function JudgeMerchantHome({ approvedStrategy, resultReady, reviewed, onOneClick, onConnector }: { approvedStrategy: StrategyId | null; resultReady: boolean; reviewed: boolean; onOneClick: () => void; onConnector: () => void }) {
  const approved = approvedStrategy !== null;
  const opportunityTitle = approved ? resultReady ? "Review your simulated mission result" : "Continue your simulated mission" : "Try a chicken rice + drink bundle";
  const actionLabel = resultReady ? "View simulated result" : approved ? "Continue mission" : "View recommendation";
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return <div className="page-content home-page home-fidelity judge-merchant-home">
    <div className="home-store-context"><div className="home-store-pick"><span className="home-store-icon"><Store size={17} /></span><span><small>Your store</small><strong>Westrong Kitchen</strong></span></div><span className="home-date">{thaiDate(dashboard.today.from)}</span></div>
    <section id="judge-orders" className="merchant-highlights" aria-label="Today's synthetic overview"><div className="highlight-orders"><span className="highlight-pill">Synthetic data</span><strong>{dashboard.today.orders}</strong><span>Completed orders today</span></div><div className="highlight-sales"><span>Sales today</span><strong>{baht(dashboard.today.gmv)}</strong><small>GMV · {dashboard.today.orders} orders</small></div></section>
    <div className="home-aov">Average order value <strong>{baht(dashboard.today.aov)}</strong></div>
    <section className="home-for-you" aria-labelledby="judge-for-you-heading"><div className="home-feature-heading"><h2 id="judge-for-you-heading">For your store</h2><span>One Click</span></div><article className={`home-recommendation${approved ? "" : " is-opportunity"}`}><button type="button" className="home-recommendation-hitarea" aria-label={actionLabel} onClick={onOneClick} /><div className="home-recommendation-top"><span className="native-ai-icon"><Sparkles size={18} /></span><span><strong>{approved ? "One Click · Simulated mission" : "One Click · New opportunity"}</strong><small>{approved ? reviewed ? "Result reviewed" : resultReady ? "Result ready for review" : "Approved in this demo session" : "Compare 3 strategies · 1 recommendation"}</small></span></div><div className="home-recommendation-visual"><StrategyVisual strategyId={approvedStrategy ?? recommendation.strategy_id} variant="hero" /><small>Concept only · Not an actual menu photo or published campaign</small></div><h3>{opportunityTitle}</h3><p>{approved ? "Your selected strategy stays in this browser session. No real promotion was published." : `Lowest illustrative modeled risk: ${recommendation.risk_score}/100`}</p><div className="home-recommendation-impact"><span>{approved ? "Mission status" : "Estimated 7-day contribution difference"}</span><strong className={approved ? "status-copy" : undefined}>{approved ? reviewed ? "Result reviewed" : resultReady ? "Simulated result ready" : "Approved for simulation" : baht(recommendation.estimated_difference, true)}</strong></div><span className="home-recommendation-link">{actionLabel} <ArrowRight size={17} /></span><small className="home-recommendation-disclaimer">Simulation only · No real promotion is published</small></article></section>
    <section className="merchant-shortcuts" aria-labelledby="judge-shortcuts-heading"><h2 id="judge-shortcuts-heading">Manage your store</h2><nav className="merchant-shortcut-grid" aria-label="Store shortcuts"><button type="button" onClick={() => jumpTo("judge-orders")}><span><ClipboardList size={21} /></span>Orders</button><button type="button" onClick={() => jumpTo("judge-menu")}><span><UtensilsCrossed size={21} /></span>Menu</button><button type="button" onClick={() => jumpTo("judge-insights")}><span><ChartNoAxesCombined size={21} /></span>Insights</button></nav></section>
    <section id="judge-insights" className="home-compact-section" aria-labelledby="judge-trend-heading"><div className="compact-heading"><div><span>INSIGHTS · SYNTHETIC</span><h2 id="judge-trend-heading">Sales over the past 6 months</h2></div></div><TrendBars months={dashboard.monthly_trend} /></section>
    <section id="judge-menu" className="home-compact-section" aria-labelledby="judge-top-heading"><div className="compact-heading"><div><span>TOP MENU ITEMS</span><h2 id="judge-top-heading">Popular items</h2></div></div><ol className="compact-ranking">{dashboard.top_items.slice(0, 3).map((item, index) => <li key={item.menu_item_id}><span className="rank">{index + 1}</span><span><strong>{item.name}</strong><small>{item.units} sold</small></span><b>{baht(item.gmv)}</b></li>)}</ol></section>
    <section className="judge-home-connector" aria-labelledby="judge-connector-heading"><span className="judge-eyebrow">C2 · CONNECTOR</span><h2 id="judge-connector-heading">AI Connections</h2><p>Explore how a merchant controls read-only access for a simulated AI workspace.</p><button type="button" onClick={onConnector}>Explore Connector <ArrowRight size={17} /></button></section>
    <p className="footnote">Unofficial concept · All figures are synthetic · Estimated contribution is not net profit.</p>
  </div>;
}

function JudgeStrategyDetail({ item, onBack }: { item: StrategyCase; onBack: () => void }) {
  const financialRows: [string, string | null][] = [
    ["Strategy unit price", item.unit_price],
    ["Merchant discount per strategy order", item.merchant_discount_per_order],
    ["Modeled platform deduction per order", item.platform_deduction_per_order],
    ["Food cost per strategy order", item.food_cost_per_order],
    ["Packaging per strategy order", item.packaging_cost_per_order],
    ["Other variable cost per strategy order", item.other_cost_per_order],
    ["Contribution per strategy order", item.unit_contribution],
    ["Total additional spend", item.additional_spend],
    ["Modeled 7-day GMV", item.estimated_gmv],
    ["Total platform deductions", item.platform_deduction_total],
    ["Total merchant discounts", item.merchant_discount_total],
    ["Total variable costs", item.variable_cost_total],
    ["Modeled merchant revenue", item.merchant_revenue],
    ["Modeled 7-day contribution", item.estimated_7d_contribution],
    ["Difference vs baseline", item.estimated_difference],
  ];
  const riskLabels: Record<string, string> = { financial_downside: "Financial downside", demand_uncertainty: "Demand uncertainty", assumption_uncertainty: "Assumption uncertainty", operational_complexity: "Operational complexity", additional_spend: "Additional spending" };
  return <div className="judge-page judge-strategy-detail-page"><Back onClick={onBack} label="Recommendation" /><span className="judge-eyebrow">STRATEGY DETAILS · SYNTHETIC MODEL</span><h1>{strategyNames[item.strategy_id]}</h1><p className="judge-lead">{item.description} · {item.estimated_units} modeled orders in 7 days</p><StrategyVisual strategyId={item.strategy_id} variant="detail" />
    <section className="judge-detail-summary" aria-label="Financial and risk summary"><div><small>Baseline contribution</small><strong>{baht(evaluation.baseline.estimated_7d_contribution)}</strong></div><div><small>Strategy contribution</small><strong>{baht(item.estimated_7d_contribution)}</strong></div><div><small>Difference</small><strong className={`impact-${impactTone(item.estimated_difference)}`}>{baht(item.estimated_difference, true)}</strong></div><div><small>Illustrative risk · Lower is better</small><strong>{item.risk_score}/100</strong></div></section>
    {item.volume_breakdown && <p className="judge-disclosure">{item.volume_breakdown.retained_baseline_orders} retained baseline orders + {item.volume_breakdown.strategy_orders} strategy-affected orders = {item.estimated_units} modeled orders. Extra demand is a synthetic assumption.</p>}
    <section className="judge-detail-section" aria-labelledby="judge-financial-heading"><h2 id="judge-financial-heading">Financial breakdown</h2><dl>{financialRows.filter(([, value]) => value !== null).map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={label === "Difference vs baseline" ? `impact-${impactTone(item.estimated_difference)}` : undefined}>{baht(value, label === "Difference vs baseline")}</dd></div>)}</dl></section>
    <details className="assumptions-details"><summary>Risk factors and scoring</summary><p>{evaluation.risk_methodology}</p>{Object.entries(item.risk_dimensions).map(([key, value]) => <p key={key}>{riskLabels[key] ?? key}: {value}/100</p>)}<ul>{item.risk_factors.map(factor => <li key={factor}>{factor}</li>)}</ul></details>
    <details className="assumptions-details"><summary>Assumptions and limitations</summary><p>{evaluation.provenance}</p>{Object.entries(evaluation.assumption_details).map(([key, assumption]) => <p key={key}><strong>{assumption.name}: {assumption.value} {assumption.unit}</strong><br />{assumption.explanation} Source: {assumption.source}.</p>)}<p>Modeled platform deductions are assumptions, not actual Grab fees. Contribution excludes fixed costs and tax.</p></details>
    <button type="button" className="primary-button" onClick={onBack}>Return to selection <ArrowRight size={17} /></button>
  </div>;
}

function sameScopes(a: Scope[], b: Scope[]) { return a.length === b.length && a.every(scope => b.includes(scope)); }
function Back({ onClick, label }: { onClick: () => void; label: string }) { return <button type="button" className="judge-back" onClick={onClick}><ArrowLeft size={16} /> {label}</button>; }
function JudgeStrategyCard({ item, recommended, selected, onSelect, onDetails }: { item: StrategyCase; recommended: boolean; selected: boolean; onSelect: () => void; onDetails: () => void }) {
  return <div className={`judge-strategy-card ${recommended ? "is-recommended" : ""} ${selected ? "is-selected" : ""}`}>{recommended && <StrategyVisual strategyId={item.strategy_id} variant="hero" />}<div className="judge-strategy-content"><button type="button" className="judge-strategy-select" aria-label={`Select ${strategyNames[item.strategy_id]} strategy`} aria-pressed={selected} onClick={onSelect}><span className={`strategy-card-radio ${selected ? "is-on" : ""}`} aria-hidden="true" />{!recommended && <StrategyVisual strategyId={item.strategy_id} />}<span className="judge-strategy-copy"><strong>{strategyNames[item.strategy_id]}</strong><small>{recommended ? "AI recommended · Lowest modeled risk" : item.description}</small>{selected && <b>Selected for approval</b>}</span><span className="judge-strategy-figure"><strong className={`impact-${impactTone(item.estimated_difference)}`}>{baht(item.estimated_difference, true)}</strong><small>7-day difference</small><b>Risk {item.risk_score}/100</b></span></button><button type="button" className="judge-strategy-details" aria-label={`View ${strategyNames[item.strategy_id]} details`} onClick={onDetails}><ChevronRight size={20} /></button></div>{recommended && <small className="judge-image-caption">AI-generated concept preview · Not an actual merchant product</small>}</div>;
}


