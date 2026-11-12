# GrabSpark C1 — Final UX polish

The C1 pass keeps the existing One Click journey, backend contracts, synthetic assumptions, and financial engine. The initial Recommendation sheet opens at scroll position 0; the heading was present before this pass. Its kicker now names the AI growth recommendation, while the recommended strategy and backend-driven difference remain in the first viewport.

## Before and after at 390px

All screenshots are from the running application at a 390 × 844 CSS viewport, captured at 2× resolution without browser chrome. The disposable Westrong Kitchen preview was reset between captures.

| Screen | Before | After |
| --- | --- | --- |
| Initial recommendation | [Before](screenshots/c1/before/01-recommendation.png) | [After](screenshots/c1/after/01-recommendation.png) |
| Three-strategy comparison | [Before](screenshots/c1/before/02-comparison.png) | [After](screenshots/c1/after/02-comparison.png) |
| Consent checked and CTA ready | [Before](screenshots/c1/before/03-approval-ready.png) | [After](screenshots/c1/after/03-approval-ready.png) |
| Simulated result | [Before](screenshots/c1/before/04-simulated-results.png) | [After](screenshots/c1/after/04-simulated-results.png) |
| Reviewed result | [Before](screenshots/c1/before/05-result-reviewed.png) | [After](screenshots/c1/after/05-result-reviewed.png) |

The optional [Bundle Details capture](screenshots/c1/after/bundle-details.png) shows the clarified order-count relationship.

## Changes

- Moved the two secondary recommendation actions into the sheet's scrollable body. The sticky footer retains the simulation disclosure, two full-width consent rows, and approval CTA. The secondary buttons each have at least a 44px touch target.
- Replaced the initial kicker with “One Click · AI growth recommendation” and shortened its supporting sentence. The title still identifies the recommended backend strategy.
- Added a backend-driven modeled contribution takeaway above the existing result explanation. It does not claim a strategy is strongest or describe simulated output as actual sales.
- Clarified the volume breakdown in Bundle Details using the backend's retained, strategy-affected, substituted, and assumed extra order counts.
- Preserved the existing “Simulated result ready” and “Result reviewed” badges before and after review. The reviewed state survives reload.

## Financial consistency

The preview backend returned 40 baseline orders at ฿16.30 contribution per order, totaling **฿652.00**. For Bundle, 2 baseline orders remain and 38 existing orders are modeled as Bundle orders; no extra orders are assumed. Thus **2 + 38 = 40 modeled orders** and **2 × ฿16.30 + 38 × ฿24.30 = ฿956.00**. The difference is **+฿304.00**. The backend's illustrative risk score is **25/100**. The order categories are mutually consistent: retained baseline orders plus strategy-affected orders equal total modeled orders; existing affected orders plus assumed extra orders equal strategy-affected orders. No financial or risk formula changed.

## Verification

- `npm run build` passed.
- `node scripts/multi-strategy-e2e.mjs` passed at 320, 375, 390, and 430px, including approval, simulation, reviewed state, and reset.
- `node scripts/popup-frame-verify.mjs` passed at all four mobile widths, including overflow, figure clipping, footer overlap, and secondary action touch targets.
- `node scripts/readability-results-responsive.mjs` passed at all four mobile widths.
- `node scripts/english-ui-verify.mjs` passed across seven app sections and the popup.
- Backend `pytest -q`: **30 passed**, with one existing Starlette/httpx deprecation warning.
- `node scripts/c1-capture.mjs after` verified initial scroll position 0, details/compare return, two checked consents, expected result values, reviewed persistence, and reset.

## Remaining limitation

The initial compact sheet shows the recommended card and part of the alternatives at 390px. All three cards are reachable by scrolling the sheet body; the Comparison view displays all three together. The fixed consent footer remains visible and never covers the last card when scrolled into view. At 320px, the merchant needs more vertical scrolling.
