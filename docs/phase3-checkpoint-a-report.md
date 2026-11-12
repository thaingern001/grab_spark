# Phase 3 Checkpoint A — visual implementation report

Status: implemented for design review on 2026-11-07. **Checkpoint B has not started.**

## Implemented

The Next.js App Router frontend uses TypeScript, React, Tailwind CSS, a compact design token layer, and Lucide icons. Home and One-Click Review are server-rendered from the Phase 2 backend. A server-only typed API client sends an explicitly configured, expiring local demo session cookie. No backend secret or demo token is placed in the browser bundle. The mobile shell has persistent Home/Opportunity navigation, a fixed synthetic-data disclosure, scrollable content, and a centered mobile preview on desktop.

Home shows the merchant identity, demo date, today's GMV, completed orders, AOV, one proposed opportunity, its backend-calculated contribution difference, six closed-month sales trend, and top menu items. Review shows the mission rationale, backend-calculated baseline/proposed contribution and difference, trial duration, provenance-labeled assumptions, breakdown, evidence, method, and limitations in accessible expandable sections. The visible action opens the financial assumptions; approval is explicitly unavailable in this checkpoint.

## Connected API endpoints

* `GET /api/v1/merchants/me`
* `GET /api/v1/dashboard`
* `GET /api/v1/missions/{id}`
* `GET /api/v1/missions/{id}/scenarios`

The Home and Review figures came from the live seeded PostgreSQL-backed FastAPI service. The observed example is **฿2,007.00** today's GMV, **23** completed orders, **฿87.26** AOV, **฿16.30** baseline contribution, **฿24.30** proposed contribution, and **+฿8.00** estimated difference per bundle. These are synthetic demo values, not hardcoded financial fixtures or real merchant results.

## Verification

* `npm run typecheck` and `npm run build` passed with Next.js 16.4.5.
* Production HTTP requests to `/` and `/opportunity` returned 200 and contained the expected live merchant and scenario values.
* Playwright captured 390 × 844 Home and Review plus 320, 375, 430 px and desktop layouts. No horizontal document overflow or page runtime error was observed at any tested width.
* Browser smoke interaction passed for keyboard focus on the skip link, Home → Review → Home, and opening/closing the cost accordion.
* The backend remains unchanged. No write endpoint, menu edit, mission approval, simulation, or MCP transport was added.

## Screenshots

* [Home, 390 × 844](screenshots/home-390x844.png)
* [Review, 390 × 844](screenshots/review-390x844.png)
* [Home trend and top items](screenshots/home-trend-390x844.png)
* [Review cost provenance](screenshots/review-details-390x844.png)
* [Home, 320 × 844](screenshots/home-320x844.png)
* [Review, 320 × 844](screenshots/review-320x844.png)
* [Desktop preview](screenshots/desktop-1280x900.png)

## UX decisions and known limitations

* Home gives the recommendation more prominence than the historical chart; the chart and item list are reachable by scrolling. This keeps the decision visible in the first mobile viewport.
* The two-tab bottom navigation covers only the two Checkpoint A destinations. Performance, Menu, Missions history, approval, and tracking belong to Checkpoint B.
* The cost inputs are visibly labeled as assumptions but are read-only in this checkpoint. The review clearly states that approval is unavailable; it does not simulate a successful write.
* The local demo session expires after 24 hours and requires manual regeneration. There is no browser login flow or remote authentication.
* The backend's dashboard top-items window is the latest 180 days, while the chart uses six closed months. The UI does not claim they are the same date window.

## Recommendation before Checkpoint B

Review the mobile hierarchy, financial language, assumption labels, and action placement in the screenshots. Then implement inline cost edits, source confirmation, revision conflict recovery, explicit simulated approval, tracking/outcome, and supporting views against the existing write/read endpoints. Keep all authoritative calculations in FastAPI.
