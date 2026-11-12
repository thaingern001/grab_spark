"""Shared merchant-scoped analytics used by REST and future MCP adapters."""
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.core import settings
from app.errors import AppError
from app.finance import amount, money, rate, FinancialInputs, calculate

BANGKOK = ZoneInfo("Asia/Bangkok")
ZERO = Decimal("0.00")


def validate_range(start: date, end: date) -> None:
    if start > end or (end - start).days > 365:
        raise AppError(400, "invalid_range", "Date range must be ordered and at most 366 days")


def order_lines(conn: Connection, merchant_id: UUID, start: date, end: date):
    validate_range(start, end)
    lower = datetime.combine(start, time.min, BANGKOK).astimezone(timezone.utc)
    upper = datetime.combine(end + timedelta(days=1), time.min, BANGKOK).astimezone(timezone.utc)
    return conn.execute(text("""
        SELECT o.id order_id, o.placed_at, i.menu_item_id, m.name menu_name, i.quantity,
               i.unit_price, i.unit_merchant_discount, i.unit_deduction_amount,
               i.unit_food_cost, i.unit_packaging_cost, i.unit_other_variable_cost
        FROM orders o JOIN order_items i ON (i.merchant_id, i.order_id)=(o.merchant_id,o.id)
        JOIN menu_items m ON (m.merchant_id,m.id)=(i.merchant_id,i.menu_item_id)
        WHERE o.merchant_id=:merchant_id AND o.status='completed'
          AND o.placed_at >= :lower AND o.placed_at < :upper
        ORDER BY o.placed_at, o.id, i.id
    """), {"merchant_id": merchant_id, "lower": lower, "upper": upper}).mappings().all()


def _totals(rows):
    gmv = revenue = contribution = ZERO
    order_ids = set()
    for r in rows:
        q = r["quantity"]
        unit_gmv = r["unit_price"]
        unit_revenue = unit_gmv - r["unit_merchant_discount"] - r["unit_deduction_amount"]
        unit_contribution = unit_revenue - r["unit_food_cost"] - r["unit_packaging_cost"] - r["unit_other_variable_cost"]
        gmv += q * unit_gmv
        revenue += q * unit_revenue
        contribution += q * unit_contribution
        order_ids.add(r["order_id"])
    count = len(order_ids)
    aov = money(gmv / count) if count else None
    return {"gmv": amount(gmv), "merchant_revenue": amount(revenue), "estimated_contribution": amount(contribution), "orders": count, "aov": amount(aov)}


def sales_summary(conn: Connection, merchant_id: UUID, start: date, end: date, include_prior: bool = True):
    rows = order_lines(conn, merchant_id, start, end)
    total = _totals(rows)
    days = (end - start).days + 1
    prior = order_lines(conn, merchant_id, start - timedelta(days=days), start - timedelta(days=1)) if include_prior else []
    return {"from": start.isoformat(), "to": end.isoformat(), **total, "prior_gmv": _totals(prior)["gmv"], "synthetic": True}


def sales_series(conn: Connection, merchant_id: UUID, start: date, end: date, granularity: str):
    rows = order_lines(conn, merchant_id, start, end)
    groups = defaultdict(list)
    for row in rows:
        local = row["placed_at"].astimezone(BANGKOK).date()
        key = local if granularity == "day" else local.replace(day=1)
        groups[key].append(row)
    if granularity == "day":
        keys = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    else:
        keys = []
        year, month = start.year, start.month
        while date(year, month, 1) <= end:
            keys.append(date(year, month, 1))
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    series = []
    for key in keys:
        period_start = max(start, key)
        if granularity == "day":
            period_end = period_start
        else:
            next_month = date(key.year + 1, 1, 1) if key.month == 12 else date(key.year, key.month + 1, 1)
            period_end = min(end, next_month - timedelta(days=1))
        series.append({"from": period_start.isoformat(), "to": period_end.isoformat(), **_totals(groups[key]), "prior_gmv": "0.00", "synthetic": True})
    return series


def menu_performance(conn: Connection, merchant_id: UUID, start: date, end: date, limit: int = 10):
    groups = defaultdict(list)
    for row in order_lines(conn, merchant_id, start, end):
        groups[(row["menu_item_id"], row["menu_name"])].append(row)
    result = []
    for (item_id, name), rows in groups.items():
        total = _totals(rows)
        result.append({"menu_item_id": str(item_id), "name": name, "units": sum(r["quantity"] for r in rows), "gmv": total["gmv"], "estimated_contribution": total["estimated_contribution"]})
    return sorted(result, key=lambda r: (-Decimal(r["gmv"]), r["name"]))[:limit]


def menus(conn: Connection, merchant_id: UUID):
    rows = conn.execute(text("""
        SELECT m.*, c.food_cost, c.packaging_cost, c.other_variable_cost, c.deduction_rate, c.source_kind
        FROM menu_items m LEFT JOIN LATERAL (
          SELECT * FROM menu_cost_assumptions c WHERE c.merchant_id=m.merchant_id AND c.menu_item_id=m.id
          ORDER BY c.effective_from DESC LIMIT 1
        ) c ON true WHERE m.merchant_id=:mid ORDER BY m.name
    """), {"mid": merchant_id}).mappings().all()
    result = []
    for r in rows:
        calc = calculate(FinancialInputs(r["current_price"], r["food_cost"], r["packaging_cost"], r["other_variable_cost"], r["deduction_rate"], ZERO))
        result.append({"id": str(r["id"]), "name": r["name"], "category": r["category"], "current_price": amount(r["current_price"]), "available": r["available"], "food_cost": amount(r["food_cost"]), "packaging_cost": amount(r["packaging_cost"]), "other_variable_cost": amount(r["other_variable_cost"]), "deduction_rate": rate(r["deduction_rate"]), "cost_source": r["source_kind"] or "missing", "estimated_contribution": amount(calc.estimated_contribution)})
    return result


def dashboard(conn: Connection, merchant_id: UUID):
    today = settings.demo_date
    monthly = []
    for offset in range(6, 0, -1):
        year = today.year
        month = today.month - offset
        while month <= 0:
            year -= 1
            month += 12
        first = date(year, month, 1)
        next_month = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        monthly.append(sales_summary(conn, merchant_id, first, next_month - timedelta(days=1), False))
    from app.missions import list_missions
    opportunities = list_missions(conn, merchant_id, "proposed")
    return {"today": sales_summary(conn, merchant_id, today, today, False), "monthly_trend": monthly, "top_items": menu_performance(conn, merchant_id, today - timedelta(days=179), today, 3), "opportunity": opportunities[0] if opportunities else None, "synthetic": True}
