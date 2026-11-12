# Read-only MCP tool contracts

Use the official Python MCP SDK with Streamable HTTP for a remote-capable adapter. MCP Inspector is the primary verified demo client; external AI integration is secondary and depends on specific client/auth compatibility. Tool inputs are validated models; outputs are JSON objects with decimal-string THB amounts, ISO dates, `synthetic: true`, and a `data_as_of` timestamp. The adapter receives authenticated merchant context from verified transport credentials and calls the same analytics/mission services as REST. It contains no separate financial arithmetic and does not accept a `merchant_id` argument. Invalid dates or pagination return tool errors with a stable code; out-of-scope mission IDs return `not_found` without revealing existence.

| Tool | Input schema | Output contract | Service and access |
|---|---|---|---|
| `get_sales_summary` | `from_date`, `to_date` ISO dates, inclusive; max 366 days | SalesSummary: GMV, merchant revenue, estimated contribution, orders, AOV or null, prior-period GMV, currency, synthetic | `AnalyticsService.sales_summary(context.merchant_id, range)`; `analytics:read` |
| `get_menu_performance` | `from_date`, `to_date`, `limit` 1–50 (default 10) | Ranked array of item ID/name, units, GMV, estimated contribution, currency, synthetic | `AnalyticsService.menu_performance(context.merchant_id, range, limit)`; `analytics:read` |
| `get_merchant_missions` | Optional `status` enum; `limit` 1–50 (default 20) | Array of mission ID/title/status/trial days/created timestamp/synthetic; no cost assumptions unless explicitly requested through future design | `MissionService.list(context.merchant_id, filters)`; `missions:read` |
| `get_mission_outcome` | `mission_id` UUID | Mission ID/status and outcome when available; baseline/trial arms, units, GMV, merchant revenue, estimated contribution, learning summary, `simulated: true` | `MissionService.get_outcome(context.merchant_id, id)`; `missions:read` |

The outcome tool returns `outcome: null` for a mission that exists but has not completed, rather than a fabricated result. The REST outcome endpoint uses 404 for unavailable outcome in v1; the shared service returns an optional outcome and each adapter maps it to its own contract. All four tools are discoverable as read-only and have no mutation or approval capability. Tool descriptions must say that the data is fictional and that estimated contribution is not net profit.

## Identity and safeguards

Local demonstration: launch an MCP Inspector-compatible server with a one-merchant, read-only demo bearer token from environment configuration. The token is never committed or shown in UI. Remote demonstration requires HTTPS, validated issuer/audience/expiry, merchant and scopes from the token or server-side grant, revocation support, rate limiting, and audit records of tool name, principal, merchant, timestamp, and result status. A token must never grant a requested merchant ID beyond its own identity. No database credential or service-role key crosses the client boundary.

Test with MCP Inspector first and keep that path fully functional. Then test a compatible external AI client only after validating its custom MCP and authentication support; do not promise ChatGPT or Claude connectivity by assumption. Compare every tool result with REST and direct service fixtures for the same Bangkok date window. Simulated mission outcomes must not enter historical sales or menu analytics.
