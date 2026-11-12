# Acceptance criteria and verification matrix

## Phase 1 document review

| Check | Pass condition | Evidence |
|---|---|---|
| Journey coverage | Daily Opportunity → one review view → approval confirmation → tracking works; sales, menu, history, and detail remain accessible without becoming mandatory steps. | `ux-flow.md`, `api-contract.yaml` |
| Shared services | Each MCP tool maps to a scoped backend service also used by REST. | `system-architecture.md`, `mcp-tool-contracts.md` |
| Financial consistency | Formula, rounding, example values, order snapshots, and API fields agree. | `financial-model.md`, SQL, OpenAPI |
| Lifecycle | Allowed edges, event log, explicit approval, row locking, idempotency, revision conflict handling, and simulated completion are defined. | Architecture, SQL, OpenAPI |
| Tenant isolation | All owned tables have merchant relationship and scoped access. | SQL composite FKs, architecture |
| Reproducibility | Fixed seed and same-record reconciliation are specified. | Database design, implementation plan |

## Phase 2 tests to implement

* Decimal example: baseline `16.30`, bundle `24.30`, difference `8.00`; test rounding boundaries and discount applied exactly once.
* SQL constraints: reject negative costs, out-of-range rates, cross-merchant order/menu/mission references, duplicate or half-written scenario revisions, missing scenario source rows, mutation of approved arms/sources, and duplicate outcome arms. Verify `merchant_confirmed` requires `confirmed_at` and nonconfirmed rows prohibit it in menu assumptions, scenario sources, and order snapshots.
* State machine: every allowed edge succeeds with one event in the same transaction; invalid and duplicate transitions fail; approval requires owner, current reviewed revision, complete inputs, explicit financial confirmation, simulation acknowledgment, and idempotency key.
* Concurrency: two simultaneous saves serialize on the mission row; save-versus-approve cannot approve stale values; identical approval retry returns the same event and state, while changed payload/key or revision returns 409.
* Analytics: period boundaries use Bangkok dates; completed orders only; AOV counts orders once; sum of menu-item GMV equals total GMV; outcomes are excluded from historical sales.
* Seed repeatability: identical IDs and totals from clean reset; no fabricated customer PII.

## Phase 3 journey tests

At 390 × 844 and 320 px, a merchant can open the daily opportunity, see baseline/proposed/difference on one review view, expand cost/method/risk detail, edit values inline, explicitly confirm material inputs, approve the simulated trial, run the simulation, and read labeled outcomes. No separate cost/comparison/review page is mandatory. Missing inputs show unavailable estimates and block approval. Previously confirmed unchanged inputs are reused; changed inputs invalidate the review. Refresh persists status. No button implies a production action. Keyboard, focus, target size, and visible label checks pass. Record review completion, interaction count/time, estimate comprehension, and recommendation confidence without claiming business uplift.

## Phase 4 MCP tests

Inspector discovers exactly four read-only tools and completes an authorized sales/menu/mission task before external AI integration is attempted. Authorized read results equal REST/service values for the same range. Missing, expired, revoked, wrong-scope, and cross-merchant credentials fail. Mission ID enumeration does not disclose other merchants. Rate limiting and audit events record denied and successful calls without exposing secrets. Outcome consistency and exclusion of simulated results from historical analytics are tested.

## Phase 5 demo exit

One documented setup/reset sequence reproduces the same dashboard and mission data. The scripted One Click journey and independent MCP query both complete. Simulated outcome and unofficial/synthetic labels are visible. A local Inspector fallback works without ChatGPT custom MCP support.
# Multi-strategy acceptance (Phase 3 extension)

Pass when Bundle, Discount, and Advertising are calculated by the backend with explicit provenance, seven-day contribution and difference, risk dimensions and bounded score; the lowest-risk eligible strategy wins with deterministic tie-breaking. Edits create a new evaluation or scenario revision and prevent stale approval. One merchant approval with both confirmations persists an immutable model snapshot. Backend processing returns the selected strategy's deterministic simulated outcome, safe retries return the same result, and Results & Learning survives reload. The 320, 375, 390, and 430 px sheet has no horizontal document or content overflow; optional detail/compare views do not add a mandatory step. The UI always distinguishes simulation from an actual promotion or observed performance.
