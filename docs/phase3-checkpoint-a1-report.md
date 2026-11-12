# Phase 3 Checkpoint A.1 — GrabMerchant-inspired UI review

The follow-up [Thai merchant-app fidelity pass](phase3-fidelity-pass.md) further changed the live UI and refreshed the `after/` screenshots. The Checkpoint A.1 source and tests remain part of the visual foundation.

## Outcome

The existing merchant frontend now uses a compact mobile operations layout. Store context, task shortcuts, today's sales, and the One Click decision appear within the first scroll. Orders, Menu, Insights, AI, and the mission review share the same restrained visual system. The backend, financial calculations, persisted mission logic, and seeded figures were unchanged. This is an unofficial concept, not a claim of exact Grab UI fidelity.

The [visual gap analysis](phase3-checkpoint-a1-gap-analysis.md) records the baseline review and reference comparison. Grab's [merchant handbook](https://hodor-assets.grab.com/attachments/merchant/en-ph/articles/22150/rc-upload-1714107664018-2-GrabMerchant%20Handbook.pdf) shows today's highlights and task shortcuts on Home; its Orders and Menu examples use compact task screens. Grab's [Insights guide](https://help.grab.com/merchant/en-my/4414717693209) describes sales and menu performance as merchant operations information. The supplied screenshots informed density, grouping, green emphasis, and navigation rhythm. No proprietary artwork or screenshots were used in the UI.

## Before and after

| Screen | Before | After |
| --- | --- | --- |
| Home | Large branded header, separate cards, task list below the fold | Store identity in header, four direct shortcuts, compact green sales summary, actionable One Click card |
| Orders | Oversized order count and long limitation card | Today/7-day tabs, two-column snapshot, AOV/contribution rows, real sales trend |
| Menu | Explanation before menu content | Category sections and compact rows with price, availability, and estimated contribution |
| Insights | Generic performance dashboard | Period tabs, consolidated GMV/orders/AOV, trend, contribution, and menu ranking |
| AI | Marketing introduction before the action | Opportunities and Mission Activity immediately visible |
| One Click Review | Discovery card without financial comparison | Baseline/proposed comparison and expandable assumptions on the first decision screen; existing edit and approval safeguards retained |

The baseline captures used the existing main demo after its mission had been completed. The final captures use an isolated, freshly seeded preview so the proposed mission can be inspected. Compare layout and hierarchy rather than mission status between those image sets.

## Design tokens and reusable structure

The Checkpoint A.1 style layer is [checkpoint-a1.css](../frontend/app/checkpoint-a1.css). The primary action green is `#008444` (approximately 4.79:1 against white), with dark green `#007b3b`, pale green `#e7f6eb`, canvas `#f7f8f7`, and divider `#e4e9e5`. Headers, rows, tabs, and cards use tighter spacing, 8–12 px corner radii, subtle borders, and limited shadow.

[AppShell](../frontend/components/app-shell.tsx) provides the store identity, accessible five-tab navigation, and unobtrusive disclosure. [FinancialHero](../frontend/components/financial-hero.tsx), [SalesBars](../frontend/components/sales-bars.tsx), [TrendBars](../frontend/components/trend-bars.tsx), [MissionList](../frontend/components/mission-list.tsx), and the existing error state remain shared. Server pages still use the typed [API client](../frontend/lib/api.ts); the [mission journey](../frontend/components/mission-journey.tsx) keeps the current revision, cost validation, and explicit simulated-trial approval behavior.

## 390 × 844 screenshots

| Screen | Before | After |
| --- | --- | --- |
| Home | [PNG](screenshots/checkpoint-a1/before/home.png) | [PNG](screenshots/checkpoint-a1/after/home.png) |
| Orders | [PNG](screenshots/checkpoint-a1/before/orders.png) | [PNG](screenshots/checkpoint-a1/after/orders.png) |
| Menu | [PNG](screenshots/checkpoint-a1/before/menu.png) | [PNG](screenshots/checkpoint-a1/after/menu.png) |
| Insights | [PNG](screenshots/checkpoint-a1/before/insights.png) | [PNG](screenshots/checkpoint-a1/after/insights.png) |
| AI | [PNG](screenshots/checkpoint-a1/before/ai.png) | [PNG](screenshots/checkpoint-a1/after/ai.png) |
| One Click Review | [PNG](screenshots/checkpoint-a1/before/review.png) | [PNG](screenshots/checkpoint-a1/after/review.png) |

The [320 px review](screenshots/checkpoint-a1/after/review-320.png) and [430 px Home](screenshots/checkpoint-a1/after/home-430.png) are also captured.

## Verification

- `npm run build` passed TypeScript and production compilation.
- `node scripts/checkpoint-a1-verify.mjs` passed at 320, 375, 390, and 430 CSS pixels across all six screens. It checked navigation, backend-provided `฿16.30` / `฿24.30` / `+฿8.00`, expandable assumptions, invalid-cost blocking, approval consent gating, keyboard skip link and account menu, horizontal overflow, and last-content visibility above the bottom navigation. It made no write request.
- The 20 existing backend tests passed. The main merchant's completed mission state was preserved; a separate `grabspark_a1_visual` database supplies the proposed-mission preview.

## Known limitations and next checkpoint

The backend has no individual-order or fulfillment endpoint, so Orders shows truthful aggregates. It has no menu write endpoint, so Menu cannot edit or publish items. Store status is omitted because the API does not provide it. This UI uses original code and generic icons rather than official Grab artwork. References differ by market and version, and Thai localization remains outside this visual pass.

Checkpoint B's mission business flow had already been implemented before this request. This pass refined its presentation and did not repeat or extend its business logic. For a later backend scope, add merchant-scoped order detail and menu mutation contracts before introducing those actions in the UI. Stop here for visual review.
