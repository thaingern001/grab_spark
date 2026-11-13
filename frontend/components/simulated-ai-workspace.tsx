"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUp, Check, Link2, ShieldCheck, Sparkles } from "lucide-react";
import { baht } from "@/lib/format";
import { dashboard, menus, scopeDefinitions, strategyNames } from "@/demo/fixtures/data";
import type { Client, DemoState, Scope } from "@/demo/state";
import type { StrategyCase } from "@/types/api";

const suggestedPrompt = "Which menu items are performing best, and what promotion could I prepare with a ฿500 budget?";

type Props = {
  client: Client;
  c1: DemoState["c1"];
  c2: DemoState["c2"];
  approved?: StrategyCase;
  onBack: () => void;
  onAsk: (message: string) => void;
  onReview: () => void;
  onRevoke: () => void;
  onReset: () => void;
};

export function SimulatedAiWorkspace({ client, c1, c2, approved, onBack, onAsk, onReview, onRevoke, onReset }: Props) {
  const [draft, setDraft] = useState(suggestedPrompt);
  const granted = (scope: Scope) => c2.status === "connected" && c2.grantedScopes.includes(scope);
  const providerClass = client === "ChatGPT" ? "chatgpt" : client === "Claude" ? "claude" : "other";
  const preparedPrompt = c2.lastPrompt === suggestedPrompt || !c2.lastPrompt;

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (message && c2.status === "connected") onAsk(message);
  }

  return <div className={`ai-workspace-stage ai-provider-${providerClass}`}>
    <div className="ai-workspace-frame">
      <div className="ai-demo-ribbon"><span><Sparkles size={14} aria-hidden="true" /> Simulated {client} workspace · No real provider connection</span><button type="button" onClick={onReset}>Reset demo</button></div>
      <header className="ai-workspace-header">
        <button type="button" className="ai-back" onClick={onBack} aria-label="AI Connections"><ArrowLeft size={20} /> <span>GrabMerchant</span></button>
        <div className="ai-workspace-brand"><span className="ai-workspace-logo" aria-hidden="true">{client === "Other" ? <Sparkles size={22} /> : <img src={`/provider-icons/${client === "Claude" ? "claude" : "openai"}.svg`} alt="" width={22} height={22} />}</span><strong>{client}</strong><small>Concept chat</small></div>
        <span className="ai-connected-indicator" title="Connected to synthetic merchant data only"><Check size={15} /> Demo</span>
      </header>
      <div className="ai-connection-strip"><Link2 size={16} aria-hidden="true" /><span><strong>GrabSpark demo connected</strong> · {c2.grantedScopes.length} read-only capabilities enabled</span></div>
      <main id="main-content" className="ai-chat-scroll">
        {!c2.asked && <div className="ai-chat-welcome"><span className="ai-welcome-mark"><Sparkles size={25} aria-hidden="true" /></span><h1>How can I help your store?</h1><p>Ask about the synthetic merchant data you chose to share.</p><button type="button" onClick={() => setDraft(suggestedPrompt)}>Try a store question</button></div>}
        <section className="ai-capabilities" aria-label="Enabled merchant capabilities"><h2>Available from GrabSpark</h2><div>{scopeDefinitions.map(scope => <span key={scope.id} className={granted(scope.id) ? "is-granted" : "is-locked"}><ShieldCheck size={13} aria-hidden="true" /> {scope.name}{granted(scope.id) ? "" : " · Locked"}</span>)}</div><button type="button" onClick={onBack}>Manage permissions</button></section>
        {c2.asked && <div className="ai-conversation" aria-live="polite"><div className="ai-user-bubble"><strong>You</strong><p>{c2.lastPrompt || suggestedPrompt}</p></div><div className="ai-assistant-message"><div className="ai-assistant-label"><span className="ai-workspace-logo" aria-hidden="true">{client === "Other" ? <Sparkles size={17} /> : <img src={`/provider-icons/${client === "Claude" ? "claude" : "openai"}.svg`} alt="" width={17} height={17} />}</span><strong>{client} · simulated reply</strong></div><p>{preparedPrompt ? "This is a prepared demo response using only the read-only capabilities you authorized." : "Your message was recorded in this browser. This prototype cannot generate a tailored AI reply, but you can inspect the authorized demo capabilities below."} Your message was not sent to {client === "Other" ? "an AI provider" : client}.</p>
          <div className="judge-tool-list" aria-label="Simulated capability access">{scopeDefinitions.map(scope => <div key={scope.id}><code>{scope.tool}</code><strong className={granted(scope.id) ? "judge-allowed" : "judge-blocked"}>{granted(scope.id) ? "Authorized" : "Permission required"}</strong></div>)}</div>
          {granted("sales") && <div className="judge-insight"><h3>Sales summary · synthetic</h3><p>{dashboard.today.orders} orders and {baht(dashboard.today.gmv)} GMV on the demo date. Estimated contribution: {baht(dashboard.today.estimated_contribution)}.</p></div>}
          {granted("menu") && <div className="judge-insight"><h3>Top menu performance · synthetic</h3>{dashboard.top_items.map(item => <p key={item.menu_item_id}>{item.name}: {item.units} units, {baht(item.gmv)} GMV.</p>)}</div>}
          {granted("missions") && <div className="judge-insight"><h3>Merchant mission · synthetic</h3><p>{c1.approved ? `${strategyNames[c1.approved]} simulated mission ${c1.reviewed ? "reviewed" : "approved"}.` : "One Click opportunity proposed; no strategy approved yet."}</p></div>}
          {granted("outcomes") && <div className="judge-insight"><h3>Mission outcome · simulated</h3><p>{approved && c1.resultReady ? `${strategyNames[approved.strategy_id]} models ${baht(approved.estimated_7d_contribution)} contribution; ${c1.reviewed ? "result reviewed" : "result not reviewed"}.` : "No simulated result has been generated in this browser session."}</p></div>}
          {preparedPrompt && (!granted("sales") || !granted("menu")) && <div className="judge-permission-warning"><ShieldCheck size={18} /><span>Sales Data and Menu Performance are required for this question. Restricted data is hidden. <button type="button" onClick={onBack}>Review permissions</button></span></div>}
          {preparedPrompt && granted("sales") && granted("menu") && <div className="judge-draft"><span className="judge-eyebrow">CAMPAIGN DRAFT · NOT PUBLISHED</span><h3>Prepare a meal-and-drink offer</h3><dl><div><dt>Objective</dt><dd>Explore growth from popular menu items</dd></div><div><dt>Selected menu</dt><dd>{menus.find(item => item.name === "Chicken Rice")?.name} + {menus.find(item => item.name === "Thai Iced Tea")?.name}</dd></div><div><dt>Proposed promotion</dt><dd>Concept bundle creative for merchant review</dd></div><div><dt>Maximum budget</dt><dd>฿500, as requested by the merchant</dd></div><div><dt>Expected outcome</dt><dd>No numeric forecast from this question; validate costs and demand before proceeding</dd></div><div><dt>Status</dt><dd>{c2.draftReviewed ? "Concept approval recorded — no real campaign launched." : "Requires separate merchant approval"}</dd></div></dl><button type="button" className="secondary-button" onClick={onReview} disabled={c2.draftReviewed}>{c2.draftReviewed ? "Concept reviewed" : "Review and confirm concept only"}</button></div>}
        </div></div>}
        <p className="ai-chat-disclaimer">Illustrative local demo. No real AI request, tool call, campaign creation, or publication occurs.</p>
        <button type="button" className="ai-revoke-link" onClick={onRevoke}>Revoke access</button>
      </main>
      <form className="ai-chat-composer" onSubmit={send}><label htmlFor="ai-demo-message">Message {client} (simulation)</label><div><textarea id="ai-demo-message" value={draft} onChange={event => setDraft(event.target.value.slice(0, 500))} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={2} placeholder="Ask about your store…" /><button type="submit" aria-label="Ask simulated AI" disabled={!draft.trim() || c2.status !== "connected"}><ArrowUp size={18} /></button></div><small>Demo response only · Shift+Enter for a new line</small></form>
    </div>
  </div>;
}
