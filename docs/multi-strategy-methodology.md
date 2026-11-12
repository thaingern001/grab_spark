# One Click multi-strategy model v1 (synthetic prototype)

This document specifies the backend extension before migration. It is decision support for fictional merchant data, not a forecast validated against Grab performance. All money uses `Decimal` and half-up cent rounding through the existing `app.finance.calculate` service. Contribution excludes fixed expenses and tax; it is never called net profit.

## Proposed additive schema

Migration `0002_multi_strategy` adds two merchant-scoped tables without changing old scenario or outcome rows:

- `mission_strategy_inputs`: one mutable input set per proposed mission, with an independent `evaluation_revision`; baseline seven-day units, bundle units, merchant-funded discount, discount demand-lift assumption, advertising spend, and advertising incremental-order assumption. Writes require an owner, current revision, and proposed mission status.
- `mission_strategy_approvals`: one immutable approved strategy snapshot per mission, including scenario revision, evaluation revision, selected strategy, model version, all evaluated financial/risk values, and assumptions. This is inserted in the same transaction as the existing approval event and idempotency record. Old approved missions have no row and keep their existing bundle simulation behavior.

Both tables use `(merchant_id, mission_id)` foreign keys. The approval table rejects update and delete. The new tables are included in disposable preview reset through `TRUNCATE merchants CASCADE`; completed mission history is not modified in place.

## Seven-day assumptions and calculations

Default synthetic assumptions for Westrong Kitchen: baseline 40 units, Bundle 38 units, Discount merchant-funded discount ฿5 per order and +10% demand response, Advertising spend ฿100 and +3 incremental orders. These are editable inputs, not observed behavior. The default 30% platform deduction remains a fictional pre-discount assumption from the approved scenario and is not a Grab fee.

Baseline uses the existing baseline scenario's per-unit financial result × baseline units. Bundle uses the existing proposed scenario's per-unit result × Bundle units. Discount applies the extra merchant-funded discount to the baseline scenario through `calculate`, preserving the pre-discount deduction basis; units are baseline units × (1 + assumed demand lift), rounded half-up to a whole order. Advertising uses baseline per-unit result for baseline units + assumed incremental orders, then subtracts advertising spend **once** from aggregate contribution. GMV and merchant revenue exclude advertising spend; contribution includes it. Seven-day difference is strategy total contribution − baseline total contribution. These are scenario illustrations, not guaranteed incremental sales or actual observed results.

## Risk scoring and recommendation

Risk is a synthetic 0–100 indicator, not a probability. Every strategy uses the same dimensions and weights:

| Dimension | Weight | Normalization |
| --- | ---: | --- |
| Financial downside exposure | 30% | `max(0, baseline total − strategy total) / max(abs(baseline total), ฿1) × 100`, capped at 100 |
| Demand uncertainty | 25% | Explicit model constant: Bundle 40, Discount 55, Advertising 70 |
| Assumption uncertainty | 20% | Explicit model constant: Bundle 40, Discount 55, Advertising 60 |
| Operational complexity | 15% | Explicit model constant: Bundle 45, Discount 20, Advertising 25 |
| Additional spend exposure | 10% | Bundle 0; Discount = discount × estimated orders; Advertising = spend. Divide by `max(abs(baseline total), ฿1)`, cap at 100 |

The weighted sum is rounded half-up to the nearest integer, bounded to 0–100. Constants are disclosed as subjective synthetic proxies and are not inferred by an LLM. An eligible strategy requires complete nonnegative inputs and a complete baseline/proposed scenario. The lowest score wins; ties break by stable order Bundle, Discount, Advertising. A score is not a validated risk category. Any change to scenario or strategy inputs must re-evaluate all three and create a new reviewed revision before approval.

## Approved simulation

Approval records the selected lowest-risk eligible strategy and immutable model snapshot. Simulation reads that snapshot and generates aggregate baseline/trial outcomes immediately through backend mission transitions. It does not claim that seven real days elapsed or that a live campaign was published. Retry after a completed simulation returns the persisted outcome; failures before commit leave the mission approved and safe to retry.
