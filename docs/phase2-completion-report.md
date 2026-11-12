# Phase 2 completion report — Backend Foundation & Core Services

Date: 2026-11-07. Status: **complete for the approved local synthetic prototype scope**. Phase 3 merchant UX and Phase 4 MCP transport have not begun.

## Implemented components

* Python 3.11 backend with FastAPI, Pydantic v2, SQLAlchemy 2.x, psycopg, Alembic, Pytest, and HTTPX. Python 3.11 is a compatible supported version under the brief's “3.12 or compatible” allowance.
* Standalone Alembic initial migration derived from the Phase 1 PostgreSQL schema. It includes UUID keys, composite tenant FKs, numeric financial columns, provenance checks, deferred complete-scenario checks, immutable scenario arms/approved sources, and append-only events.
* `westrong-v1` deterministic seed: Westrong Kitchen, one owner, six menu items, six closed months of orders plus demo day, per-line financial snapshots, proposed and completed missions, event histories, and simulated outcome arms. No customer PII.
* Pure Decimal finance engine using `ROUND_HALF_UP`, pre-discount GMV deduction base, fixed THB merchant discount, nullable results for missing inputs, and explicit contribution terminology.
* Transport-independent analytics and mission services, scoped by server-derived merchant context. REST is the only adapter implemented in this phase; the future MCP adapter can reuse these services.
* Local-only signed, expiring demo cookie, CSRF header on writes, active-user and owner-role checks. This is not production or remote authentication.

## Architecture decisions

The backend remains a modular monolith. SQLAlchemy Core/text queries live in the shared services rather than a separate repository class hierarchy; every merchant-owned query uses authenticated `merchant_id`, and composite keys provide a second ownership check. Scenario saves and approvals lock the mission row. An approval commits source confirmations, approved revision, idempotency metadata, status, and one event together. Simulated execution commits running/completed events and both outcome arms together. Historical analytics read only completed orders, never outcome records.

## Migration and seed results

* PostgreSQL **16.15** local Docker instance: `alembic upgrade head` succeeded for the development database.
* A fresh `grabspark_test` database was created and migrated by the test fixture; migration smoke test passed.
* First seed: **2,953 orders**, **4,168 order items**, two missions, five initial mission events. Second seed produced the same counts and no duplicates.
* The seeded baseline is **฿16.30** estimated contribution; proposed bundle **฿24.30**; difference **+฿8.00 per unit**.

## Test and startup results

`python -m pytest -q --tb=short`: **20 passed**, one third-party Starlette/TestClient deprecation warning. Tests exercised the real PostgreSQL migration, seed idempotency, financial rounding/discount/missing values, dashboard–analytics reconciliation, tenant isolation, inactive/viewer rejection, provenance/FK constraints, scenario completeness and immutability, event immutability, approval rollback, concurrent saves, same/different-key concurrent approvals, save-versus-approve serialization, state transitions, and simulated-result exclusion.

Uvicorn started successfully on `127.0.0.1:8000`; live HTTP requests to `/openapi.json`, `/api/v1/merchants/me`, and `/api/v1/dashboard` returned **200** with an authorized local demo cookie.

## REST endpoint inventory

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/merchants/me` | Merchant context |
| GET | `/api/v1/dashboard` | Today, six-month trend, top items, opportunity |
| GET | `/api/v1/analytics/sales` | Date-filtered sales, orders, AOV, contribution |
| GET | `/api/v1/analytics/menus` | Ranked menu performance |
| GET | `/api/v1/menus` | Menu and current cost assumptions |
| GET | `/api/v1/missions` | Mission list |
| GET | `/api/v1/missions/{id}` | Mission detail and event history |
| GET, PUT | `/api/v1/missions/{id}/scenarios` | Financial comparison and revision save |
| POST | `/api/v1/missions/{id}/approve` | Explicit idempotent simulated approval |
| POST | `/api/v1/missions/{id}/simulate` | Deterministic fictional trial |
| POST | `/api/v1/missions/{id}/transitions` | Review, reject, cancel |
| GET | `/api/v1/missions/{id}/outcome` | Labeled simulated outcome |

FastAPI publishes interactive OpenAPI at `/docs`. Request validation and domain errors use the documented error envelope. Money values are decimal strings.

## Deviations and known limitations

* The Phase 2 brief proposed **2026-10-01** as demo date but instructed preserving an earlier documented fixed date. Phase 1 specified **2026-11-07**, which the implementation retains. Historical months are May–October 2026.
* The Phase 1 diagram showed a distinct repository layer. For Phase 2, scoped SQLAlchemy queries are in the transport-independent service modules. A separate repository abstraction can be introduced if another persistence use case warrants it; no business calculation is duplicated in REST.
* The demo cookie/HMAC and fixed local user are deliberately local only. Remote identity, token revocation, edge rate limiting, and hosted CSRF/cookie policy are not implemented and must be designed before remote exposure.
* The completed seeded mission and on-demand outcome are fictional. A single `simulate` request records running then completed in one transaction, so running is transient in the demo. There is no background trial scheduler or real promotion execution.
* No frontend, MCP server, external AI integration, production Grab connection, or deployment exists in Phase 2.

## Readiness for Phase 3

The REST backend and stable synthetic dataset are ready for merchant UX integration. Phase 3 should consume the existing API contract, show assumptions and simulated labels prominently, confirm material inputs before approval, and test the one-view review at mobile sizes. Phase 3 remains behind its separate approval gate. MCP Inspector integration belongs to Phase 4 and should call the same shared services.
