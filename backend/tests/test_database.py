from uuid import uuid4
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, DatabaseError

from scripts.seed import MERCHANT_ID, PROPOSED_ID, COMPLETED_ID


def test_migration_smoke(db):
    with db.begin() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0002_multi_strategy"
        assert conn.execute(text("SELECT count(*) FROM orders")).scalar() == 2953


def test_seed_idempotency(db):
    from scripts.seed import seed
    with db.begin() as conn:
        first = (conn.execute(text("SELECT count(*) FROM orders")).scalar(), conn.execute(text("SELECT count(*) FROM order_items")).scalar())
        seed(conn)
        second = (conn.execute(text("SELECT count(*) FROM orders")).scalar(), conn.execute(text("SELECT count(*) FROM order_items")).scalar())
    assert first == second == (2953, 4168)


def test_provenance_constraints(db):
    with pytest.raises(IntegrityError):
        with db.begin() as conn:
            conn.execute(text("""INSERT INTO menu_cost_assumptions
                (merchant_id,menu_item_id,source_kind,effective_from)
                SELECT merchant_id,id,'merchant_confirmed',now() FROM menu_items WHERE merchant_id=:mid LIMIT 1"""), {"mid": MERCHANT_ID})
    with pytest.raises(IntegrityError):
        with db.begin() as conn:
            conn.execute(text("UPDATE order_items SET provenance='merchant_confirmed' WHERE id=(SELECT id FROM order_items LIMIT 1)"))


def test_cross_merchant_fk(db):
    with pytest.raises(IntegrityError):
        with db.begin() as conn:
            conn.execute(text("""INSERT INTO order_items
                (merchant_id,order_id,menu_item_id,quantity,unit_price,unit_merchant_discount,unit_deduction_rate,
                 unit_deduction_amount,unit_food_cost,unit_packaging_cost,unit_other_variable_cost,provenance)
                 SELECT :other,o.id,i.menu_item_id,1,79,0,0.3,23.70,35,4,0,'assumption'
                 FROM orders o JOIN order_items i ON i.order_id=o.id LIMIT 1"""), {"other": uuid4()})


def test_scenario_pair_and_source_completeness(db):
    with pytest.raises(DatabaseError):
        with db.begin() as conn:
            conn.execute(text("""INSERT INTO mission_scenarios
                (merchant_id,mission_id,revision,arm,label,unit_price)
                VALUES (:mid,:mission,2,'baseline','Incomplete',79)"""), {"mid": MERCHANT_ID, "mission": PROPOSED_ID})


def test_approved_scenario_and_events_immutable(db):
    with pytest.raises(DatabaseError):
        with db.begin() as conn:
            conn.execute(text("UPDATE mission_scenarios SET unit_price=100 WHERE mission_id=:id"), {"id": COMPLETED_ID})
    with pytest.raises(DatabaseError):
        with db.begin() as conn:
            conn.execute(text("UPDATE scenario_input_sources SET source_note='tampered' WHERE scenario_id=(SELECT id FROM mission_scenarios WHERE mission_id=:id LIMIT 1)"), {"id": COMPLETED_ID})
    with pytest.raises(DatabaseError):
        with db.begin() as conn:
            conn.execute(text("DELETE FROM mission_events WHERE mission_id=:id"), {"id": COMPLETED_ID})
