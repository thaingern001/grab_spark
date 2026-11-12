from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, Field, ConfigDict


def _decimal_string(value):
    if not isinstance(value, str):
        raise ValueError("Financial inputs must be decimal strings")
    return value


MoneyInput = Annotated[Decimal, BeforeValidator(_decimal_string), Field(max_digits=12, decimal_places=2, ge=0)]
RateInput = Annotated[Decimal, BeforeValidator(_decimal_string), Field(max_digits=7, decimal_places=4, ge=0, le=1)]


class ScenarioValues(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str = Field(min_length=1, max_length=100)
    unit_price: MoneyInput
    food_cost: MoneyInput | None
    packaging_cost: MoneyInput | None
    other_variable_cost: MoneyInput | None
    deduction_rate: RateInput | None
    merchant_discount: MoneyInput | None


class ScenarioUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    baseline: ScenarioValues
    proposed: ScenarioValues


class ApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reviewed_revision: int = Field(ge=1)
    confirm_material_inputs: Literal[True]
    acknowledge_simulation: Literal[True]
    selected_strategy_id: Literal["bundle", "discount", "advertising"] | None = None
    evaluation_revision: int | None = Field(default=None, ge=1)


class StrategyInputsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    baseline_units: int = Field(ge=0, le=100000)
    bundle_units: int = Field(ge=0, le=100000)
    discount_amount: MoneyInput
    discount_demand_lift: Annotated[Decimal, BeforeValidator(_decimal_string), Field(max_digits=7, decimal_places=4, ge=0, le=2)]
    advertising_spend: MoneyInput
    advertising_incremental_orders: int = Field(ge=0, le=100000)


class StrategyCaseOut(BaseModel):
    strategy_id: Literal["bundle", "discount", "advertising"]
    type: str
    title: str
    description: str
    eligible: bool
    model_version: str
    estimated_units: int
    unit_price: str
    unit_contribution: str
    merchant_discount_per_order: str
    platform_deduction_per_order: str
    food_cost_per_order: str
    packaging_cost_per_order: str
    other_cost_per_order: str
    additional_spend: str
    estimated_gmv: str
    merchant_revenue: str
    estimated_7d_contribution: str
    estimated_difference: str
    platform_deduction_total: str | None = None
    merchant_discount_total: str | None = None
    variable_cost_total: str | None = None
    volume_breakdown: dict[str, int] | None = None
    risk_score: int = Field(ge=0, le=100)
    risk_dimensions: dict[str, int]
    risk_factors: list[str]


class StrategyEvaluationOut(BaseModel):
    mission_id: UUID
    scenario_revision: int
    evaluation_revision: int
    model_version: str
    trial_days: int
    baseline: dict
    assumptions: dict
    assumption_details: dict = Field(default_factory=dict)
    risk_methodology: str = "Illustrative prototype score (0–100), lower is less modeled risk; not a validated probability."
    provenance: str
    recommended_strategy_id: str
    recommendation_reason: str
    strategies: list[StrategyCaseOut]


class TransitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["review", "reject", "cancel"]
    reason: str | None = Field(default=None, max_length=500)


class MerchantOut(BaseModel):
    id: UUID
    name: str
    business_type: str
    currency: Literal["THB"]
    timezone: Literal["Asia/Bangkok"]
    synthetic: Literal[True]


class SalesOut(BaseModel):
    from_: date = Field(alias="from")
    to: date
    gmv: str
    merchant_revenue: str
    estimated_contribution: str
    orders: int
    aov: str | None
    prior_gmv: str
    synthetic: Literal[True]


class MenuPerformanceOut(BaseModel):
    menu_item_id: UUID
    name: str
    units: int
    gmv: str
    estimated_contribution: str


class MenuOut(BaseModel):
    id: UUID
    name: str
    category: str
    current_price: str
    available: bool
    food_cost: str | None
    packaging_cost: str | None
    other_variable_cost: str | None
    deduction_rate: str | None
    cost_source: Literal["synthetic_history", "merchant_confirmed", "assumption", "missing"]
    estimated_contribution: str | None


class EventOut(BaseModel):
    from_status: str | None
    to_status: str
    source: str
    occurred_at: str


class MissionOut(BaseModel):
    id: UUID
    title: str
    rationale: str
    intended_outcome: str
    status: str
    trial_days: int
    current_revision: int
    approved_revision: int | None
    approved_strategy_id: str | None = None
    approved_model_version: str | None = None
    synthetic: Literal[True]
    events: list[EventOut]


class SourceOut(BaseModel):
    source_kind: str
    source_note: str | None
    confirmed_at: str | None


class ScenarioArmOut(BaseModel):
    label: str
    unit_price: str
    food_cost: str | None
    packaging_cost: str | None
    other_variable_cost: str | None
    deduction_rate: str | None
    merchant_discount: str | None
    sources: dict[str, SourceOut]
    deduction_amount: str | None
    merchant_revenue: str | None
    estimated_contribution: str | None


class ScenarioOut(BaseModel):
    mission_id: UUID
    revision: int
    baseline: ScenarioArmOut
    proposed: ScenarioArmOut
    contribution_difference: str | None
    assumptions: list[str]


class OutcomeArmOut(BaseModel):
    period_start: date
    period_end: date
    units: int
    gmv: str
    merchant_revenue: str
    estimated_contribution: str


class OutcomeOut(BaseModel):
    mission_id: UUID
    simulated: Literal[True]
    simulation_version: str
    baseline: OutcomeArmOut
    trial: OutcomeArmOut
    learning_summary: str
    next_step_guidance: str
    selected_strategy_id: str | None = None
    modeled_risk_score: int | None = None
    baseline_estimated_difference: str | None = None
    model_assumptions: dict | None = None


class DashboardOut(BaseModel):
    today: SalesOut
    monthly_trend: list[SalesOut]
    top_items: list[MenuPerformanceOut]
    opportunity: MissionOut | None
    synthetic: Literal[True]


class SalesSeriesOut(BaseModel):
    summary: SalesOut
    series: list[SalesOut]
