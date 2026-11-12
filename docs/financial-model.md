# Financial model and provenance

All authoritative money uses PostgreSQL `numeric(12,2)` and Python `Decimal`; deduction rates use `numeric(7,4)` (e.g. `0.3000`). Round half up to satang on each deduction amount, then subtract monetary components. API money values are decimal strings. No binary floating point is used for persisted totals or service calculations.

For one item or scenario unit:

```text
GMV = selling_price
merchant_funded_discount = explicit THB amount, constrained 0..selling_price
platform_deduction = round_half_up(GMV × deduction_rate, 0.01)
merchant_revenue = GMV − merchant_funded_discount − platform_deduction
variable_cost = food_cost + packaging_cost + other_variable_cost
estimated_contribution = merchant_revenue − variable_cost
```

The **deduction base is pre-discount GMV** for this prototype. The 30% rate is synthetic and is not an official Grab commission. If real terms differ, the model must change before any real-world use. Discounts are subtracted once and are not folded into price or deduction. Tax, delivery fees, advertising, refunds, fixed costs, and customer-funded discounts are outside v1. Order snapshots capture modeled components at order time; current menu or assumption edits never rewrite history. Analytics sum stored order-line snapshots, then compute AOV as summed GMV divided by completed order count. Order-level contribution is sum of line contributions; an order with multiple lines counts once for AOV.

| Illustrative unit | Price | Deduction (30%) | Food + packaging | Discount | Merchant revenue | Estimated contribution |
|---|---:|---:|---:|---:|---:|---:|
| Chicken rice baseline | ฿79.00 | ฿23.70 | ฿39.00 | ฿0.00 | ฿55.30 | ฿16.30 |
| Chicken rice + drink bundle | ฿99.00 | ฿29.70 | ฿45.00 | ฿0.00 | ฿69.30 | ฿24.30 |
| Difference per unit | +฿20.00 | +฿6.00 | +฿6.00 | — | +฿14.00 | **+฿8.00** |

This is an **estimated contribution per bundle sold**, not overall profit or guaranteed uplift. The proposed bundle can replace a chicken-rice order rather than add an order. Display a substitution/volume caveat next to the comparison.

## Provenance

Each scenario input stores `source_kind`: `synthetic_history`, `merchant_confirmed`, or `assumption`; a source note and confirmation timestamp accompany confirmed values. The same confirmation rule applies to menu assumptions and order snapshots. Historical order lines are `synthetic_history` in the seed. The scenario initially uses assumed costs and deductions. Saving changed values creates a new, unconfirmed revision; unchanged confirmed inputs may retain their source. The merchant explicitly confirms all material values in the review and the approval transaction stamps `merchant_confirmed` metadata before approval. A missing cost, deduction rate, or discount yields `null` contribution and blocks approval; it never becomes zero implicitly. The outcome uses `simulated` provenance and a seed version.

## Outcome comparison

Persist baseline period and trial period, eligible unit counts, GMV, merchant revenue, and contribution for each arm. The simulated trial generator uses a fixed seed and an explicit rules version. Show both **per-unit contribution** and **total contribution under simulated volumes**. Explain that total change combines volume and mix effects; it cannot be attributed causally to the proposed mission from synthetic data.
# Multi-strategy seven-day extension

See [multi-strategy-methodology.md](multi-strategy-methodology.md) for the editable synthetic volume and response assumptions, precise Bundle/Discount/Advertising equations, Decimal rounding, weighted risk dimensions, eligibility, and tie-breaking. The backend returns seven-day **contribution**, not net profit. The existing per-unit Bundle calculation remains unchanged; Discount applies merchant-funded discount through the same financial engine, and Advertising subtracts campaign spend once from the aggregate contribution. Values in design references are illustrative and are not used as financial inputs.
