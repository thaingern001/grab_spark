# Implementation plan and Phase 2 readiness — revised Phase 1

This is the Phase 1 review artifact. The Phase 2 implementation brief approved backend work on 2026-11-07; implementation results are recorded in [phase2-completion-report.md](phase2-completion-report.md). Later UX and MCP phases remain gated.

## Dependency-ordered sequence

1. **Project initialization:** Next.js App Router/TypeScript UI; FastAPI/Pydantic/SQLAlchemy backend; one shared service package; environment-based configuration; local PostgreSQL test setup. Establish formatting and test commands without adding infrastructure beyond a modular monolith.
2. **Database migration:** Convert [database-schema.sql](database-schema.sql) into an Alembic migration. Verify composite tenant keys, provenance checks, deferred scenario-pair/source constraints, immutability guards, and transactional mission behavior on PostgreSQL 15+. Migration must be reviewed before running against any persistent database.
3. **Deterministic seed:** Fixed UUIDs, `westrong-v1`, six closed months plus 2026-11-07 demo day, multiple Thai menu items, historical order-line snapshots, one proposed mission, and one completed simulated mission. Provide an explicit reset command for isolated demo data.
4. **Shared services:** Decimal finance/rounding, Bangkok date windows, analytics, merchant-scoped repositories, scenario versioning, confirmation metadata, row-locked idempotent approval, transition events, and deterministic outcome generation. Test these before client adapters.
5. **REST API:** Implement the OpenAPI contract with Pydantic schemas, owner/viewer authorization, consistent errors, CSRF on cookie-auth writes, and service-level integration tests. Reconcile dashboard, analytics, and menu results with order snapshots.
6. **One Click merchant UX:** Build Home/Daily Opportunity, one review view with progressive disclosure and inline editing, approval confirmation, tracking/outcome, then supporting performance/menu/history views. Test at 390 × 844, 320 px, and desktop preview. Verify stale-review recovery and missing-input blocking.
7. **Read-only MCP adapter:** Register exactly four tools calling the shared services. Implement scoped token validation, rate limiting, audit logging, revocation for remote mode, and MCP Inspector tests. Attempt external AI client integration only after specific compatibility is confirmed.
8. **End-to-end and demo verification:** Playwright primary journey, REST/MCP reconciliation, tenant isolation, simulated-result exclusion, seed/reset documentation, timed demo script, and local Inspector fallback.

Steps 1–5 constitute the backend foundation; the following UI/MCP steps can overlap once shared service and response contracts are stable. A small team can split backend, frontend, and integration ownership without splitting the deployment into microservices.

## Technical readiness review

| Area | Readiness | Remaining implementation risk |
|---|---|---|
| Database migration | Design ready for translation; not executed. | Test deferred triggers and source immutability on PostgreSQL; application transactions must write complete scenario pairs. |
| API contract | OpenAPI structure and references validated. | Generate Pydantic models and verify nullable scenario calculations and idempotent retry semantics. |
| Financial model | Formula, rounding, and worked examples defined. | Decide synthetic deduction/discount semantics; test edge cases and null inputs. |
| MCP | Four read-only contracts and shared services mapped. | Validate actual client/auth support; Inspector is the guaranteed demo route. |
| UX | Primary journey reduced to one review view with optional detail. | Test comprehension and confirmation wording with merchants; avoid hiding important assumptions. |

## Product approval checklist

* Approved for Phase 2: single-view review with explicit financial-input and simulated-only confirmations.
* Approved for Phase 2: **synthetic** 30% deduction on pre-discount GMV and fixed THB merchant discount.
* Approved for Phase 2: seven-day deterministic simulated trial and preservation of the documented 2026-11-07 demo date. The later brief proposed 2026-10-01 but explicitly directed preserving the earlier documented date.
* Approved Phase 2 approach: MCP Inspector first; external AI client integration deferred pending compatibility validation.
* Phase 3 product review remains: final merchant-facing wording and whether any broader menu-cost editing is needed beyond inline review.

Changing financial semantics, merchant consent, security boundaries, or real-world execution requires a revised design before implementation. No simulated result is evidence of merchant adoption, retention, GMV uplift, or profit improvement; those are future pilot measures.
