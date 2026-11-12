"""Authoritative per-unit contribution calculation, never net profit."""
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def money(value: Decimal) -> Decimal:
    if not isinstance(value, Decimal):
        raise TypeError("money requires Decimal")
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class FinancialInputs:
    unit_price: Decimal
    food_cost: Decimal | None
    packaging_cost: Decimal | None
    other_variable_cost: Decimal | None
    deduction_rate: Decimal | None
    merchant_discount: Decimal | None


@dataclass(frozen=True)
class FinancialResult:
    gmv: Decimal
    deduction_amount: Decimal | None
    merchant_revenue: Decimal | None
    variable_cost: Decimal | None
    estimated_contribution: Decimal | None


def calculate(values: FinancialInputs) -> FinancialResult:
    if values.unit_price < 0:
        raise ValueError("unit_price must be nonnegative")
    components = (values.food_cost, values.packaging_cost, values.other_variable_cost)
    if any(x is not None and x < 0 for x in components):
        raise ValueError("costs must be nonnegative")
    if values.deduction_rate is not None and not ZERO <= values.deduction_rate <= Decimal("1"):
        raise ValueError("deduction_rate must be between 0 and 1")
    if values.merchant_discount is not None and not ZERO <= values.merchant_discount <= values.unit_price:
        raise ValueError("merchant_discount must be between 0 and unit_price")
    gmv = money(values.unit_price)
    deduction = money(gmv * values.deduction_rate) if values.deduction_rate is not None else None
    revenue = money(gmv - values.merchant_discount - deduction) if values.merchant_discount is not None and deduction is not None else None
    variable_cost = money(sum(components, ZERO)) if all(x is not None for x in components) else None
    contribution = money(revenue - variable_cost) if revenue is not None and variable_cost is not None else None
    return FinancialResult(gmv, deduction, revenue, variable_cost, contribution)


def amount(value: Decimal | None) -> str | None:
    return format(money(value), ".2f") if value is not None else None


def rate(value: Decimal | None) -> str | None:
    return format(value, ".4f") if value is not None else None
