# Phase 3 One Click multi-strategy completion report

## Delivered

- Home recommendation opens a compact GrabMerchant-inspired bottom sheet. Bundle, Discount, and Advertising show backend-calculated seven-day contribution differences, risk scores, and optional details. The lowest modeled risk is highlighted; the reference artwork's example figures were not copied.
- Editable baseline/Bundle costs use the existing scenario revision endpoint. Editable volume, discount, demand, and advertising assumptions use the new revisioned strategy endpoint. Each successful edit returns fresh backend calculations and clears prior consent.
- One approval action from the sheet records explicit material-input and simulation confirmations, the current scenario/evaluation revisions, the selected lowest-risk strategy, an idempotency key, and an immutable evaluation snapshot. There is no second approval page.
- Mission processing calls the backend simulation endpoint, retrieves the persisted outcome, and shows selected strategy, risk, baseline/trial contribution, difference, assumptions, learning, and limitations. Reload and safe retry use the stored result. No live promotion or advertising is published.
- Existing merchant scope, shared Decimal financial engine, mission events, revision conflict handling, and legacy completed mission behavior remain in place. Migration `0002_multi_strategy` is additive; the historical main database was not reset.

## Verification

- Backend: 26 automated tests passed. New tests cover three financial models, risk boundaries and tie/eligibility order, assumption revision and recalculation, stale approval, consent and selection, merchant isolation, immutable approved snapshot, idempotent approval, deterministic simulation, rollback on processing failure, and safe retry.
- Frontend production build and TypeScript checks passed.
- Playwright journey passed at 320, 375, 390, and 430 CSS px without horizontal document or bottom-sheet scroll. It verified all three strategies, optional detail/compare, dismissal persistence, backend assumption edit and recalculation, disabled approval before consent, one approval, backend simulation, and result persistence after reload.
- Screenshots: [recommendation](screenshots/strategy/multi-popup-390.png), [comparison](screenshots/strategy/multi-compare-390.png), [detail](screenshots/strategy/multi-detail-390.png), [result and actual status](screenshots/strategy/multi-result-390.png), [MAI mission chat](screenshots/strategy/multi-mission-agent-390.png).

## Known limits

- Westrong Kitchen, order volumes, demand response, spend, and scoring constants are synthetic. Scores are transparent indicators, not probabilities or validated merchant performance predictions.
- The seven-day result is generated immediately from approved assumptions. It is not a seven-day observation, and contribution excludes fixed costs and tax.
- The prototype recommends by lowest modeled risk and its primary approval follows that recommendation. Alternative strategies are available for comparison, not for direct approval in this flow.
