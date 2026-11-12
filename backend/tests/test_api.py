from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth import issue_session
from app.main import app
from scripts.seed import COMPLETED_ID, OWNER_ID, PROPOSED_ID, MERCHANT_ID


def _approval(revision=1):
    return {"reviewed_revision": revision, "confirm_material_inputs": True, "acknowledge_simulation": True}


def test_core_reads_and_reconciliation(client, db):
    merchant = client.get("/api/v1/merchants/me")
    assert merchant.status_code == 200 and merchant.json()["name"] == "Westrong Kitchen"
    dashboard = client.get("/api/v1/dashboard").json()
    today = client.get("/api/v1/analytics/sales?from=2026-11-07&to=2026-11-07").json()
    assert dashboard["today"]["gmv"] == today["summary"]["gmv"]
    assert dashboard["today"]["orders"] == today["summary"]["orders"]
    assert len(dashboard["monthly_trend"]) == 6
    assert dashboard["opportunity"]["id"] == str(PROPOSED_ID)
    ranked = client.get("/api/v1/analytics/menus?from=2026-05-01&to=2026-10-31").json()
    sales = client.get("/api/v1/analytics/sales?from=2026-05-01&to=2026-10-31&granularity=month").json()
    assert ranked[0]["name"] == "Chicken Rice"
    assert sum(Decimal(x["gmv"]) for x in ranked) == Decimal(sales["summary"]["gmv"])
    assert sum(Decimal(x["gmv"]) for x in sales["series"]) == Decimal(sales["summary"]["gmv"])
    assert client.get("/api/v1/menus").status_code == 200
    assert len(client.get("/api/v1/missions").json()) == 2
    assert client.get(f"/api/v1/missions/{COMPLETED_ID}/outcome").json()["simulated"] is True


def test_scenario_save_approval_simulation_and_retry(client, db):
    path = f"/api/v1/missions/{PROPOSED_ID}"
    historical_before = client.get("/api/v1/analytics/sales?from=2026-11-07&to=2026-11-07").json()["summary"]
    initial = client.get(path + "/scenarios").json()
    assert initial["contribution_difference"] == "8.00"
    body = {arm: {key: initial[arm][key] for key in ("label", "unit_price", "food_cost", "packaging_cost", "other_variable_cost", "deduction_rate", "merchant_discount")} for arm in ("baseline", "proposed")}
    body["proposed"]["merchant_discount"] = "1.00"
    saved = client.put(path + "/scenarios", headers={"If-Match": "1"}, json=body)
    assert saved.status_code == 200, saved.text
    assert saved.json()["revision"] == 2
    assert saved.json()["contribution_difference"] == "7.00"
    assert saved.json()["proposed"]["sources"]["merchant_discount"]["source_kind"] == "assumption"
    stale = client.post(path + "/approve", headers={"Idempotency-Key": "approval-12345"}, json=_approval(1))
    assert stale.status_code == 409
    approved = client.post(path + "/approve", headers={"Idempotency-Key": "approval-12345"}, json=_approval(2))
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    repeat = client.post(path + "/approve", headers={"Idempotency-Key": "approval-12345"}, json=_approval(2))
    assert repeat.status_code == 200
    assert len([e for e in repeat.json()["events"] if e["to_status"] == "approved"]) == 1
    assert client.put(path + "/scenarios", headers={"If-Match": "2"}, json=body).status_code == 409
    assert client.post(path + "/simulate").json()["status"] == "completed"
    late_retry = client.post(path + "/approve", headers={"Idempotency-Key": "approval-12345"}, json=_approval(2))
    assert late_retry.status_code == 200 and late_retry.json() == approved.json()
    outcome = client.get(path + "/outcome").json()
    assert outcome["simulated"] is True
    assert outcome["trial"]["units"] == 40  # 38 substituted bundles and 2 retained baseline orders.
    assert outcome["trial"]["estimated_contribution"] == "918.00"
    assert client.get("/api/v1/analytics/sales?from=2026-11-07&to=2026-11-07").json()["summary"] == historical_before
    assert client.post(path + "/transitions", json={"action": "review"}).json()["status"] == "reviewed"
    assert client.post(path + "/transitions", json={"action": "cancel"}).status_code == 409
    with db.begin() as conn:
        source = conn.execute(text("SELECT count(*) FROM scenario_input_sources WHERE merchant_id=:mid AND source_kind='merchant_confirmed' AND confirmed_at IS NOT NULL"), {"mid": MERCHANT_ID}).scalar()
        assert source >= 12


def test_auth_roles_scope_and_validation(client, db):
    assert TestClient(app).get("/api/v1/dashboard").status_code == 401
    assert client.get(f"/api/v1/missions/{uuid4()}").status_code == 404
    assert client.get("/api/v1/analytics/sales?from=2026-11-08&to=2026-11-07").status_code == 400
    assert client.get("/api/v1/analytics/sales?from=2026-05-01&to=2026-11-07").status_code == 200
    no_csrf = TestClient(app, cookies=client.cookies)
    assert no_csrf.post(f"/api/v1/missions/{PROPOSED_ID}/approve", headers={"Idempotency-Key": "approval-12345"}, json=_approval()).status_code == 403
    viewer = uuid4()
    other_merchant = uuid4()
    other_owner = uuid4()
    with db.begin() as conn:
        conn.execute(text("INSERT INTO merchant_users(id,merchant_id,email,display_name,role) VALUES (:id,:mid,'viewer@example.test','Viewer','viewer')"), {"id": viewer, "mid": MERCHANT_ID})
        conn.execute(text("INSERT INTO merchants(id,name,business_type) VALUES (:id,'Other fictional shop','Restaurant')"), {"id": other_merchant})
        conn.execute(text("INSERT INTO merchant_users(id,merchant_id,email,display_name,role) VALUES (:id,:mid,'other@example.test','Other','owner')"), {"id": other_owner, "mid": other_merchant})
    viewer_session, viewer_csrf = issue_session(viewer)
    viewer_client = TestClient(app, cookies={"demo_session": viewer_session}, headers={"X-CSRF-Token": viewer_csrf})
    assert viewer_client.get("/api/v1/dashboard").status_code == 200
    assert viewer_client.post(f"/api/v1/missions/{PROPOSED_ID}/approve", headers={"Idempotency-Key": "viewer-approval"}, json=_approval()).status_code == 403
    other_session, other_csrf = issue_session(other_owner)
    other_client = TestClient(app, cookies={"demo_session": other_session}, headers={"X-CSRF-Token": other_csrf})
    assert other_client.get(f"/api/v1/missions/{PROPOSED_ID}").status_code == 404
    assert other_client.post(f"/api/v1/missions/{PROPOSED_ID}/approve", headers={"Idempotency-Key": "other-approval"}, json=_approval()).status_code == 404
    with db.begin() as conn:
        conn.execute(text("UPDATE merchant_users SET active=false WHERE id=:id"), {"id": viewer})
    assert viewer_client.get("/api/v1/dashboard").status_code == 401


def test_concurrent_approval_same_key(db):
    session, csrf = issue_session(OWNER_ID)
    path = f"/api/v1/missions/{PROPOSED_ID}/approve"
    def call():
        with TestClient(app, cookies={"demo_session": session}, headers={"X-CSRF-Token": csrf}) as client:
            return client.post(path, headers={"Idempotency-Key": "concurrent-approval"}, json=_approval()).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(lambda _: call(), range(2))) == [200, 200]
    with db.begin() as conn:
        count = conn.execute(text("SELECT count(*) FROM mission_events WHERE merchant_id=:mid AND mission_id=:id AND to_status='approved'"), {"mid": MERCHANT_ID, "id": PROPOSED_ID}).scalar()
        assert count == 1


def test_concurrent_approval_different_keys(db):
    session, csrf = issue_session(OWNER_ID)
    path = f"/api/v1/missions/{PROPOSED_ID}/approve"
    def call(key):
        with TestClient(app, cookies={"demo_session": session}, headers={"X-CSRF-Token": csrf}) as test_client:
            return test_client.post(path, headers={"Idempotency-Key": key}, json=_approval()).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(call, ("first-approval-key", "second-approval-key")))
    assert sorted(statuses) == [200, 409]
    with db.begin() as conn:
        assert conn.execute(text("SELECT count(*) FROM mission_events WHERE mission_id=:id AND to_status='approved'"), {"id": PROPOSED_ID}).scalar() == 1


def test_concurrent_scenario_saves(db):
    session, csrf = issue_session(OWNER_ID)
    path = f"/api/v1/missions/{PROPOSED_ID}/scenarios"
    with TestClient(app, cookies={"demo_session": session}, headers={"X-CSRF-Token": csrf}) as test_client:
        initial = test_client.get(path).json()
    body = {arm: {key: initial[arm][key] for key in ("label", "unit_price", "food_cost", "packaging_cost", "other_variable_cost", "deduction_rate", "merchant_discount")} for arm in ("baseline", "proposed")}
    def call(_):
        with TestClient(app, cookies={"demo_session": session}, headers={"X-CSRF-Token": csrf}) as test_client:
            return test_client.put(path, headers={"If-Match": "1"}, json=body).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(call, range(2)))
    assert sorted(statuses) == [200, 409]
    with db.begin() as conn:
        assert conn.execute(text("SELECT current_revision FROM missions WHERE id=:id"), {"id": PROPOSED_ID}).scalar() == 2


def test_save_versus_approval_serializes(db):
    session, csrf = issue_session(OWNER_ID)
    base = f"/api/v1/missions/{PROPOSED_ID}"
    with TestClient(app, cookies={"demo_session": session}, headers={"X-CSRF-Token": csrf}) as test_client:
        initial = test_client.get(base + "/scenarios").json()
    body = {arm: {key: initial[arm][key] for key in ("label", "unit_price", "food_cost", "packaging_cost", "other_variable_cost", "deduction_rate", "merchant_discount")} for arm in ("baseline", "proposed")}
    body["proposed"]["unit_price"] = "100.00"
    def save():
        with TestClient(app, cookies={"demo_session": session}, headers={"X-CSRF-Token": csrf}) as test_client:
            return test_client.put(base + "/scenarios", headers={"If-Match": "1"}, json=body).status_code
    def approve():
        with TestClient(app, cookies={"demo_session": session}, headers={"X-CSRF-Token": csrf}) as test_client:
            return test_client.post(base + "/approve", headers={"Idempotency-Key": "save-versus-approval"}, json=_approval()).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        save_result = pool.submit(save)
        approve_result = pool.submit(approve)
        assert sorted([save_result.result(), approve_result.result()]) == [200, 409]
    with db.begin() as conn:
        row = conn.execute(text("SELECT status,current_revision,approved_revision FROM missions WHERE id=:id"), {"id": PROPOSED_ID}).one()
        assert row in (("proposed", 2, None), ("approved", 1, 1))


def test_reject_transition(client, db):
    path = f"/api/v1/missions/{PROPOSED_ID}"
    rejected = client.post(path + "/transitions", json={"action": "reject", "reason": "Not suitable"})
    assert rejected.status_code == 200 and rejected.json()["status"] == "rejected"
    assert client.post(path + "/approve", headers={"Idempotency-Key": "after-rejection"}, json=_approval()).status_code == 409


def test_cancel_transition(client, db):
    path = f"/api/v1/missions/{PROPOSED_ID}"
    assert client.post(path + "/approve", headers={"Idempotency-Key": "approve-then-cancel"}, json=_approval()).status_code == 200
    cancelled = client.post(path + "/transitions", json={"action": "cancel"})
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"


def test_approval_transaction_rollback(db):
    import pytest
    from app.auth import MerchantContext
    from app.missions import approve
    context = MerchantContext(OWNER_ID, MERCHANT_ID, "owner")
    with pytest.raises(RuntimeError):
        with db.begin() as conn:
            approve(conn, context, PROPOSED_ID, 1, "rollback-approval", True, True)
            raise RuntimeError("force rollback")
    with db.begin() as conn:
        row = conn.execute(text("SELECT status,approved_revision FROM missions WHERE id=:id"), {"id": PROPOSED_ID}).one()
        assert row == ("proposed", None)
        assert conn.execute(text("SELECT count(*) FROM mission_events WHERE mission_id=:id AND to_status='approved'"), {"id": PROPOSED_ID}).scalar() == 0
        assert conn.execute(text("""SELECT count(*) FROM scenario_input_sources src JOIN mission_scenarios s ON s.id=src.scenario_id
            WHERE s.mission_id=:id AND src.source_kind='merchant_confirmed'"""), {"id": PROPOSED_ID}).scalar() == 0
