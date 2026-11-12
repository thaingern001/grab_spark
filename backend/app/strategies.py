"""Deterministic, merchant-scoped synthetic strategy evaluation v2."""
import json
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.auth import MerchantContext, require_owner
from app.errors import AppError, conflict, not_found
from app.finance import FinancialInputs, amount, calculate, money

MODEL_VERSION = "multi-strategy-v2"
ORDER = ("bundle", "discount", "advertising")
DISCOUNT_EXISTING_REDEMPTION_RATE = Decimal("0.2500")
DEFAULTS = {
    "baseline_units": 40, "bundle_units": 38, "discount_amount": Decimal("5.00"),
    "discount_demand_lift": Decimal("0.2500"), "advertising_spend": Decimal("100.00"),
    "advertising_incremental_orders": 12,
}
FIXED_RISK = {
    "bundle": (40, 40, 45),
    "discount": (55, 55, 20),
    "advertising": (70, 60, 25),
}
WEIGHTS = (Decimal("0.30"), Decimal("0.25"), Decimal("0.20"), Decimal("0.15"), Decimal("0.10"))
FIELDS = ("unit_price", "food_cost", "packaging_cost", "other_variable_cost", "deduction_rate", "merchant_discount")


def _mission(conn: Connection, mid: UUID, mission_id: UUID, lock: bool = False):
    query = "SELECT id,status,current_revision,approved_revision,trial_days FROM missions WHERE merchant_id=:mid AND id=:id"
    row = conn.execute(text(query + (" FOR UPDATE" if lock else "")), {"mid": mid, "id": mission_id}).mappings().first()
    if row is None:
        raise not_found()
    return row


def _inputs(conn: Connection, mid: UUID, mission_id: UUID):
    row = conn.execute(text("SELECT * FROM mission_strategy_inputs WHERE merchant_id=:mid AND mission_id=:id"), {"mid": mid, "id": mission_id}).mappings().first()
    return (dict(row), row["evaluation_revision"]) if row else (dict(DEFAULTS), 1)


def _arm(conn: Connection, mid: UUID, mission_id: UUID, revision: int, name: str):
    row = conn.execute(text("""SELECT * FROM mission_scenarios WHERE merchant_id=:mid AND mission_id=:id AND revision=:rev AND arm=:arm"""),
                       {"mid": mid, "id": mission_id, "rev": revision, "arm": name}).mappings().first()
    if row is None:
        raise AppError(500, "incomplete_scenario", "Financial scenario is incomplete")
    result = calculate(FinancialInputs(*(row[f] for f in FIELDS)))
    if result.estimated_contribution is None or result.merchant_revenue is None:
        raise AppError(400, "incomplete_financial_inputs", "Complete financial inputs before evaluation")
    return row, result


def _cap(value: Decimal) -> Decimal:
    return max(Decimal(0), min(Decimal(100), value))


def _risk(strategy_id: str, baseline_total: Decimal, total: Decimal, additional_spend: Decimal):
    denominator = max(abs(baseline_total), Decimal(1))
    downside = _cap(max(Decimal(0), baseline_total - total) / denominator * 100)
    demand, assumption, operations = FIXED_RISK[strategy_id]
    spend = _cap(additional_spend / denominator * 100)
    dimensions = {
        "financial_downside": int(downside.quantize(Decimal(1), rounding=ROUND_HALF_UP)),
        "demand_uncertainty": demand, "assumption_uncertainty": assumption,
        "operational_complexity": operations,
        "additional_spend": int(spend.quantize(Decimal(1), rounding=ROUND_HALF_UP)),
    }
    raw = sum((Decimal(value) * weight for value, weight in zip((downside, Decimal(demand), Decimal(assumption), Decimal(operations), spend), WEIGHTS)), Decimal(0))
    score = int(_cap(raw).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    return score, dimensions


def recommend(cases: list[dict]):
    eligible = [case for case in cases if case["eligible"]]
    if not eligible:
        raise AppError(400, "no_eligible_strategy", "No eligible strategy has complete inputs")
    return min(eligible, key=lambda item: (item["risk_score"], ORDER.index(item["strategy_id"])))


def _assumption_details(values: dict, discount_cannibalized: int):
    descriptions = {
        "baseline_units": ("Baseline orders", "orders / 7 days", "Illustrative seven-day Chicken Rice volume; not observed demand."),
        "bundle_units": ("Proposed bundle orders", "bundles / 7 days", "Each bundle first substitutes one baseline order; any excess adds an order."),
        "discount_amount": ("Merchant-funded discount", "THB / redeemed order", "Added to any baseline merchant discount exactly once."),
        "discount_demand_lift": ("Synthetic discount demand lift", "fraction of baseline orders", "Illustrative demand response, not a validated forecast; incremental discounted orders are rounded half up."),
        "advertising_spend": ("Advertising budget", "THB / 7 days", "Deducted once from seven-day contribution, outside merchant revenue."),
        "advertising_incremental_orders": ("Synthetic advertising conversions", "orders / 7 days", "Illustrative attributed orders, not a validated forecast; actual conversion and attribution are uncertain."),
    }
    details = {}
    for key, (name, unit, explanation) in descriptions.items():
        value = values[key]
        details[key] = {"name": name, "value": amount(value) if key in ("discount_amount", "advertising_spend") else format(value, ".4f") if key == "discount_demand_lift" else value,
                        "unit": unit, "source": "Deterministic fictional seed or merchant-edited scenario input", "explanation": explanation,
                        "merchant_confirmation_required": True, "editable": True}
    details["discount_existing_redemption_rate"] = {
        "name": "Existing orders redeeming discount", "value": format(DISCOUNT_EXISTING_REDEMPTION_RATE, ".4f"), "unit": "fraction of baseline orders",
        "source": "Fixed illustrative prototype assumption; not a Grab benchmark",
        "explanation": f"{discount_cannibalized} baseline orders switch from full price to discounted price under current volume; remaining baseline orders keep full price.",
        "merchant_confirmation_required": True, "editable": False,
    }
    return details


def evaluate(conn: Connection, mid: UUID, mission_id: UUID):
    mission = _mission(conn, mid, mission_id)
    if mission["status"] != "proposed":
        snapshot = approved_snapshot(conn, mid, mission_id)
        if snapshot is not None:
            return snapshot
    values, evaluation_revision = _inputs(conn, mid, mission_id)
    baseline_row, baseline = _arm(conn, mid, mission_id, mission["current_revision"], "baseline")
    proposed_row, proposed = _arm(conn, mid, mission_id, mission["current_revision"], "proposed")
    base_units = values["baseline_units"]
    baseline_total = money(baseline.estimated_contribution * base_units)
    discount_total = baseline_row["merchant_discount"] + values["discount_amount"]
    if discount_total > baseline_row["unit_price"]:
        raise AppError(400, "invalid_discount", "Merchant-funded discount exceeds selling price")
    discount_inputs = FinancialInputs(baseline_row["unit_price"], baseline_row["food_cost"], baseline_row["packaging_cost"], baseline_row["other_variable_cost"], baseline_row["deduction_rate"], discount_total)
    discounted = calculate(discount_inputs)
    discount_incremental = int((Decimal(base_units) * values["discount_demand_lift"]).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    discount_cannibalized = int((Decimal(base_units) * DISCOUNT_EXISTING_REDEMPTION_RATE).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    bundle_substituted = min(base_units, values["bundle_units"])
    cases = (
        ("bundle", "Bundle", "A proposed meal and drink set", values["bundle_units"], base_units - bundle_substituted, proposed, Decimal(0), proposed_row["unit_price"], bundle_substituted, max(0, values["bundle_units"] - bundle_substituted), ["Modeled bundle orders may replace existing orders", "Existing orders not converted to bundles remain in the total"]),
        ("discount", "Discount", "A merchant-funded offer", discount_cannibalized + discount_incremental, base_units - discount_cannibalized, discounted, money(values["discount_amount"] * (discount_cannibalized + discount_incremental)), baseline_row["unit_price"], discount_cannibalized, discount_incremental, ["An illustrative 25% of existing orders redeem the offer; this is not a Grab benchmark", "Extra orders may not offset discounts given to existing customers"]),
        ("advertising", "Advertising", "A sample in-app ad", values["advertising_incremental_orders"], base_units, baseline, values["advertising_spend"], baseline_row["unit_price"], 0, values["advertising_incremental_orders"], ["Additional orders attributed to ads are assumptions and may not occur", "Ad spend is deducted once from total contribution"]),
    )
    strategies = []
    for strategy_id, title, description, targeted_units, retained_units, per_unit, exposure, price, substituted_units, incremental_units, factors in cases:
        ad_spend = values["advertising_spend"] if strategy_id == "advertising" else Decimal(0)
        units = targeted_units + retained_units
        total = money(per_unit.estimated_contribution * targeted_units + baseline.estimated_contribution * retained_units - ad_spend)
        gmv = money(per_unit.gmv * targeted_units + baseline.gmv * retained_units)
        revenue = money(per_unit.merchant_revenue * targeted_units + baseline.merchant_revenue * retained_units)
        deductions = money(per_unit.deduction_amount * targeted_units + baseline.deduction_amount * retained_units)
        variable_cost = money(per_unit.variable_cost * targeted_units + baseline.variable_cost * retained_units)
        merchant_discounts = money((discount_total if strategy_id == "discount" else proposed_row["merchant_discount"] if strategy_id == "bundle" else baseline_row["merchant_discount"]) * targeted_units + baseline_row["merchant_discount"] * retained_units)
        score, dimensions = _risk(strategy_id, baseline_total, total, exposure)
        strategies.append({
            "strategy_id": strategy_id, "type": strategy_id, "title": title, "description": description,
            "eligible": True, "model_version": MODEL_VERSION, "estimated_units": units,
            "unit_price": amount(price), "unit_contribution": amount(per_unit.estimated_contribution),
            "merchant_discount_per_order": amount(discount_total if strategy_id == "discount" else proposed_row["merchant_discount"] if strategy_id == "bundle" else baseline_row["merchant_discount"]),
            "platform_deduction_per_order": amount(per_unit.deduction_amount),
            "food_cost_per_order": amount(proposed_row["food_cost"] if strategy_id == "bundle" else baseline_row["food_cost"]),
            "packaging_cost_per_order": amount(proposed_row["packaging_cost"] if strategy_id == "bundle" else baseline_row["packaging_cost"]),
            "other_cost_per_order": amount(proposed_row["other_variable_cost"] if strategy_id == "bundle" else baseline_row["other_variable_cost"]),
            "additional_spend": amount(ad_spend), "estimated_gmv": amount(gmv),
            "merchant_revenue": amount(revenue), "platform_deduction_total": amount(deductions),
            "merchant_discount_total": amount(merchant_discounts), "variable_cost_total": amount(variable_cost),
            "volume_breakdown": {"retained_baseline_orders": retained_units, "strategy_orders": targeted_units,
                                 "substituted_baseline_orders": substituted_units, "incremental_orders": incremental_units},
            "estimated_7d_contribution": amount(total), "estimated_difference": amount(money(total - baseline_total)),
            "risk_score": score, "risk_dimensions": dimensions, "risk_factors": factors,
        })
    recommended = recommend(strategies)
    return {
        "mission_id": str(mission_id), "scenario_revision": mission["current_revision"], "evaluation_revision": evaluation_revision,
        "model_version": MODEL_VERSION, "trial_days": mission["trial_days"],
        "baseline": {"estimated_units": base_units, "unit_contribution": amount(baseline.estimated_contribution),
                     "estimated_gmv": amount(money(baseline.gmv * base_units)),
                     "merchant_revenue": amount(money(baseline.merchant_revenue * base_units)),
                     "estimated_7d_contribution": amount(baseline_total)},
        "assumptions": {key: amount(value) if key in ("discount_amount", "advertising_spend") else format(value, ".4f") if key == "discount_demand_lift" else value for key, value in values.items() if key in DEFAULTS},
        "assumption_details": _assumption_details(values, discount_cannibalized),
        "risk_methodology": "Illustrative modeled risk score (0–100), lower is less modeled risk; fixed uncertainty inputs are not empirically validated probabilities.",
        "provenance": "Westrong Kitchen data and extra orders attributed to discounts or ads are synthetic demo assumptions, not forecasts validated by real campaigns. The merchant should confirm costs and spending.",
        "recommended_strategy_id": recommended["strategy_id"],
        "recommendation_reason": f"{recommended['title']} has the lowest illustrative modeled risk score ({recommended['risk_score']}/100). Ties are ordered Bundle, Discount, Advertising.",
        "strategies": strategies,
    }


def save_inputs(conn: Connection, context: MerchantContext, mission_id: UUID, expected_revision: int, values: dict):
    require_owner(context)
    mission = _mission(conn, context.merchant_id, mission_id, True)
    current, revision = _inputs(conn, context.merchant_id, mission_id)
    if mission["status"] != "proposed" or revision != expected_revision:
        raise conflict("Strategy assumptions changed; refresh the recommendation")
    params = {"mid": context.merchant_id, "id": mission_id, "rev": revision + 1, **values}
    conn.execute(text("""INSERT INTO mission_strategy_inputs
        (merchant_id,mission_id,evaluation_revision,baseline_units,bundle_units,discount_amount,discount_demand_lift,advertising_spend,advertising_incremental_orders)
        VALUES (:mid,:id,:rev,:baseline_units,:bundle_units,:discount_amount,:discount_demand_lift,:advertising_spend,:advertising_incremental_orders)
        ON CONFLICT (merchant_id,mission_id) DO UPDATE SET evaluation_revision=EXCLUDED.evaluation_revision,
        baseline_units=EXCLUDED.baseline_units,bundle_units=EXCLUDED.bundle_units,discount_amount=EXCLUDED.discount_amount,
        discount_demand_lift=EXCLUDED.discount_demand_lift,advertising_spend=EXCLUDED.advertising_spend,
        advertising_incremental_orders=EXCLUDED.advertising_incremental_orders,updated_at=now()"""), params)
    return evaluate(conn, context.merchant_id, mission_id)


def approved_snapshot(conn: Connection, mid: UUID, mission_id: UUID):
    row = conn.execute(text("SELECT snapshot FROM mission_strategy_approvals WHERE merchant_id=:mid AND mission_id=:id"), {"mid": mid, "id": mission_id}).mappings().first()
    return row["snapshot"] if row else None


def store_approval(conn: Connection, mid: UUID, mission_id: UUID, evaluation: dict, strategy_id: str):
    chosen = next((item for item in evaluation["strategies"] if item["strategy_id"] == strategy_id), None)
    if chosen is None or not chosen["eligible"]:
        raise AppError(400, "ineligible_strategy", "Select an eligible strategy from the current evaluation")
    snapshot = {**evaluation, "selected_strategy_id": strategy_id, "selected_strategy": chosen}
    conn.execute(text("""INSERT INTO mission_strategy_approvals
        (merchant_id,mission_id,strategy_id,scenario_revision,evaluation_revision,model_version,snapshot)
        VALUES (:mid,:id,:strategy,:scenario_rev,:eval_rev,:version,CAST(:snapshot AS jsonb))"""),
        {"mid": mid, "id": mission_id, "strategy": strategy_id, "scenario_rev": evaluation["scenario_revision"],
         "eval_rev": evaluation["evaluation_revision"], "version": MODEL_VERSION, "snapshot": json.dumps(snapshot)})
    return snapshot
