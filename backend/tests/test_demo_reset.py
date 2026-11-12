from fastapi.testclient import TestClient
from sqlalchemy import text

from app import demo_reset
from app.main import app
from scripts.seed import COMPLETED_ID, MERCHANT_ID, PROPOSED_ID


def test_demo_reset_rejected_outside_disposable_preview(client, db):
    path = "/api/v1/demo/reset"
    assert client.post(path).status_code == 403
    assert TestClient(app, cookies=client.cookies).post(path).status_code == 403
    assert TestClient(app).post(path).status_code == 401
    assert client.get(f"/api/v1/missions/{PROPOSED_ID}").json()["status"] == "proposed"


def test_demo_reset_restores_seeded_mission_and_history(client, db, monkeypatch):
    path = f"/api/v1/missions/{PROPOSED_ID}"
    initial = client.get(path + "/strategies").json()
    assumptions = dict(initial["assumptions"])
    assumptions["bundle_units"] = 39
    assert client.put(path + "/strategies/assumptions", headers={"If-Match": "1"}, json=assumptions).status_code == 200
    approval = {"reviewed_revision": 1, "evaluation_revision": 2, "selected_strategy_id": "bundle", "confirm_material_inputs": True, "acknowledge_simulation": True}
    assert client.post(path + "/approve", headers={"Idempotency-Key": "reset-demo-test"}, json=approval).status_code == 200
    assert client.post(path + "/simulate").json()["status"] == "completed"
    assert client.post(path + "/transitions", json={"action": "review"}).json()["status"] == "reviewed"

    # The test fixture uses grabspark_test; only this test substitutes the
    # database-location guard so it can exercise the reset transaction safely.
    monkeypatch.setattr(demo_reset, "_is_disposable_preview", lambda conn: True)
    response = client.post("/api/v1/demo/reset")
    assert response.status_code == 200, response.text
    assert response.json()["mission_status"] == "proposed"
    mission = client.get(path).json()
    assert mission["status"] == "proposed" and mission["current_revision"] == 1
    restored = client.get(path + "/strategies").json()
    assert restored["evaluation_revision"] == 1
    assert restored["assumptions"]["discount_demand_lift"] == "0.2500"
    assert restored["assumptions"]["advertising_incremental_orders"] == 12
    assert client.get(f"/api/v1/missions/{COMPLETED_ID}/outcome").status_code == 200
    with db.begin() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM mission_strategy_approvals WHERE merchant_id=:mid"), {"mid": MERCHANT_ID}).scalar() == 0
        assert conn.execute(text("SELECT COUNT(*) FROM mission_outcomes WHERE merchant_id=:mid AND mission_id=:id"), {"mid": MERCHANT_ID, "id": PROPOSED_ID}).scalar() == 0
    assert client.post("/api/v1/demo/reset").status_code == 200
