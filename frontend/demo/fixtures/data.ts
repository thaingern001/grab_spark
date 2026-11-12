import snapshot from "./snapshot.json";
import type { StrategyEvaluation, Dashboard, MenuItem, StrategyId } from "@/types/api";

// Exported from the existing deterministic Westrong Kitchen backend seed on 2026-11-07.
// This is an immutable concept-demo fixture, not a live merchant feed.
export const evaluation = snapshot.evaluation as StrategyEvaluation;
export const dashboard = snapshot.dashboard as Dashboard;
export const menus = snapshot.menus as MenuItem[];
export const strategyNames: Record<StrategyId, string> = { bundle: "Bundle", discount: "Discount", advertising: "Advertising" };

export const scopeDefinitions = [
  { id: "sales", name: "Sales Data", tool: "get_sales_summary", detail: "Read synthetic sales summary" },
  { id: "menu", name: "Menu Performance", tool: "get_menu_performance", detail: "Read synthetic top menu items" },
  { id: "missions", name: "Merchant Missions", tool: "get_merchant_missions", detail: "Read demo mission status" },
  { id: "outcomes", name: "Mission Outcomes", tool: "get_mission_outcome", detail: "Read reviewed simulated results" },
] as const;
