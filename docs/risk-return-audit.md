# One Click risk–return audit and demo profiles

## Financial engine and original scenario audit

`finance.calculate` uses `Decimal` and `ROUND_HALF_UP` to 0.01 THB. Per unit, GMV is listed price; platform deduction is listed price × the fictional 30% rate; merchant revenue is GMV minus the merchant-funded discount and platform deduction; contribution is merchant revenue minus food, packaging and other variable costs. Contribution excludes fixed costs and tax and is not net profit. Historical orders are independent immutable synthetic snapshots.

The seven-day strategy evaluator multiplies unit contribution by estimated units, subtracts ad spend once for Advertising, and compares every result with the same 40 × ฿16.30 = ฿652.00 baseline. Current values are arithmetically consistent: Bundle 38 × ฿24.30 = ฿923.40 (+฿271.40); Discount 44 × ฿11.30 = ฿497.20 (−฿154.80); Advertising 43 × ฿16.30 − ฿100 = ฿600.90 (−฿51.10). The current Discount model treats all 40 existing orders as discounted. The current Bundle model treats its 38 bundles as the entire seven-day sales volume. Neither separately displays retained full-price sales and substitution, so the comparison omits potentially material volume effects.

## Existing risk method and selection

`strategies._risk` is a **prototype illustrative score**, not a validated probability. It weights financial downside against the common baseline 30%, fixed demand uncertainty 25%, fixed assumption uncertainty 20%, fixed operational complexity 15%, and additional spend relative to baseline 10%. Fixed demo dimensions are Bundle (40, 40, 45), Discount (55, 55, 20), and Advertising (70, 60, 25) for demand, assumptions and operations. Each score is clamped to 0–100. The existing selection rule chooses the lowest score among eligible cases, breaking ties Bundle → Discount → Advertising. Eligibility is currently simply complete inputs. This rule and its weights remain unchanged in this phase.

## Previous synthetic profile: 10% discount lift and 3 ad orders

Keep the editable baseline 40 orders, Bundle 38 proposed bundles, ฿5 merchant discount, 10% discount order lift, ฿100 advertising budget, and 3 ad incremental orders. Explicitly model one Bundle replacing one baseline order up to available baseline volume; unconverted baseline orders remain full price. For Discount, use a **fixed illustrative 25% redemption of existing baseline orders** (10 of 40), in addition to 4 incremental discounted orders. This is a deterministic demo assumption, not a Grab benchmark. The rate is not editable in this phase and is disclosed for merchant confirmation in the existing consent step. For Advertising, retain all baseline orders plus 3 incremental orders, with the ฿100 budget deducted once. Ad conversion remains uncertain and the modeled 3 orders are an assumption, not a forecast.

| Scenario | Seven-day contribution | Difference vs ฿652 baseline | Volume and cost interpretation |
| --- | ---: | ---: | --- |
| Bundle | ฿956.00 | +฿304.00 | 38 × ฿24.30 bundles + 2 × ฿16.30 retained orders; 38 baseline orders substituted |
| Discount | ฿647.20 | −฿4.80 | 30 × ฿16.30 retained orders + 14 × ฿11.30 discounted orders; 10 existing orders cannibalized and 4 incremental orders |
| Advertising | ฿600.90 | −฿51.10 | 43 × ฿16.30 orders − ฿100 advertising cost; 3 incremental orders |

These results deliberately preserve negative differences where the assumptions produce them. Discount turns positive only with at least 5 incremental discounted orders at this redemption rate; Advertising requires at least 7 incremental orders at this budget. Such sensitivity is illustrative and must not be framed as a prediction. The Bundle remains the lowest-risk recommendation under the current score calculation. The alternatives can have higher returns under different demand assumptions but bring discount cannibalization or upfront spend uncertainty.

## Planned changes and impact

Revise only the seven-day evaluator and add explicit assumption/provenance metadata and volume breakdown to its existing API response. Keep current request fields, approval consent, selection rule, risk formula, and mission state machine. The optional Strategy Details will expose blended totals and assumption provenance; the Popup keeps its approved structure and labels the incremental contribution difference clearly. The approved evaluation snapshot already freezes scenario and evaluation revisions; simulation reads that snapshot, so new approvals will use the revised totals consistently. Existing approved snapshots and the historical completed example retain their original version and amounts. Resetting the disposable preview account re-seeds its deterministic data; no historical orders are rewritten.

Future proposal for separate review: eligibility checks followed by risk ranking. It is **not implemented** here.

## Previous risk–return refinement

The evaluator now reports the 40-order shared baseline, all three modeled totals, explicit retained/substituted/incremental order counts, seven-day platform deductions, merchant discounts, variable costs, and advertising spend. Strategy input assumptions are seeded in `mission_strategy_inputs` and returned with name, value, unit, synthetic provenance, explanation, merchant confirmation requirement, and editability. The 25% existing-order discount redemption is fixed, disclosed, and illustrative. The optional Strategy Details shows these figures and the existing scenario price/cost sources. The recommendation sheet layout, consent checkboxes, and approval action are unchanged.

New approvals snapshot `multi-strategy-v2` values and simulation reads that immutable snapshot. Strategy reads after approval also return the stored snapshot. Earlier snapshots retain their original model version and totals; the response schema tolerates their absent v2 breakdown fields. The existing risk score formula and lowest-risk eligible selection rule remain unchanged. Under the previous 10%/3-order seeded assumptions, scores were Bundle 25/100, Discount 29/100, Advertising 37/100; they are illustrative modeled scores, not validated probabilities. Higher advertising conversions can make Advertising's modeled return exceed Bundle's while its risk score remains higher, illustrating the trade-off without changing the selection policy.

Backend tests cover financial identities, rounding, discount treatment, advertising spend deducted once, positive/negative/zero differences, higher-return/higher-risk cases, deterministic repeated reads, seeded inputs, revision locking, approved snapshot/result consistency, and merchant isolation. The responsive frontend journey covers 320, 375, 390, and 430 px, optional details, two consents, approval, simulation, review, and demo reset. Screenshots: `docs/screenshots/strategy/multi-popup-390.png`, `multi-detail-390.png`, `multi-result-390.png`.

Checks at that revision: backend `pytest -q` **29 passed** (one upstream Starlette deprecation warning); frontend `npm run build` passed; the four-width Playwright journey passed and left the disposable preview reset to its initial recommendation. The API preview is on port 8001 and frontend preview on port 3001.

Remaining limitations: volume response and 25% redemption are synthetic, not experimentally calibrated. Risk dimensions other than financial downside and spend are fixed illustrative values. The current selection policy has no separate financial eligibility floor. A production methodology and any change to that policy require separate review.

## Approved Moderate synthetic demonstration profile

The merchant approved changing only the seeded seven-day demand inputs: `discount_demand_lift` from `0.1000` to `0.2500` and `advertising_incremental_orders` from `3` to `12`. `DEFAULTS` is the single source for both evaluator fallback and `mission_strategy_inputs` seeding. Baseline 40 orders, all per-unit prices and costs, 38 substituted Bundle orders, the fixed illustrative 25% redemption of existing orders, ฿5 merchant-funded discount per redeemed order, and ฿100 advertising spend remain unchanged. The financial engine, risk weights, and lowest-risk eligible selection rule are unchanged.

| Scenario | Retained baseline orders | Substituted existing orders | Incremental orders | Seven-day contribution | Difference vs ฿652.00 baseline | Illustrative risk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bundle | 2 | 38 | 0 | 38 × ฿24.30 + 2 × ฿16.30 = **฿956.00** | **+฿304.00** | 25/100 |
| Discount | 30 | 10 | 10 | 30 × ฿16.30 + 20 × ฿11.30 = **฿715.00** | **+฿63.00** | 29/100 |
| Advertising | 40 | 0 | 12 | 52 × ฿16.30 − ฿100.00 = **฿747.60** | **+฿95.60** | 35/100 |

Discount funds ฿5 on each of 20 discounted orders (฿100 total), already deducted in their ฿11.30 unit contribution. Advertising spend is deducted once from the seven-day total. Incremental contribution is always strategy contribution minus the shared baseline. GMV, merchant revenue, platform deductions, and variable costs remain separate; contribution is **not net profit**.

The 25% discount response and 12 attributed advertising orders are deterministic synthetic assumptions, not observed demand, validated forecasts, or Grab benchmarks. The optional details and popup disclose this. The risk score recalculates via the existing illustrative function: Advertising falls from 37 to 35 because modeled financial downside disappears, **not** because the conversion assumption has become more reliable. The fixed demand and assumption uncertainty dimensions do not rise with the larger volume assumption. Bundle still has the highest modeled incremental contribution and lowest modeled risk, so this profile demonstrates comparison and approval, **not** an optimal risk–return engine.

Only new proposed missions seeded after this change receive Moderate inputs. Previously approved immutable snapshots and their simulation outcomes retain their original values and model version. Resetting the disposable local preview re-seeds the Moderate profile; it does not alter the main database or historical order snapshots.

### Moderate profile verification

The preview backend returned the table above through the existing strategy endpoint. `pytest -q` passed **30 tests** (one upstream Starlette deprecation warning), including a lower-demand negative-impact case. `npm run build` passed. The four-width Playwright journey passed at 320, 375, 390, and 430 px, including optional details, two explicit consents, approval, simulation, review, and account reset. A separate unedited Moderate journey verified the seeded Popup values and scores, approved Bundle, checked the Results page against the API outcome (`652.00` baseline, `956.00` trial, `multi-strategy-v2`), then reset the disposable preview to its initial recommendation.

Current 390 px screenshots: `docs/screenshots/strategy/moderate-popup-390.png`, `moderate-detail-390.png`, and `moderate-result-390.png`. The latter displays the unedited seeded approval; the earlier general journey screenshot may show merchant-edited costs and bundle volume.
