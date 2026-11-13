# GrabSpark 2C Interactive Judge Demo

## Scope delivered

- A standalone Next.js judge experience at `/` when built with `npm run build:judge`. Its opening screen uses the existing GrabMerchant-inspired Home rhythm: store context, today's operations, One Click opportunity, store shortcuts, sales trend, and popular menu items. The original FastAPI/PostgreSQL app remains available in normal local mode.
- C1: discover the prepared Home recommendation, compare three modeled strategies, require both consents, confirm one selected strategy, and open its prepared simulated result directly. The result separates a green modeled outcome from a gray actual-activity track showing Day 1 pending and 0/7 live days. Merchants can open an in-app MAI demo chat scoped to the approved mission, review, refresh, and reset.
- C2: choose ChatGPT or Claude as a *simulated client*, grant explicit read-only scopes, ask the prepared question, see only authorized fixture data and a permission-gated visual chart, review a draft without publishing, remove permissions, revoke all access, refresh, and reset.
- Shared 2C navigation and explicit unofficial/synthetic/simulation disclosures.

## Fixture provenance and consistency

[`frontend/demo/fixtures/snapshot.json`](../frontend/demo/fixtures/snapshot.json) was exported from `backend/app/strategies.evaluate` and `backend/app/analytics.dashboard` using the deterministic Westrong Kitchen seed on 2026-11-07. All values below match the existing financial backend response; no demo UI recalculates them.

| Strategy | Modeled 7-day contribution | Difference from ฿652.00 baseline | Illustrative risk | Modeled orders |
| --- | ---: | ---: | ---: | ---: |
| Bundle | ฿956.00 | +฿304.00 | 25/100 | 40 |
| Discount | ฿715.00 | +฿63.00 | 29/100 | 50 |
| Advertising | ฿747.60 | +฿95.60 | 35/100 | 52 |

The independent full-stack backend now accepts an eligible merchant-selected strategy rather than requiring the lowest-risk recommendation; immutable approved snapshots, consent checks, and recommendation policy remain. Backend tests verify Discount and Advertising approval/outcomes, and the existing Bundle snapshot test remains.

## Actual app screenshots

All captures use a 390 × 844 CSS viewport at 2× pixel density. They come from the running production judge build without browser chrome.

| Journey | Screenshots |
| --- | --- |
| C1 | [Merchant Home](screenshots/judge-demo/00-merchant-home.png) · [Recommendation bottom sheet](screenshots/judge-demo/01-c1-recommendation.png) · [Comparison](screenshots/judge-demo/02-c1-comparison.png) · [Strategy detail](screenshots/judge-demo/02b-c1-strategy-detail.png) · [Financial breakdown](screenshots/judge-demo/02c-c1-financial-breakdown.png) · [Consent ready](screenshots/judge-demo/03-c1-approval-ready.png) · [Simulated result and actual status](screenshots/judge-demo/04-c1-results.png) · [MAI mission chat](screenshots/judge-demo/04b-c1-mission-agent.png) · [Reviewed](screenshots/judge-demo/05-c1-reviewed.png) |
| C2 | [Permission selection](screenshots/judge-demo/06-c2-permissions.png) · [Synthetic sales chart](screenshots/judge-demo/15-c2-sales-chart.png) · [Modeled contribution chart](screenshots/judge-demo/14-c1-outcome-chart.png) · [Restricted workspace](screenshots/judge-demo/07-c2-workspace-limited.png) · [Campaign draft](screenshots/judge-demo/08-c2-workspace-draft.png) · [Concept reviewed](screenshots/judge-demo/09-c2-concept-reviewed.png) · [Access revoked](screenshots/judge-demo/10-c2-access-revoked.png) |

## Verification

- Normal `npm run build`: passed.
- Standalone `npm run build:judge`: passed.
- Backend `pytest -q`: **31 passed**, with one existing Starlette/httpx deprecation warning.
- `node scripts/judge-demo-e2e.mjs`: passed all three C1 outcomes and consent gating; C2 no-scope block, authorized and unauthorized data, explicit permission updates, immediate scope removal, revocation, reset, persistence; no backend requests, missing image assets, browser errors, or horizontal overflow. Layout checked at 320, 375, 390, 430, 768, 1024, and 1440px.
- Existing full-stack popup: selecting Discount changed the CTA; opening Bundle details preserved the Discount selection. `node scripts/popup-frame-verify.mjs` passed at 320, 375, 390, and 430px.
- The judge build's `/api/merchant/*` route returns 404, preventing calls to the local backend bridge.

## Deployment and limits

[`frontend/vercel.json`](../frontend/vercel.json) configures the judge build. Set the Vercel project Root Directory to `frontend`. No FastAPI, PostgreSQL, OAuth, MCP transport, or AI model service is needed for the judge journey. Vercel CLI deployment has **not** occurred: `vercel whoami` returned “No existing credentials found.” A public URL requires Vercel login and a project link.

The judge fixture is fixed and per-tab session state is browser-local. It is suitable for independent synthetic exploration, not for real merchant data or durable cross-device accounts. The simulated C2 draft contains no numerical forecast and never executes a campaign. The original backend-driven app retains editable financial inputs; the standalone judge experience deliberately uses the verified fixed snapshot.

The C1 MAI mission chat uses scripted, mission-scoped demo replies rather than a live model. No real trial is launched, so the actual-activity track cannot advance or show observed performance in this prototype.
The C2 chart shows six months of synthetic GMV only when Sales Data permission is granted. With Mission Outcomes permission and a reviewed C1 result, it instead compares the approved modeled contribution against baseline. These are fixture values, not a calculated ROI or a forecast.
