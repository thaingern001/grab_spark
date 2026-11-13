# GrabMerchant concept — One Click prototype

## 2C Interactive Judge Demo (standalone)

The public judge build opens at `/` and contains two independent browser-only journeys: **C1 One Click** (discover → compare/details → consent → confirm → prepared simulated result → optional mission chat → review) and **C2 Connector** (choose a simulated client → grant read-only scopes → ask a prepared question → see only authorized synthetic results → review a draft → revoke). The merchant can reset either journey with the reset control in the header. State is scoped to the current browser tab via `sessionStorage` and survives refresh.

The judge build uses [`demo/fixtures/snapshot.json`](demo/fixtures/snapshot.json), exported from the deterministic Westrong Kitchen backend seed dated 2026-11-07. Baseline contribution is ฿652.00 for 40 orders. Bundle, Discount, and Advertising results are ฿956.00 / +฿304.00 / risk 25, ฿715.00 / +฿63.00 / risk 29, and ฿747.60 / +฿95.60 / risk 35, respectively. The fixture is fixed synthetic data, so judges cannot edit financial assumptions in the standalone build. The full-stack application below retains editable assumptions and backend recalculation.

The Connector workspace is a scripted concept, with no OAuth, live MCP, external AI call, or campaign publication. The ฿500 cap comes from the sample question; the draft omits a numeric outcome forecast. Read-only tool examples are gated by explicitly authorized scopes. Removing a scope blocks it immediately; adding a scope requires authorization. Revoking access clears every granted scope immediately.

To build and preview the judge site locally without FastAPI or PostgreSQL:

```powershell
cd frontend
npm install
npm run build:judge
$env:NEXT_PUBLIC_GRABSPARK_JUDGE_DEMO = '1'
npx next start -p 3002 -H 127.0.0.1
```

Stop the running `next start` process before rebuilding, then start it again. A rebuild changes static asset names; an older running server can otherwise serve HTML that points to CSS files it cannot load.

For Vercel, create a Next.js project with **Root Directory `frontend`**. [`vercel.json`](vercel.json) runs the dedicated judge build. Vercel's runtime flag selects the browser-only landing page; no database URL, demo session, or external API credentials are needed. The existing FastAPI/PostgreSQL application remains available for local full-stack development. Deployment to a public URL requires connecting this source directory or repository to a Vercel project; this README does not imply a live deployment has already occurred.

Run `node scripts/judge-demo-e2e.mjs` against the local production preview. It tests all three C1 selections and results, mandatory consent, refresh and reset, C2 permission gating and revocation, browser errors, asset loading, and responsive widths of 320, 375, 390, 430, 768, 1024, and 1440px. Screenshots are written to [`../docs/screenshots/judge-demo/`](../docs/screenshots/judge-demo/).

---

Current Phase 3 One Click flow: Home recommendation → compact three-strategy popup with locally stored AI-generated concept previews → one informed confirmation → prepared simulated result with separate actual-activity status and optional MAI demo chat → Reviewed. See the [UX and visual refinement report](../docs/phase3-ux-visual-refinement.md) for screenshots, assets, test results, and limitations. The popup previews are concept artwork; prices and financial figures remain backend-driven UI text.

The disposable preview at port 3001 shows **Reset demo account** after opening the Profile menu in the app header. It resets all sample account data in the local `grabspark_a1_visual` database and returns to the Home recommendation popup. The preview launcher sets `GRABSPARK_DEMO_RESET_ENABLED=1`; the main app does not show this control. The backend independently verifies the exact preview database, loopback database host, local mode, seeded merchant owner, and normal session/CSRF checks before reset. The reset is repeatable and never publishes a campaign.

Unofficial prototype using synthetic merchant data. The product frame is GrabMerchant; One Click is an AI-assisted mission capability inside it. No real Grab integration or promotion publishing exists.

The [Checkpoint A.1 report](../docs/phase3-checkpoint-a1-report.md) documents the merchant-app visual refinement, before/after screenshots, design tokens, and mobile checks. This UI pass preserves the already implemented Checkpoint B mission behavior.

The [earlier Thai merchant-app fidelity pass](../docs/phase3-fidelity-pass.md) added a two-column Home summary, personalized One Click placement, shortcut grid, and updated screenshots. The current application UI and backend-generated guidance are in English. The historical report and its read-only visual check reflect the earlier Thai interface.

## Run locally

Start the [Phase 2 backend](../backend/README.md) and seeded PostgreSQL database. From `frontend/`:

```powershell
npm install
Copy-Item .env.example .env.local
```

In `backend/`, run `.venv\Scripts\python.exe -m scripts.demo_session` with the same `DEMO_SESSION_SECRET` used by the running API. Copy the `demo_session` value into `GRABSPARK_DEMO_SESSION` and the CSRF token into `GRABSPARK_DEMO_CSRF` in `frontend/.env.local`. Both remain server-only. Keep `GRABSPARK_API_BASE_URL=http://127.0.0.1:8000`. Sessions expire after 24 hours.

```powershell
npm run dev
npm run typecheck
npm run build
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The Next server renders merchant-scoped reads from FastAPI. A local-only same-origin route forwards mission writes with the server-held session and CSRF token. It is a demo bridge, not a production login design.

## Journey

Home → One Click opportunity → cost verification → backend scenario comparison → explicit simulated-trial approval → mission tracking → generated simulated outcome → mark reviewed. Mission state, revisions, sources, calculations, and events persist in PostgreSQL. The browser never calculates authoritative finance values. The 7-day trial outcome is fictional and uses the backend simulation service; it does not represent observed orders.

Home, Orders, Menu, Performance, AI, and Missions share one application shell and data contracts. Orders shows aggregate completed-order data because the backend has no individual order-list endpoint. Menu shows current items and cost provenance because the backend has no menu mutation endpoint. Adding fulfillment or menu editing requires a scoped backend API; this UI does not fabricate those actions.

## Checks

`npm run build` verifies TypeScript and production compilation. `scripts/checkpoint-b-e2e.mjs` drives the full mission path in Playwright, including saving costs, approval, simulation, refresh persistence, and outcome review. **It mutates the target synthetic mission**, so run it only against a disposable seeded database with `GRABSPARK_E2E_MUTATE_SEED=1`. See [Checkpoint B report](../docs/phase3-checkpoint-b-report.md).
