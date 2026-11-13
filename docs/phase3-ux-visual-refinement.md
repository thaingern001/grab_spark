# One Click UX and concept visual refinement

## What changed

The merchant Home opportunity now says three strategies were compared, identifies the lowest-risk recommendation, and shows its backend-provided seven-day contribution difference with one CTA. The recommendation bottom sheet places the recommended strategy first with a compact food concept preview. Discount and Advertising have smaller previews. Every preview is labeled **AI-generated concept preview** and says it is not a real product or published campaign. Financial figures, risk scores, approval, and consent remain HTML sourced from existing APIs; no numbers are embedded in the images.

The sheet keeps all three strategies visible at 390 × 844 CSS px and supports vertical scrolling for rationale and material assumptions. The sticky footer preserves both consent controls and one approval action. Details are optional and include an expandable larger image plus the existing financial, risk, and provenance disclosure. Results now show baseline and approved seven-day contribution with bars on a common scale, model-driven volume difference, uncertainty, next action, and the existing backend review transition. Reviewed status stays on the same page.

## Reused and changed components

Reused: merchant shell, Home layout, mission/scenario/strategy APIs, backend revision and idempotency checks, financial and risk calculations, mission tracking lifecycle, Next.js Image optimization.

Changed: `app/page.tsx` Home opportunity copy and metrics; `components/home-opportunity-popup.tsx` strategy hierarchy and preview placement; `components/mission-tracking.tsx` results comparison and learning; `app/strategy.css` compact mobile layout; `scripts/multi-strategy-e2e.mjs` full journey checks. Added `components/strategy-visual.tsx`, a strategy-ID-to-local-asset mapping with optional source override for a future provider, and a visual fallback on load failure. No image generation service is called during approval.

## Image assets and prompts

The built-in imagegen tool generated three fictional concept assets stored under `frontend/public/strategy-previews/`:

| Strategy | Local asset | Prompt direction |
| --- | --- | --- |
| Bundle | `bundle-concept.png` | Thai chicken rice, sauce, cucumber and iced Thai tea as a premium meal-and-drink product photograph on a pale mint tabletop |
| Discount | `discount-concept.png` | Thai chicken rice with a blank lilac coupon and purple promo accents, photographed for a promotional offer concept |
| Advertising | `advertising-concept.png` | Thai chicken rice and iced drink with blue advertising accents and a megaphone-inspired graphic |

All prompts excluded text, prices, percentages, brand marks, watermarks, and UI. The originals remain in Codex generated images; workspace copies are served through Next.js Image at responsive sizes and quality 75. The concept mappings are deterministic and separate from financial data.

## Verification

- Backend: 26 tests passed; one existing Starlette/httpx deprecation warning.
- Frontend: production build and TypeScript passed.
- Playwright: 320, 375, 390, 430 px; three loaded previews and visible labels; no horizontal overflow; fallback for unavailable images; comparison and expandable detail; popup dismissal, Home reopening and Escape; consent gating and preservation through optional details; cost and assumption edits through backend; one approval request; processing, persisted result, review transition, and return Home.
- Screenshots: [Home](screenshots/strategy/visual-home-390.png), [popup](screenshots/strategy/visual-popup-390.png), [320 px popup](screenshots/strategy/visual-popup-320.png), [details](screenshots/strategy/multi-detail-390.png), [result and actual status](screenshots/strategy/multi-result-390.png), [MAI mission chat](screenshots/strategy/multi-mission-agent-390.png), [reviewed](screenshots/strategy/visual-reviewed-390.png).

## Limits

Images are AI-generated concepts, not actual Westrong Kitchen products or published creatives. Strategy values remain synthetic estimates. Bars visualize backend amounts but do not represent observed performance. The prototype does not create a real promotion, run image generation during approval, or connect to production Grab systems.
