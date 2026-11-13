import type { StrategyId } from "@/types/api";

export type Scope = "sales" | "menu" | "missions" | "outcomes";
export type Client = "ChatGPT" | "Claude" | "Other";
export type DemoView = "home" | "c1-home" | "recommendation" | "comparison" | "details" | "results" | "agent" | "connections" | "workspace";
export type DemoState = {
  view: DemoView;
  c1: { selected: StrategyId; detail: StrategyId; consentInputs: boolean; consentSimulation: boolean; approved: StrategyId | null; resultReady: boolean; reviewed: boolean };
  c2: { client: Client | null; scopes: Scope[]; grantedScopes: Scope[]; status: "not_connected" | "connected" | "revoked"; asked: boolean; lastPrompt: string; draftReviewed: boolean };
};

const key = "grabspark:judge-demo:v1";
export const initialDemoState: DemoState = {
  view: "recommendation",
  c1: { selected: "bundle", detail: "bundle", consentInputs: false, consentSimulation: false, approved: null, resultReady: false, reviewed: false },
  c2: { client: null, scopes: [], grantedScopes: [], status: "not_connected", asked: false, lastPrompt: "", draftReviewed: false },
};

const views: DemoView[] = ["home", "c1-home", "recommendation", "comparison", "details", "results", "agent", "connections", "workspace"];
const scopes: Scope[] = ["sales", "menu", "missions", "outcomes"];
const strategies: StrategyId[] = ["bundle", "discount", "advertising"];
const clients: Client[] = ["ChatGPT", "Claude", "Other"];

export function loadDemoState(): DemoState {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return initialDemoState;
    const value = JSON.parse(raw) as DemoState;
    if ((value.view as string) === "processing" && value.c1.approved) value.view = "results";
    if (value.c1.approved) value.c1.resultReady = true;
    if (!views.includes(value.view) || !strategies.includes(value.c1.selected) || !strategies.includes(value.c1.detail) || (value.c1.approved !== null && !strategies.includes(value.c1.approved)) || typeof value.c1.resultReady !== "boolean" || typeof value.c1.reviewed !== "boolean" || ((value.view === "results" || value.view === "agent") && !value.c1.approved) || (value.c1.reviewed && !value.c1.resultReady) || ((value.view === "results" || value.view === "agent") && !value.c1.resultReady) || (value.c2.client !== null && !clients.includes(value.c2.client)) || !["not_connected", "connected", "revoked"].includes(value.c2.status) || !Array.isArray(value.c2.scopes) || !value.c2.scopes.every(scope => scopes.includes(scope)) || !Array.isArray(value.c2.grantedScopes) || !value.c2.grantedScopes.every(scope => scopes.includes(scope))) return initialDemoState;
    if (value.c2.status === "connected" && (!value.c2.client || value.c2.grantedScopes.length === 0)) return initialDemoState;
    const reopenRecommendation = (value.view === "home" || value.view === "c1-home") && !value.c1.approved;
    return { ...value, view: reopenRecommendation ? "recommendation" : value.view, c2: { ...value.c2, lastPrompt: typeof value.c2.lastPrompt === "string" ? value.c2.lastPrompt.slice(0, 500) : "" } };
  } catch { return initialDemoState; }
}

export function saveDemoState(value: DemoState) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* The demo remains usable without storage. */ }
}

export function clearDemoState() {
  try { sessionStorage.removeItem(key); } catch { /* Browser storage may be disabled. */ }
}
