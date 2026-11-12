from decimal import Decimal
import pytest

from app.finance import FinancialInputs, calculate


def test_reference_contributions():
    baseline = calculate(FinancialInputs(Decimal("79"), Decimal("35"), Decimal("4"), Decimal("0"), Decimal("0.30"), Decimal("0")))
    bundle = calculate(FinancialInputs(Decimal("99"), Decimal("40"), Decimal("5"), Decimal("0"), Decimal("0.30"), Decimal("0")))
    assert baseline.estimated_contribution == Decimal("16.30")
    assert bundle.estimated_contribution == Decimal("24.30")
    assert bundle.estimated_contribution - baseline.estimated_contribution == Decimal("8.00")


def test_rounding_and_discount_once():
    result = calculate(FinancialInputs(Decimal("10.05"), Decimal("1"), Decimal("0"), Decimal("0"), Decimal("0.25"), Decimal("2")))
    assert result.deduction_amount == Decimal("2.51")
    assert result.merchant_revenue == Decimal("5.54")
    assert result.estimated_contribution == Decimal("4.54")


def test_zero_and_missing_inputs():
    zero = calculate(FinancialInputs(*(Decimal("0") for _ in range(6))))
    assert zero.estimated_contribution == Decimal("0.00")
    missing = calculate(FinancialInputs(Decimal("79"), None, Decimal("4"), Decimal("0"), Decimal("0.3"), Decimal("0")))
    assert missing.estimated_contribution is None


def test_invalid_rate_and_float():
    with pytest.raises(ValueError):
        calculate(FinancialInputs(Decimal("10"), Decimal("1"), Decimal("1"), Decimal("0"), Decimal("1.01"), Decimal("0")))
    with pytest.raises(TypeError):
        calculate(FinancialInputs(10.0, Decimal("1"), Decimal("1"), Decimal("0"), Decimal("0.3"), Decimal("0")))
