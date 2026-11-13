"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Send, Sparkles } from "lucide-react";

type AgentFacts = {
  strategy: string;
  contribution: string;
  difference: string;
  risk: number | null;
  nextStep: string;
};

export function ActualProgress({ days }: { days: number }) {
  return <section className="actual-progress" aria-labelledby="actual-progress-title">
    <span className="actual-progress-kicker">ACTUAL ACTIVITY · NOT STARTED</span>
    <h2 id="actual-progress-title">Day 1 pending</h2>
    <p><strong>0 of {days} live days completed.</strong> No real promotion or ad has been published, so there are no observed sales or contribution results for this trial.</p>
    <ol className="actual-day-track" aria-label={`${days}-day live activity, not started`}>{Array.from({ length: days }, (_, index) => <li key={index} className={index === 0 ? "is-pending" : ""} aria-label={`Day ${index + 1}${index === 0 ? " pending" : " not started"}`}>{index + 1}</li>)}</ol>
    <small>The green figures above are modeled outcomes for the full period. This gray track is the status of real activity.</small>
  </section>;
}

export function AgentEntry({ onOpen }: { onOpen: () => void }) {
  return <section className="mission-agent-entry" aria-labelledby="mission-agent-entry-title">
    <span className="mission-agent-mark"><Sparkles size={21} /></span>
    <h2 id="mission-agent-entry-title">Work with AI</h2>
    <button type="button" onClick={onOpen} aria-label="Open mission chat">Open <ArrowRight size={17} /></button>
  </section>;
}

export function MissionAgentChat({ facts, onBack }: { facts: AgentFacts; onBack: () => void }) {
  const [draft, setDraft] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<{ role: "merchant" | "agent"; text: string }[]>([
    { role: "agent", text: `I can help you review the approved ${facts.strategy} simulation. Its modeled 7-day contribution is ${facts.contribution}, a ${facts.difference} difference from baseline. No real trial has started.` },
  ]);
  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight }); }, [messages.length]);
  function reply(prompt: string) {
    const question = prompt.toLowerCase();
    if (/actual|live|day|started|real|progress|status/.test(question)) return "Actual activity is at Day 1 pending: 0 live days completed. No real promotion or ad has been published, and there are no observed trial results.";
    if (/risk|assumption|forecast/.test(question)) return `The illustrative modeled risk score is ${facts.risk === null ? "not available" : `${facts.risk}/100`}. It is not a validated probability. The financial result depends on synthetic demand and cost assumptions; review those details before any real action.`;
    if (/next|action|recommend|what should/.test(question)) return `${facts.nextStep} This demo cannot launch a real campaign.`;
    return `For the approved ${facts.strategy} strategy, the model estimates ${facts.contribution} contribution over 7 days (${facts.difference} versus baseline). This is a simulation, not observed sales. Ask about status, risk, or next steps for more detail.`;
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt) return;
    setMessages(old => [...old, { role: "merchant", text: prompt }, { role: "agent", text: reply(prompt) }]);
    setDraft("");
  }
  return <section className="mission-agent-chat" aria-labelledby="mission-agent-title">
    <button type="button" className="mission-agent-back" onClick={onBack}>← Simulated result</button>
    <span className="mission-agent-kicker"><Sparkles size={16} /> MAI · IN-APP DEMO AGENT</span>
    <h1 id="mission-agent-title">{facts.strategy} mission chat</h1>
    <p className="mission-agent-disclosure">Demo chat · No live AI or campaign data.</p>
    <div ref={messagesRef} className="mission-agent-messages" aria-live="polite">{messages.map((message, index) => <div key={index} className={`mission-agent-message is-${message.role}`}><strong>{message.role === "agent" ? "MAI" : "You"}</strong><p>{message.text}</p></div>)}</div>
    <form className="mission-agent-composer" onSubmit={send}><label htmlFor="mission-agent-prompt">Message MAI about this mission</label><div><input id="mission-agent-prompt" value={draft} onChange={event => setDraft(event.target.value.slice(0, 500))} placeholder="Ask about status, risk, or next steps" maxLength={500} /><button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={17} /></button></div></form>
  </section>;
}
