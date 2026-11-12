/** Types mirror the Phase 2 FastAPI GET response shapes used in Checkpoint A. */
export type Money = string;
export type InputSource = {
  source_kind: "synthetic_history" | "merchant_confirmed" | "assumption";
  source_note: string | null;
  confirmed_at: string | null;
};
export type ScenarioField =
  | "unit_price"
  | "food_cost"
  | "packaging_cost"
  | "other_variable_cost"
  | "deduction_rate"
  | "merchant_discount";
export type ScenarioArm = {
  label: string;
  unit_price: Money;
  food_cost: Money | null;
  packaging_cost: Money | null;
  other_variable_cost: Money | null;
  deduction_rate: string | null;
  merchant_discount: Money | null;
  sources: Record<ScenarioField, InputSource>;
  deduction_amount: Money | null;
  merchant_revenue: Money | null;
  estimated_contribution: Money | null;
};
export type ScenarioComparison = {
  mission_id: string;
  revision: number;
  baseline: ScenarioArm;
  proposed: ScenarioArm;
  contribution_difference: Money | null;
  assumptions: string[];
};
export type MissionStatus =
  | "proposed"
  | "approved"
  | "running"
  | "completed"
  | "reviewed"
  | "rejected"
  | "cancelled";
export type Mission = {
  id: string;
  title: string;
  rationale: string;
  intended_outcome: string;
  status: MissionStatus;
  trial_days: number;
  current_revision: number;
  approved_revision: number | null;
  approved_strategy_id: "bundle" | "discount" | "advertising" | null;
  approved_model_version: string | null;
  synthetic: true;
  events: { from_status: string | null; to_status: string; source: string; occurred_at: string }[];
};
export type Merchant = {
  id: string;
  name: string;
  business_type: string;
  currency: "THB";
  timezone: "Asia/Bangkok";
  synthetic: true;
};
export type SalesSummary = {
  from: string;
  to: string;
  gmv: Money;
  merchant_revenue: Money;
  estimated_contribution: Money;
  orders: number;
  aov: Money | null;
  prior_gmv: Money;
  synthetic: true;
};
export type MenuPerformance = {
  menu_item_id: string;
  name: string;
  units: number;
  gmv: Money;
  estimated_contribution: Money;
};
export type Dashboard = {
  today: SalesSummary;
  monthly_trend: SalesSummary[];
  top_items: MenuPerformance[];
  opportunity: Mission | null;
  synthetic: true;
};
export type SalesSeries = { summary: SalesSummary; series: SalesSummary[] };
export type MenuItem = {
  id: string;
  name: string;
  category: string;
  current_price: Money;
  available: boolean;
  food_cost: Money | null;
  packaging_cost: Money | null;
  other_variable_cost: Money | null;
  deduction_rate: string | null;
  cost_source: "synthetic_history" | "merchant_confirmed" | "assumption" | "missing";
  estimated_contribution: Money | null;
};
export type OutcomeArm = {
  period_start: string;
  period_end: string;
  units: number;
  gmv: Money;
  merchant_revenue: Money;
  estimated_contribution: Money;
};
export type MissionOutcome = {
  mission_id: string;
  simulated: true;
  simulation_version: string;
  baseline: OutcomeArm;
  trial: OutcomeArm;
  learning_summary: string;
  next_step_guidance: string;
  selected_strategy_id: "bundle" | "discount" | "advertising" | null;
  modeled_risk_score: number | null;
  baseline_estimated_difference: Money | null;
  model_assumptions: StrategyAssumptions | null;
};
export type StrategyId = "bundle" | "discount" | "advertising";
export type StrategyAssumptions = {
  baseline_units: number;
  bundle_units: number;
  discount_amount: Money;
  discount_demand_lift: string;
  advertising_spend: Money;
  advertising_incremental_orders: number;
};
export type StrategyCase = {
  strategy_id: StrategyId;
  type: StrategyId;
  title: string;
  description: string;
  eligible: boolean;
  model_version: string;
  estimated_units: number;
  unit_price: Money;
  unit_contribution: Money;
  merchant_discount_per_order: Money;
  platform_deduction_per_order: Money;
  food_cost_per_order: Money;
  packaging_cost_per_order: Money;
  other_cost_per_order: Money;
  additional_spend: Money;
  estimated_gmv: Money;
  merchant_revenue: Money;
  estimated_7d_contribution: Money;
  estimated_difference: Money;
  platform_deduction_total: Money | null;
  merchant_discount_total: Money | null;
  variable_cost_total: Money | null;
  volume_breakdown: { retained_baseline_orders: number; strategy_orders: number; substituted_baseline_orders: number; incremental_orders: number } | null;
  risk_score: number;
  risk_dimensions: Record<string, number>;
  risk_factors: string[];
};
export type StrategyEvaluation = {
  mission_id: string;
  scenario_revision: number;
  evaluation_revision: number;
  model_version: string;
  trial_days: number;
  baseline: { estimated_units: number; unit_contribution: Money; estimated_gmv: Money; merchant_revenue: Money; estimated_7d_contribution: Money };
  assumptions: StrategyAssumptions;
  assumption_details: Record<string, { name: string; value: string | number; unit: string; source: string; explanation: string; merchant_confirmation_required: boolean; editable: boolean }>;
  risk_methodology: string;
  provenance: string;
  recommended_strategy_id: StrategyId;
  recommendation_reason: string;
  strategies: StrategyCase[];
};
export type ErrorEnvelope = { error: { code: string; message: string }; request_id: string };
