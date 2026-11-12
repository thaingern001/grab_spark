"""Shared mission, scenario, approval, and simulated-outcome services."""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.auth import MerchantContext, require_owner
from app.core import settings
from app.errors import AppError, conflict, not_found
from app.finance import FinancialInputs, amount, calculate, rate

FIELDS = ("unit_price", "food_cost", "packaging_cost", "other_variable_cost", "deduction_rate", "merchant_discount")
ALLOWED = {"proposed": {"approved", "rejected"}, "approved": {"running", "cancelled"}, "running": {"completed", "cancelled"}, "completed": {"reviewed"}}
ASSUMPTIONS = ["30% platform deduction is a fictional pre-discount assumption, not a Grab fee.", "Contribution excludes fixed costs, tax, advertising, substitution, and volume uncertainty."]


def _mission(conn: Connection, mid: UUID, mission_id: UUID, lock: bool = False):
    sql = "SELECT * FROM missions WHERE merchant_id=:mid AND id=:id" + (" FOR UPDATE" if lock else "")
    row = conn.execute(text(sql), {"mid": mid, "id": mission_id}).mappings().first()
    if row is None:
        raise not_found()
    return row


def _serialize_mission(conn: Connection, row):
    events = conn.execute(text("SELECT from_status,to_status,source,occurred_at FROM mission_events WHERE merchant_id=:mid AND mission_id=:id ORDER BY occurred_at,id"), {"mid": row["merchant_id"], "id": row["id"]}).mappings().all()
    approved = conn.execute(text("SELECT strategy_id,model_version FROM mission_strategy_approvals WHERE merchant_id=:mid AND mission_id=:id"), {"mid": row["merchant_id"], "id": row["id"]}).mappings().first()
    return {"id": str(row["id"]), "title": row["title"], "rationale": row["rationale"], "intended_outcome": row["intended_outcome"], "status": row["status"], "trial_days": row["trial_days"], "current_revision": row["current_revision"], "approved_revision": row["approved_revision"], "approved_strategy_id": approved["strategy_id"] if approved else None, "approved_model_version": approved["model_version"] if approved else None, "synthetic": True, "events": [{"from_status": e["from_status"], "to_status": e["to_status"], "source": e["source"], "occurred_at": e["occurred_at"].isoformat()} for e in events]}


def get_mission(conn: Connection, mid: UUID, mission_id: UUID):
    return _serialize_mission(conn, _mission(conn, mid, mission_id))


def list_missions(conn: Connection, mid: UUID, status: str | None = None):
    sql = "SELECT * FROM missions WHERE merchant_id=:mid"
    params = {"mid": mid}
    if status is not None:
        sql += " AND status=:status"
        params["status"] = status
    rows = conn.execute(text(sql + " ORDER BY created_at,id"), params).mappings().all()
    return [_serialize_mission(conn, r) for r in rows]


def _scenario_rows(conn: Connection, mid: UUID, mission_id: UUID, revision: int):
    rows = conn.execute(text("SELECT * FROM mission_scenarios WHERE merchant_id=:mid AND mission_id=:id AND revision=:rev"), {"mid": mid, "id": mission_id, "rev": revision}).mappings().all()
    if {r["arm"] for r in rows} != {"baseline", "proposed"}:
        raise AppError(500, "incomplete_scenario", "Scenario revision is incomplete")
    return {r["arm"]: r for r in rows}


def _sources(conn: Connection, mid: UUID, scenario_id: UUID):
    rows = conn.execute(text("SELECT input_name,source_kind,source_note,confirmed_at FROM scenario_input_sources WHERE merchant_id=:mid AND scenario_id=:sid"), {"mid": mid, "sid": scenario_id}).mappings().all()
    return {r["input_name"]: {"source_kind": r["source_kind"], "source_note": r["source_note"], "confirmed_at": r["confirmed_at"].isoformat() if r["confirmed_at"] else None} for r in rows}


def _arm(conn: Connection, mid: UUID, row):
    calculation = calculate(FinancialInputs(*(row[f] for f in FIELDS)))
    return {"label": row["label"], "unit_price": amount(row["unit_price"]), "food_cost": amount(row["food_cost"]), "packaging_cost": amount(row["packaging_cost"]), "other_variable_cost": amount(row["other_variable_cost"]), "deduction_rate": rate(row["deduction_rate"]), "merchant_discount": amount(row["merchant_discount"]), "sources": _sources(conn, mid, row["id"]), "deduction_amount": amount(calculation.deduction_amount), "merchant_revenue": amount(calculation.merchant_revenue), "estimated_contribution": amount(calculation.estimated_contribution)}


def scenarios(conn: Connection, mid: UUID, mission_id: UUID):
    mission = _mission(conn, mid, mission_id)
    arms = _scenario_rows(conn, mid, mission_id, mission["current_revision"])
    baseline = _arm(conn, mid, arms["baseline"])
    proposed = _arm(conn, mid, arms["proposed"])
    diff = None
    if baseline["estimated_contribution"] is not None and proposed["estimated_contribution"] is not None:
        diff = amount(Decimal(proposed["estimated_contribution"]) - Decimal(baseline["estimated_contribution"]))
    return {"mission_id": str(mission_id), "revision": mission["current_revision"], "baseline": baseline, "proposed": proposed, "contribution_difference": diff, "assumptions": ASSUMPTIONS}


def save_scenarios(conn: Connection, context: MerchantContext, mission_id: UUID, expected_revision: int, values: dict):
    require_owner(context)
    mission = _mission(conn, context.merchant_id, mission_id, True)
    if mission["status"] != "proposed" or mission["current_revision"] != expected_revision:
        raise conflict("Mission or scenario revision changed; refresh the review")
    previous = _scenario_rows(conn, context.merchant_id, mission_id, expected_revision)
    new_revision = expected_revision + 1
    for arm_name in ("baseline", "proposed"):
        input_values = values[arm_name]
        try:
            calculate(FinancialInputs(*(input_values[f] for f in FIELDS)))
        except ValueError as exc:
            raise AppError(400, "invalid_financial_input", str(exc)) from exc
        sid = uuid4()
        conn.execute(text("""INSERT INTO mission_scenarios
            (id,merchant_id,mission_id,revision,arm,label,unit_price,food_cost,packaging_cost,other_variable_cost,deduction_rate,merchant_discount)
            VALUES (:id,:mid,:mission,:revision,:arm,:label,:unit_price,:food_cost,:packaging_cost,:other_variable_cost,:deduction_rate,:merchant_discount)"""),
            {"id": sid, "mid": context.merchant_id, "mission": mission_id, "revision": new_revision, "arm": arm_name, **input_values})
        old = previous[arm_name]
        old_sources = _sources(conn, context.merchant_id, old["id"])
        for field in FIELDS:
            reused = old["label"] == input_values["label"] and old[field] == input_values[field]
            source = old_sources[field] if reused else {"source_kind": "assumption", "source_note": "Edited in one-click review", "confirmed_at": None}
            conn.execute(text("""INSERT INTO scenario_input_sources
                (merchant_id,scenario_id,input_name,source_kind,source_note,confirmed_at)
                VALUES (:mid,:sid,:name,:kind,:note,:confirmed)"""),
                {"mid": context.merchant_id, "sid": sid, "name": field, "kind": source["source_kind"], "note": source["source_note"], "confirmed": datetime.fromisoformat(source["confirmed_at"]) if source["confirmed_at"] else None})
    conn.execute(text("UPDATE missions SET current_revision=:rev,updated_at=now() WHERE merchant_id=:mid AND id=:id"), {"rev": new_revision, "mid": context.merchant_id, "id": mission_id})
    return scenarios(conn, context.merchant_id, mission_id)


def _event(conn: Connection, context: MerchantContext, mission_id: UUID, old: str | None, new: str, source: str, reason: str | None = None):
    conn.execute(text("""INSERT INTO mission_events (merchant_id,mission_id,actor_user_id,from_status,to_status,source,reason)
        VALUES (:mid,:id,:user,:old,:new,:source,:reason)"""), {"mid": context.merchant_id, "id": mission_id, "user": context.user_id, "old": old, "new": new, "source": source, "reason": reason})


def _transition(conn: Connection, context: MerchantContext, mission, target: str, source: str, reason: str | None = None):
    if target not in ALLOWED.get(mission["status"], set()):
        raise conflict(f"Cannot transition {mission['status']} to {target}")
    conn.execute(text("UPDATE missions SET status=:status,updated_at=now() WHERE merchant_id=:mid AND id=:id"), {"status": target, "mid": context.merchant_id, "id": mission["id"]})
    _event(conn, context, mission["id"], mission["status"], target, source, reason)


def approve(conn: Connection, context: MerchantContext, mission_id: UUID, reviewed_revision: int, key: str, confirm_inputs: bool, acknowledge_simulation: bool, selected_strategy_id: str | None = None, evaluation_revision: int | None = None):
    require_owner(context)
    mission = _mission(conn, context.merchant_id, mission_id, True)
    fingerprint = hashlib.sha256(json.dumps({"mission": str(mission_id), "revision": reviewed_revision, "confirm": confirm_inputs, "simulation": acknowledge_simulation, "strategy": selected_strategy_id, "evaluation_revision": evaluation_revision}, sort_keys=True).encode()).hexdigest()
    if mission["approval_idempotency_key"] == key and mission["approval_request_fingerprint"] == fingerprint:
        result = _serialize_mission(conn, mission)
        result["status"] = "approved"
        approved_index = next((i for i, event in enumerate(result["events"]) if event["to_status"] == "approved"), None)
        if approved_index is not None:
            result["events"] = result["events"][:approved_index + 1]
        return result
    if mission["status"] != "proposed" or mission["current_revision"] != reviewed_revision:
        raise conflict("Mission or reviewed revision changed")
    if not confirm_inputs or not acknowledge_simulation:
        raise AppError(400, "consent_required", "Financial confirmation and simulation acknowledgment are required")
    from app import strategies
    evaluation = strategies.evaluate(conn, context.merchant_id, mission_id)
    if evaluation_revision is not None and evaluation_revision != evaluation["evaluation_revision"]:
        raise conflict("Strategy evaluation changed; refresh the recommendation")
    chosen_id = selected_strategy_id or evaluation["recommended_strategy_id"]
    arms = _scenario_rows(conn, context.merchant_id, mission_id, reviewed_revision)
    for arm in arms.values():
        result = calculate(FinancialInputs(*(arm[f] for f in FIELDS)))
        if result.estimated_contribution is None:
            raise AppError(400, "incomplete_financial_inputs", "Complete every financial input before approval")
        sources = _sources(conn, context.merchant_id, arm["id"])
        if set(sources) != set(FIELDS):
            raise AppError(400, "incomplete_provenance", "Every scenario input needs provenance")
        conn.execute(text("""UPDATE scenario_input_sources SET source_kind='merchant_confirmed',
            source_note='Confirmed in simulated mission review',confirmed_at=now()
            WHERE merchant_id=:mid AND scenario_id=:sid AND source_kind<>'merchant_confirmed'"""), {"mid": context.merchant_id, "sid": arm["id"]})
    other = conn.execute(text("SELECT id FROM missions WHERE merchant_id=:mid AND approval_idempotency_key=:key AND id<>:id"), {"mid": context.merchant_id, "key": key, "id": mission_id}).first()
    if other:
        raise conflict("Idempotency key already used for another mission")
    strategies.store_approval(conn, context.merchant_id, mission_id, evaluation, chosen_id)
    conn.execute(text("""UPDATE missions SET approved_revision=:rev,approval_idempotency_key=:key,
        approval_request_fingerprint=:fingerprint,updated_at=now() WHERE merchant_id=:mid AND id=:id"""),
        {"rev": reviewed_revision, "key": key, "fingerprint": fingerprint, "mid": context.merchant_id, "id": mission_id})
    _transition(conn, context, mission, "approved", "merchant", "Explicit synthetic-trial approval")
    return get_mission(conn, context.merchant_id, mission_id)


def transition(conn: Connection, context: MerchantContext, mission_id: UUID, action: str, reason: str | None = None):
    require_owner(context)
    mission = _mission(conn, context.merchant_id, mission_id, True)
    target = {"review": "reviewed", "reject": "rejected", "cancel": "cancelled"}[action]
    _transition(conn, context, mission, target, "merchant", reason)
    return get_mission(conn, context.merchant_id, mission_id)


def simulate(conn: Connection, context: MerchantContext, mission_id: UUID):
    require_owner(context)
    mission = _mission(conn, context.merchant_id, mission_id, True)
    if mission["status"] in {"completed", "reviewed"}:
        existing = conn.execute(text("SELECT 1 FROM mission_outcomes WHERE merchant_id=:mid AND mission_id=:id LIMIT 1"), {"mid": context.merchant_id, "id": mission_id}).first()
        if existing:
            return get_mission(conn, context.merchant_id, mission_id)
    if mission["status"] != "approved":
        raise conflict("Only an approved mission can run a simulated trial")
    from app import strategies
    snapshot = strategies.approved_snapshot(conn, context.merchant_id, mission_id)
    if snapshot:
        selected = snapshot["selected_strategy"]
        outcome_values = (
            ("baseline", snapshot["baseline"]["estimated_units"], snapshot["baseline"]["estimated_gmv"], snapshot["baseline"]["merchant_revenue"], snapshot["baseline"]["estimated_7d_contribution"]),
            ("trial", selected["estimated_units"], selected["estimated_gmv"], selected["merchant_revenue"], selected["estimated_7d_contribution"]),
        )
        version = snapshot["model_version"]
        learning = f"The {selected['title']} model estimates a seven-day contribution difference of THB {selected['estimated_difference']} under the approved volume assumptions. This is not observed demand."
        guidance = "Check actual costs, demand, and risks before considering any live action."
    else:
        arms = _scenario_rows(conn, context.merchant_id, mission_id, mission["approved_revision"])
        baseline = calculate(FinancialInputs(*(arms["baseline"][f] for f in FIELDS)))
        proposed = calculate(FinancialInputs(*(arms["proposed"][f] for f in FIELDS)))
        if baseline.estimated_contribution is None or proposed.estimated_contribution is None:
            raise conflict("Approved scenario is incomplete")
        outcome_values = (("baseline", 40, baseline.gmv * 40, baseline.merchant_revenue * 40, baseline.estimated_contribution * 40),
                          ("trial", 38, proposed.gmv * 38, proposed.merchant_revenue * 38, proposed.estimated_contribution * 38))
        version = "westrong-sim-v1"
        learning = "Simulated bundle contribution per unit is higher; total depends on volume and substitution."
        guidance = "Review real costs and demand before considering any live offer."
    _transition(conn, context, mission, "running", "simulation", "Started fictional seven-day trial")
    day = settings.demo_date
    for arm_name, units, gmv, revenue, contribution in outcome_values:
        start, end = (day - timedelta(days=6), day) if arm_name == "baseline" else (day + timedelta(days=1), day + timedelta(days=7))
        conn.execute(text("""INSERT INTO mission_outcomes
            (merchant_id,mission_id,arm,period_start,period_end,units,gmv,merchant_revenue,estimated_contribution,simulation_version,learning_summary,next_step_guidance)
            VALUES (:mid,:id,:arm,:start,:end,:units,:gmv,:revenue,:contribution,:version,:learning,:guidance)"""),
            {"mid": context.merchant_id, "id": mission_id, "arm": arm_name, "start": start, "end": end, "units": units, "gmv": gmv, "revenue": revenue, "contribution": contribution, "version": version, "learning": learning, "guidance": guidance})
    running = dict(mission)
    running["status"] = "running"
    _transition(conn, context, running, "completed", "simulation", "Fictional outcome generated")
    return get_mission(conn, context.merchant_id, mission_id)


def outcome(conn: Connection, mid: UUID, mission_id: UUID):
    _mission(conn, mid, mission_id)
    rows = conn.execute(text("SELECT * FROM mission_outcomes WHERE merchant_id=:mid AND mission_id=:id"), {"mid": mid, "id": mission_id}).mappings().all()
    if not rows:
        raise not_found()
    arms = {r["arm"]: {"period_start": r["period_start"].isoformat(), "period_end": r["period_end"].isoformat(), "units": r["units"], "gmv": amount(r["gmv"]), "merchant_revenue": amount(r["merchant_revenue"]), "estimated_contribution": amount(r["estimated_contribution"])} for r in rows}
    if set(arms) != {"baseline", "trial"}:
        raise AppError(500, "incomplete_outcome", "Simulated outcome is incomplete")
    from app import strategies
    snapshot = strategies.approved_snapshot(conn, mid, mission_id)
    return {"mission_id": str(mission_id), "simulated": True, "simulation_version": rows[0]["simulation_version"], "baseline": arms["baseline"], "trial": arms["trial"], "learning_summary": rows[0]["learning_summary"], "next_step_guidance": rows[0]["next_step_guidance"], "selected_strategy_id": snapshot["selected_strategy_id"] if snapshot else None, "modeled_risk_score": snapshot["selected_strategy"]["risk_score"] if snapshot else None, "baseline_estimated_difference": snapshot["selected_strategy"]["estimated_difference"] if snapshot else None, "model_assumptions": snapshot["assumptions"] if snapshot else None}
