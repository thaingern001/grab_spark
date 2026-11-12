from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DatabaseError
from fastapi.testclient import TestClient

from app.auth import issue_session
from app.main import app
from app.strategies import _risk, recommend
from scripts.seed import MERCHANT_ID, PROPOSED_ID


def test_three_models_and_lowest_risk(client, db):
    response = client.get(f"/api/v1/missions/{PROPOSED_ID}/strategies")
    assert response.status_code == 200, response.text
    data = response.json()
    assert client.get(f"/api/v1/missions/{PROPOSED_ID}/strategies").json() == data
    cases = {case["strategy_id"]: case for case in data["strategies"]}
    assert set(cases) == {"bundle", "discount", "advertising"}
    assert data["baseline"]["estimated_7d_contribution"] == "652.00"
    assert (cases["bundle"]["unit_contribution"], cases["bundle"]["estimated_7d_contribution"], cases["bundle"]["estimated_difference"]) == ("24.30", "956.00", "304.00")
    assert cases["bundle"]["volume_breakdown"] == {"retained_baseline_orders": 2, "strategy_orders": 38, "substituted_baseline_orders": 38, "incremental_orders": 0}
    assert (cases["discount"]["estimated_units"], cases["discount"]["unit_contribution"], cases["discount"]["estimated_7d_contribution"], cases["discount"]["estimated_difference"]) == (50, "11.30", "715.00", "63.00")
    assert cases["discount"]["volume_breakdown"] == {"retained_baseline_orders": 30, "strategy_orders": 20, "substituted_baseline_orders": 10, "incremental_orders": 10}
    assert cases["discount"]["merchant_discount_total"] == "100.00"
    assert (cases["advertising"]["estimated_units"], cases["advertising"]["additional_spend"], cases["advertising"]["estimated_7d_contribution"], cases["advertising"]["estimated_difference"]) == (52, "100.00", "747.60", "95.60")
    assert cases["advertising"]["volume_breakdown"] == {"retained_baseline_orders": 40, "strategy_orders": 12, "substituted_baseline_orders": 0, "incremental_orders": 12}
    assert {name: case["risk_score"] for name, case in cases.items()} == {"bundle": 25, "discount": 29, "advertising": 35}
    assert data["recommended_strategy_id"] == min(cases.values(), key=lambda case: case["risk_score"])["strategy_id"] == "bundle"
    assert all(0 <= case["risk_score"] <= 100 for case in cases.values())
    assert all(sum(case["risk_dimensions"].values()) > 0 for case in cases.values())
    for case in cases.values():
        assert Decimal(case["estimated_7d_contribution"]) - Decimal(data["baseline"]["estimated_7d_contribution"]) == Decimal(case["estimated_difference"])
        assert Decimal(case["estimated_gmv"]) - Decimal(case["platform_deduction_total"]) - Decimal(case["merchant_discount_total"]) == Decimal(case["merchant_revenue"])
        assert Decimal(case["merchant_revenue"]) - Decimal(case["variable_cost_total"]) - Decimal(case["additional_spend"]) == Decimal(case["estimated_7d_contribution"])
    assert data["assumption_details"]["discount_existing_redemption_rate"]["value"] == "0.2500"
    assert data["assumption_details"]["discount_existing_redemption_rate"]["editable"] is False
    assert "Illustrative" in data["risk_methodology"] and "not empirically validated" in data["risk_methodology"]
    for name in ("discount_demand_lift", "advertising_incremental_orders"):
        assert "not a validated forecast" in data["assumption_details"][name]["explanation"]
    with db.begin() as conn:
        seeded = conn.execute(text("SELECT baseline_units,bundle_units,discount_amount,discount_demand_lift,advertising_spend,advertising_incremental_orders FROM mission_strategy_inputs WHERE merchant_id=:mid AND mission_id=:id"), {"mid": MERCHANT_ID, "id": PROPOSED_ID}).mappings().one()
    assert seeded["baseline_units"] == 40 and seeded["bundle_units"] == 38
    assert seeded["discount_amount"] == Decimal("5.00") and seeded["advertising_spend"] == Decimal("100.00")
    assert seeded["discount_demand_lift"] == Decimal("0.2500") and seeded["advertising_incremental_orders"] == 12


def test_risk_boundaries_ties_and_eligibility():
    assert _risk("bundle", Decimal("100"), Decimal("100000"), Decimal(0))[0] >= 0
    assert _risk("advertising", Decimal("1"), Decimal("-100000"), Decimal("100000"))[0] <= 100
    tied = [{"strategy_id": "advertising", "risk_score": 20, "eligible": True}, {"strategy_id": "bundle", "risk_score": 20, "eligible": True}]
    assert recommend(tied)["strategy_id"] == "bundle"
    tied[1]["eligible"] = False
    assert recommend(tied)["strategy_id"] == "advertising"


def test_assumption_revision_recalculates_and_approval_snapshot(client, db):
    path = f"/api/v1/missions/{PROPOSED_ID}"
    initial = client.get(path + "/strategies").json()
    assumptions = dict(initial["assumptions"])
    assumptions["advertising_spend"] = "120.00"
    saved = client.put(path + "/strategies/assumptions", headers={"If-Match": "1"}, json=assumptions)
    assert saved.status_code == 200, saved.text
    assert saved.json()["evaluation_revision"] == 2
    assert next(case for case in saved.json()["strategies"] if case["strategy_id"] == "advertising")["estimated_7d_contribution"] == "727.60"
    assert client.put(path + "/strategies/assumptions", headers={"If-Match": "1"}, json=assumptions).status_code == 409
    body = {"reviewed_revision": 1, "evaluation_revision": 1, "selected_strategy_id": "bundle", "confirm_material_inputs": True, "acknowledge_simulation": True}
    assert client.post(path + "/approve", headers={"Idempotency-Key": "strategy-approval"}, json=body).status_code == 409
    body["evaluation_revision"] = 2
    assert client.post(path + "/approve", headers={"Idempotency-Key": "strategy-approval"}, json=body).status_code == 200
    assert client.post(path + "/approve", headers={"Idempotency-Key": "strategy-approval"}, json=body).status_code == 200
    assert client.put(path + "/strategies/assumptions", headers={"If-Match": "2"}, json=assumptions).status_code == 409
    with db.begin() as conn:
        approved = conn.execute(text("SELECT strategy_id,evaluation_revision,snapshot FROM mission_strategy_approvals WHERE merchant_id=:mid AND mission_id=:id"), {"mid": MERCHANT_ID, "id": PROPOSED_ID}).mappings().one()
        assert approved["strategy_id"] == "bundle" and approved["evaluation_revision"] == 2
        assert approved["snapshot"]["assumptions"]["advertising_spend"] == "120.00"
    assert client.get(path + "/strategies").json()["strategies"] == approved["snapshot"]["strategies"]
    with pytest.raises(DatabaseError):
        with db.begin() as conn:
            conn.execute(text("UPDATE mission_strategy_approvals SET strategy_id='discount' WHERE mission_id=:id"), {"id": PROPOSED_ID})
    assert client.post(path + "/simulate").json()["status"] == "completed"
    assert client.post(path + "/simulate").json()["status"] == "completed"
    outcome = client.get(path + "/outcome").json()
    assert outcome["selected_strategy_id"] == "bundle"
    assert outcome["trial"]["estimated_contribution"] == "956.00"
    assert outcome["baseline_estimated_difference"] == "304.00"
    assert outcome["simulation_version"] == "multi-strategy-v2"
    assert outcome["baseline"]["estimated_contribution"] == approved["snapshot"]["baseline"]["estimated_7d_contribution"]
    assert outcome["trial"]["estimated_contribution"] == approved["snapshot"]["selected_strategy"]["estimated_7d_contribution"]


def test_positive_zero_and_higher_return_higher_risk(client):
    path = f"/api/v1/missions/{PROPOSED_ID}/strategies"
    initial = client.get(path).json()
    values = dict(initial["assumptions"])
    values["discount_demand_lift"] = "0.1250"  # Five incremental orders offset ten cannibalized orders.
    values["advertising_incremental_orders"] = 30
    changed = client.put(path + "/assumptions", headers={"If-Match": "1"}, json=values).json()
    cases = {case["strategy_id"]: case for case in changed["strategies"]}
    assert cases["discount"]["estimated_difference"] == "6.50"
    assert Decimal(cases["advertising"]["estimated_difference"]) > Decimal(cases["bundle"]["estimated_difference"])
    assert cases["advertising"]["risk_score"] > cases["bundle"]["risk_score"]
    assert changed["recommended_strategy_id"] == "bundle"
    values.update(baseline_units=0, bundle_units=0, discount_amount="0.00", discount_demand_lift="0.0000", advertising_spend="0.00", advertising_incremental_orders=0)
    zero = client.put(path + "/assumptions", headers={"If-Match": "2"}, json=values).json()
    assert all(case["estimated_difference"] == "0.00" for case in zero["strategies"])


def test_lower_demand_can_produce_negative_incremental_contribution(client):
    path = f"/api/v1/missions/{PROPOSED_ID}/strategies"
    values = dict(client.get(path).json()["assumptions"])
    values["discount_demand_lift"] = "0.0000"
    values["advertising_incremental_orders"] = 0
    changed = client.put(path + "/assumptions", headers={"If-Match": "1"}, json=values)
    assert changed.status_code == 200, changed.text
    cases = {case["strategy_id"]: case for case in changed.json()["strategies"]}
    assert cases["discount"]["estimated_difference"] == "-50.00"
    assert cases["advertising"]["estimated_difference"] == "-100.00"
    assert changed.json()["recommended_strategy_id"] == "bundle"


@pytest.mark.parametrize("strategy_id,contribution,difference", [
    ("discount", "715.00", "63.00"),
    ("advertising", "747.60", "95.60"),
])
def test_consent_selection_and_scope(client, strategy_id, contribution, difference):
    path = f"/api/v1/missions/{PROPOSED_ID}"
    assert client.get(f"/api/v1/missions/{uuid4()}/strategies").status_code == 404
    body = {"reviewed_revision": 1, "evaluation_revision": 1, "selected_strategy_id": strategy_id, "confirm_material_inputs": True, "acknowledge_simulation": True}
    body["confirm_material_inputs"] = False
    assert client.post(path + "/approve", headers={"Idempotency-Key": "no-consent"}, json=body).status_code == 400
    body["confirm_material_inputs"] = True
    assert client.post(path + "/approve", headers={"Idempotency-Key": f"{strategy_id}-choice"}, json=body).status_code == 200
    assert client.post(path + "/simulate").json()["status"] == "completed"
    outcome = client.get(path + "/outcome").json()
    assert outcome["selected_strategy_id"] == strategy_id
    assert outcome["trial"]["estimated_contribution"] == contribution
    assert outcome["baseline_estimated_difference"] == difference


def test_strategy_endpoints_isolate_merchants(client, db):
    other_merchant, other_owner = uuid4(), uuid4()
    with db.begin() as conn:
        conn.execute(text("INSERT INTO merchants(id,name,business_type,currency,timezone) VALUES (:id,'Other Shop','Restaurant','THB','Asia/Bangkok')"), {"id": other_merchant})
        conn.execute(text("INSERT INTO merchant_users(id,merchant_id,email,display_name,role) VALUES (:id,:mid,'other@example.test','Other Owner','owner')"), {"id": other_owner, "mid": other_merchant})
    session, csrf = issue_session(other_owner)
    path = f"/api/v1/missions/{PROPOSED_ID}/strategies"
    with TestClient(app, cookies={"demo_session": session}, headers={"X-CSRF-Token": csrf}) as other:
        assert other.get(path).status_code == 404
        assert other.put(path + "/assumptions", headers={"If-Match": "1"}, json={"baseline_units": 40, "bundle_units": 38, "discount_amount": "5.00", "discount_demand_lift": "0.2500", "advertising_spend": "100.00", "advertising_incremental_orders": 12}).status_code == 404


def test_failed_simulation_rolls_back_and_retry_succeeds(client, db, monkeypatch):
    from app import missions

    path = f"/api/v1/missions/{PROPOSED_ID}"
    body = {"reviewed_revision": 1, "evaluation_revision": 1, "selected_strategy_id": "bundle", "confirm_material_inputs": True, "acknowledge_simulation": True}
    assert client.post(path + "/approve", headers={"Idempotency-Key": "failure-retry"}, json=body).status_code == 200
    original = missions._transition

    def fail_after_running(conn, context, mission, target, source, reason):
        original(conn, context, mission, target, source, reason)
        if target == "running":
            raise RuntimeError("synthetic processing failure")

    with monkeypatch.context() as patch:
        patch.setattr(missions, "_transition", fail_after_running)
        with pytest.raises(RuntimeError, match="synthetic processing failure"):
            client.post(path + "/simulate")
    assert client.get(path).json()["status"] == "approved"
    with db.begin() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM mission_outcomes WHERE mission_id=:id"), {"id": PROPOSED_ID}).scalar() == 0
    assert client.post(path + "/simulate").json()["status"] == "completed"
