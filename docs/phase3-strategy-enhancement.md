# Phase 3 — One Click strategy enhancement

## Scope and route inventory

The existing GrabMerchant-inspired shell, Home (`/`), Orders (`/orders`), Menu (`/menu`), Performance (`/performance`), One Click (`/ai`), and mission tracking (`/missions`, `/missions/[id]`) remain in place. Home, One Click, and Performance retain their contextual entry points. On the disposable proposed-mission demo, Home first presents a compact One Click popup. Dismissing it leaves the existing recommendation card in Home and suppresses the popup for that browser tab session. The card and One Click area still open `/opportunity`, which renders Recommended Strategy, optional Compare Alternatives, optional Bundle Detail, Quick Review, optional Cost Verification, and Confirm & Approve. Approval then opens the existing tracking and simulated outcome experience.

`frontend/components/strategy-journey.tsx` owns view state, editing, revision handling, and consent. `frontend/components/recommended-strategy.tsx` presents the Guided Missions landing view: readiness banner, merchant goal, three full-width strategy rows with Bundle highlighted first, recommendation summary, and review CTA. Bundle opens detail; Discount and Advertising open the optional comparison. It reuses `FinancialHero`, `merchantRequest`, typed response contracts, and the existing backend mission endpoints. `frontend/app/strategy.css` provides the mobile layout. No financial result is calculated in the frontend; only draft input validation and percent input conversion happen there.

## Backend reuse and capability boundary

- `GET /api/v1/dashboard`, `GET /api/v1/missions/{id}`, and `GET /api/v1/missions/{id}/scenarios` supply merchant context, mission, and authoritative scenario results.
- `PUT /api/v1/missions/{id}/scenarios` persists edited inputs with `If-Match` revision checking, then returns recalculated financial results.
- `POST /api/v1/missions/{id}/approve` requires the reviewed revision, both acknowledgments, and an idempotency key.
- Existing mission tracking uses the mission read, simulation, transition, and outcome endpoints.

Only the baseline-versus-Bundle scenario has a financial model. Discount and Advertising appear as **แนวคิด · ยังไม่มีแบบจำลอง** (Concept — Not Yet Modeled), with qualitative trade-offs and no approval path. There is no comparable three-strategy ranking, advertising ROI model, order-growth forecast, seven-day profit forecast, or documented risk score. A future multi-strategy backend would need typed strategy variants, common comparison units, each strategy's cost model and provenance, uncertainty/forecast methodology if forecasts are desired, and an approval contract binding the selected variant and revision. Those changes were not made here.

## Financial and consent behavior

The recommended Bundle shows backend baseline and proposed contribution and their difference **per relevant sale**. The detail view shows price, merchant-funded discount, synthetic platform deduction, merchant revenue, food cost, packaging cost, other variable costs, contribution, source labels, assumptions, risks, and methodology. Its explanation explicitly excludes fixed costs and guaranteed demand. Quick Review shows the current revision and material inputs. Editing saves through the existing scenario endpoint; a conflict reloads current inputs and asks for another review. Consent is required before approval. Approval remains a simulated seven-day trial and never publishes a Grab promotion.

## Screenshots

Mobile screenshots at 320, 375, 390, and 430 CSS px are under `docs/screenshots/strategy/`. The 390 px review set is [Home popup](screenshots/strategy/home-popup-390.png), [Recommended](screenshots/strategy/recommended-390.png), [Compare](screenshots/strategy/compare-390.png), [Bundle Detail](screenshots/strategy/detail-390.png), and [Quick Review](screenshots/strategy/review-390.png). The capture helper expands the prototype's scroll frame only for full-content screenshots; interactive viewport checks use the real layout. The primary action on Recommended, Quick Review, and Confirm & Approve is visible within the initial 390 × 844 viewport. Cost editing and financial detail remain scrollable because their material inputs and methodology need room.

## Verification

- Frontend typecheck and production build passed.
- `strategy-verify.mjs` passed at 320, 375, 390, and 430 px after the Guided Missions visual revision: all three rows fit without horizontal scrolling, row navigation, optional exploration, direct Quick Review, unsupported labels, no horizontal overflow, no browser errors, and consent gate.
- `home-popup-verify.mjs` passed at 320, 390, and 430 px: initial appearance, dismissal to the Home recommendation, session suppression after reload, and navigation by both popup CTA and Home card.
- `checkpoint-b-e2e.mjs` passed again after the visual revision on disposable preview: cost change, backend recalculation, approval, simulation, review, and persistence after reload.
- `strategy-stale-verify.mjs` passed: saving in another tab increments revision and updates contribution; stale save receives conflict and reloads authoritative inputs.
- Backend suite: 20 passed, one upstream Starlette `httpx` deprecation warning.
- The reset guard rejected an attempt directed at the main `grabspark` database. The preview database was then restored and the recommended mission is available again.

## Safe demo reset

The main `grabspark` database retains its existing mission history. The reset script only accepts `APP_ENV=local`, a loopback host, database name `grabspark_a1_visual`, and explicit `--confirm`. It truncates the disposable preview merchant data and re-runs deterministic seed v1 in one transaction. It does not expose an HTTP endpoint.

From `backend/` in PowerShell:

```powershell
$env:DATABASE_URL='postgresql+psycopg://grabspark:grabspark@127.0.0.1:5432/grabspark_a1_visual'
.venv\Scripts\python.exe -m scripts.reset_visual_demo --confirm
```

The live preview is `http://127.0.0.1:3001`; the main app is `http://127.0.0.1:3000`. The preview is disposable. Do not run mutating E2E scripts against the main app.

## Known limits

The comparison is capability-aware rather than a numeric A/B/C comparison. The seven-day result remains deterministic simulated data. Backend seed names and rationale are in English inside the Thai interface. View changes within `/opportunity` use in-app controls rather than separate browser-history entries. No real Grab integration or real promotion action exists.
