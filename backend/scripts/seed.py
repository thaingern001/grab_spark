"""Idempotent fictional Westrong Kitchen data, anchored to 2026-11-07."""
import random
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.core import settings
from app.db import engine
from app.finance import FinancialInputs, calculate
from app.strategies import DEFAULTS

SEED_VERSION = "westrong-v1"
ANCHOR = date(2026, 11, 7)
TZ = ZoneInfo("Asia/Bangkok")
MERCHANT_ID = uuid5(NAMESPACE_URL, "grabspark:westrong:merchant")
OWNER_ID = uuid5(NAMESPACE_URL, "grabspark:westrong:owner")
PROPOSED_ID = uuid5(NAMESPACE_URL, "grabspark:westrong:proposed-bundle")
COMPLETED_ID = uuid5(NAMESPACE_URL, "grabspark:westrong:completed-example")

MENU = [
    ("chicken-rice", "Chicken Rice", "Rice", "79.00", "35.00", "4.00"),
    ("thai-tea", "Thai Iced Tea", "Drink", "35.00", "12.00", "3.00"),
    ("pad-krapow", "Pad Krapow", "Rice", "89.00", "42.00", "4.00"),
    ("pad-thai", "Pad Thai", "Noodles", "95.00", "45.00", "4.00"),
    ("tom-yum", "Tom Yum Soup", "Soup", "109.00", "54.00", "5.00"),
    ("water", "Bottled Water", "Drink", "20.00", "7.00", "2.00"),
]


def sid(name: str):
    return uuid5(NAMESPACE_URL, f"grabspark:{SEED_VERSION}:{name}")


def _local(day: date, hour: int, minute: int = 0):
    return datetime.combine(day, time(hour, minute), TZ).astimezone(timezone.utc)


def seed(conn: Connection) -> dict:
    if settings.demo_date != ANCHOR:
        raise RuntimeError("Seed v1 requires documented DEMO_DATE=2026-11-07")
    conn.execute(text("""INSERT INTO merchants(id,name,business_type,currency,timezone)
        VALUES (:id,'Westrong Kitchen','Small Thai restaurant','THB','Asia/Bangkok') ON CONFLICT DO NOTHING"""), {"id": MERCHANT_ID})
    conn.execute(text("""INSERT INTO merchant_users(id,merchant_id,email,display_name,role)
        VALUES (:id,:mid,'owner@westrong.example','Westrong Owner','owner') ON CONFLICT DO NOTHING"""), {"id": OWNER_ID, "mid": MERCHANT_ID})
    menu_ids = {}
    for code, name, category, price, food, package in MENU:
        item_id = sid(f"menu:{code}")
        menu_ids[code] = item_id
        conn.execute(text("""INSERT INTO menu_items(id,merchant_id,name,category,current_price,available)
            VALUES (:id,:mid,:name,:category,:price,true) ON CONFLICT DO NOTHING"""),
            {"id": item_id, "mid": MERCHANT_ID, "name": name, "category": category, "price": Decimal(price)})
        conn.execute(text("""INSERT INTO menu_cost_assumptions
            (id,merchant_id,menu_item_id,food_cost,packaging_cost,other_variable_cost,deduction_rate,source_kind,source_note,effective_from)
            VALUES (:id,:mid,:item,:food,:package,0.00,0.3000,'assumption','Fictional demo assumption',:effective)
            ON CONFLICT DO NOTHING"""), {"id": sid(f"cost:{code}"), "mid": MERCHANT_ID, "item": item_id, "food": Decimal(food), "package": Decimal(package), "effective": _local(date(2026, 4, 30), 0)})

    rng = random.Random(20261107)
    orders, lines = [], []
    day = date(2026, 5, 1)
    while day <= date(2026, 10, 31):
        count = 11 + (day.month - 5) + (3 if day.weekday() >= 5 else 0) + rng.randrange(4)
        _generate_day(day, count, rng, menu_ids, orders, lines)
        day += timedelta(days=1)
    _generate_day(ANCHOR, 23, rng, menu_ids, orders, lines)
    conn.execute(text("""INSERT INTO orders(id,merchant_id,placed_at,status,synthetic,seed_version)
        VALUES (:id,:mid,:placed,:status,true,:seed) ON CONFLICT DO NOTHING"""), orders)
    conn.execute(text("""INSERT INTO order_items
        (id,merchant_id,order_id,menu_item_id,quantity,unit_price,unit_merchant_discount,unit_deduction_rate,
         unit_deduction_amount,unit_food_cost,unit_packaging_cost,unit_other_variable_cost,provenance,source_note)
        VALUES (:id,:mid,:order_id,:item,:quantity,:price,0.00,0.3000,:deduction,:food,:package,0.00,
                'synthetic_history','Deterministic fictional order snapshot') ON CONFLICT DO NOTHING"""), lines)

    for mission_id, title, status in (
        (PROPOSED_ID, "Try a chicken rice + drink bundle", "proposed"),
        (COMPLETED_ID, "Earlier fictional bundle trial", "completed"),
    ):
        conn.execute(text("""INSERT INTO missions
            (id,merchant_id,title,rationale,intended_outcome,status,trial_days,current_revision,approved_revision,created_at,updated_at)
            VALUES (:id,:mid,:title,'Chicken rice leads synthetic item sales; drinks often accompany it.',
                    'Compare estimated contribution per unit and learn from a fictional seven-day trial',
                    :status,7,1,:approved,:created,:created) ON CONFLICT DO NOTHING"""),
            {"id": mission_id, "mid": MERCHANT_ID, "title": title, "status": status, "approved": 1 if status == "completed" else None, "created": _local(date(2026, 10, 31), 9)})
        for arm, label, price, food, package in (
            ("baseline", "Chicken rice", Decimal("79.00"), Decimal("35.00"), Decimal("4.00")),
            ("proposed", "Chicken rice + drink bundle", Decimal("99.00"), Decimal("40.00"), Decimal("5.00")),
        ):
            scenario_id = sid(f"scenario:{mission_id}:{arm}")
            conn.execute(text("""INSERT INTO mission_scenarios
                (id,merchant_id,mission_id,revision,arm,label,unit_price,food_cost,packaging_cost,other_variable_cost,deduction_rate,merchant_discount)
                VALUES (:id,:mid,:mission,1,:arm,:label,:price,:food,:package,0.00,0.3000,0.00)
                ON CONFLICT DO NOTHING"""), {"id": scenario_id, "mid": MERCHANT_ID, "mission": mission_id, "arm": arm, "label": label, "price": price, "food": food, "package": package})
            for field in ("unit_price", "food_cost", "packaging_cost", "other_variable_cost", "deduction_rate", "merchant_discount"):
                confirmed = status == "completed"
                source_kind = "merchant_confirmed" if confirmed else ("synthetic_history" if arm == "baseline" and field == "unit_price" else "assumption")
                conn.execute(text("""INSERT INTO scenario_input_sources
                    (id,merchant_id,scenario_id,input_name,source_kind,source_note,confirmed_at)
                    VALUES (:id,:mid,:scenario,:field,:kind,'Fictional seed input',:confirmed)
                    ON CONFLICT DO NOTHING"""), {"id": sid(f"source:{scenario_id}:{field}"), "mid": MERCHANT_ID, "scenario": scenario_id, "field": field, "kind": source_kind, "confirmed": _local(date(2026, 11, 1), 10) if confirmed else None})
        event_states = ("proposed", "approved", "running", "completed") if status == "completed" else ("proposed",)
        previous = None
        for sequence, state in enumerate(event_states):
            conn.execute(text("""INSERT INTO mission_events
                (id,merchant_id,mission_id,actor_user_id,from_status,to_status,source,reason,occurred_at)
                VALUES (:id,:mid,:mission,:user,:old,:new,'seed','Synthetic seeded mission history',:at)
                ON CONFLICT DO NOTHING"""), {"id": sid(f"event:{mission_id}:{sequence}"), "mid": MERCHANT_ID, "mission": mission_id, "user": OWNER_ID, "old": previous, "new": state, "at": _local(date(2026, 11, 1 + sequence), 10)})
            previous = state
    conn.execute(text("""INSERT INTO mission_strategy_inputs
        (merchant_id,mission_id,evaluation_revision,baseline_units,bundle_units,discount_amount,discount_demand_lift,advertising_spend,advertising_incremental_orders)
        VALUES (:mid,:mission,1,:baseline_units,:bundle_units,:discount_amount,:discount_demand_lift,:advertising_spend,:advertising_incremental_orders)
        ON CONFLICT DO NOTHING"""), {"mid": MERCHANT_ID, "mission": PROPOSED_ID, **DEFAULTS})
    for arm, units, price, food, package, start, end in (
        ("baseline", 40, Decimal("79"), Decimal("35"), Decimal("4"), date(2026, 10, 25), date(2026, 10, 31)),
        ("trial", 38, Decimal("99"), Decimal("40"), Decimal("5"), date(2026, 11, 1), date(2026, 11, 7)),
    ):
        result = calculate(FinancialInputs(price, food, package, Decimal("0"), Decimal("0.3000"), Decimal("0")))
        conn.execute(text("""INSERT INTO mission_outcomes
            (id,merchant_id,mission_id,arm,period_start,period_end,units,gmv,merchant_revenue,estimated_contribution,
             simulated,simulation_version,generated_at,learning_summary,next_step_guidance)
            VALUES (:id,:mid,:mission,:arm,:start,:end,:units,:gmv,:revenue,:contribution,true,'westrong-sim-v1',:at,
              'Fictional bundle contribution per unit is higher; volume and substitution still matter.',
              'Verify real costs and demand before considering any live offer.') ON CONFLICT DO NOTHING"""),
            {"id": sid(f"outcome:{arm}"), "mid": MERCHANT_ID, "mission": COMPLETED_ID, "arm": arm, "start": start, "end": end, "units": units, "gmv": result.gmv * units, "revenue": result.merchant_revenue * units, "contribution": result.estimated_contribution * units, "at": _local(ANCHOR, 12)})
    return {"merchant_id": str(MERCHANT_ID), "owner_id": str(OWNER_ID), "orders": len(orders), "order_items": len(lines), "seed_version": SEED_VERSION}


def _generate_day(day, count, rng, menu_ids, orders, lines):
    lookup = {code: (Decimal(price), Decimal(food), Decimal(package)) for code, _, _, price, food, package in MENU}
    codes = ["chicken-rice", "thai-tea", "pad-krapow", "pad-thai", "tom-yum", "water"]
    weights = [44, 18, 15, 12, 7, 4]
    for index in range(count):
        order_id = sid(f"order:{day}:{index}")
        status = "refunded" if index == 0 and day.day % 17 == 0 else "cancelled" if index == 1 and day.day % 19 == 0 else "completed"
        orders.append({"id": order_id, "mid": MERCHANT_ID, "placed": _local(day, 10 + (index % 11), (index * 7) % 60), "status": status, "seed": SEED_VERSION})
        main = rng.choices(codes, weights)[0]
        selections = [main]
        if main == "chicken-rice" and rng.random() < 0.46:
            selections.append("thai-tea")
        elif rng.random() < 0.25:
            selections.append("water")
        for line_index, code in enumerate(selections):
            price, food, package = lookup[code]
            calculation = calculate(FinancialInputs(price, food, package, Decimal("0"), Decimal("0.3000"), Decimal("0")))
            lines.append({"id": sid(f"line:{day}:{index}:{line_index}"), "mid": MERCHANT_ID, "order_id": order_id, "item": menu_ids[code], "quantity": 1, "price": price, "deduction": calculation.deduction_amount, "food": food, "package": package})


if __name__ == "__main__":
    with engine.begin() as connection:
        print(seed(connection))
