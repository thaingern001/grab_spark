# GrabSpark Phase 2 backend

Unofficial concept prototype using **synthetic merchant data only**. No Grab production connection or live promotion action exists. Python 3.11+ (below 3.14), PostgreSQL 15+, FastAPI, SQLAlchemy, and Alembic form one modular backend. The REST adapter calls the same merchant-scoped services intended for the later read-only MCP adapter; no MCP transport or merchant UI is implemented here.

## Local setup (PowerShell)

From `backend/`:

```powershell
uv venv --python 3.11 .venv
uv pip install --python .venv\Scripts\python.exe -e '.[test]'
Copy-Item .env.example .env
```

Set `DEMO_SESSION_SECRET` in `.env` to a unique value of at least 24 characters. Keep `.env` local. The example connection uses `127.0.0.1` because `localhost` resolution can stall on some Windows setups.

Start local PostgreSQL (or supply another PostgreSQL 15+ URL in `DATABASE_URL`):

```powershell
docker run -d --name grabspark-phase2-pg -e POSTGRES_USER=grabspark -e POSTGRES_PASSWORD=grabspark -e POSTGRES_DB=grabspark -p 127.0.0.1:5432:5432 postgres:16-alpine
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe -m scripts.seed
.venv\Scripts\python.exe -m scripts.seed  # same IDs; no duplicates
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

If the named container already exists but is stopped, use `docker start grabspark-phase2-pg` in place of `docker run`.

The API documentation is at `http://127.0.0.1:8000/docs` and JSON OpenAPI at `/openapi.json`. To obtain a local owner session and CSRF header, run `.venv\Scripts\python.exe -m scripts.demo_session`. Set the printed `demo_session` cookie for API requests and add `X-CSRF-Token` to writes. The session expires after 24 hours. This HMAC scheme is **local demo authentication only**; do not expose it as remote production auth. The server resolves the active user and merchant from the signed cookie, scopes every resource server-side, and requires owner role for writes.

## Testing

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Tests require PostgreSQL and create a separate `grabspark_test` database on the configured local server. They migrate it, truncate its synthetic records between database tests, and verify real PostgreSQL constraints and concurrent approval behavior. They never use SQLite. Do not point this test runner at a shared or production PostgreSQL instance; the configured user needs `CREATEDB` for the test database. Pure finance tests run without database access.

## Data and contracts

Seed version `westrong-v1` is anchored to **2026-11-07**, the date already approved in Phase 1 documentation; the Phase 2 brief proposed 2026-10-01 but directed preserving an earlier documented date. Six closed historical months are May–October 2026 plus a separate demo “today.” Seeded orders use fictional line snapshots, fixed UUIDs, a fixed random seed, and no customer personal information. Outcomes are explicitly simulated and never included in historical sales aggregates.

Money is Python `Decimal` and PostgreSQL `numeric`; the assumed 30% deduction uses pre-discount GMV and is **not a Grab commission rate**. Contribution is estimated per-unit or total contribution, never net profit. The financial and REST contracts are in `../docs/financial-model.md` and `../docs/api-contract.yaml`.

## Structure

`app/finance.py` owns pure arithmetic. `app/analytics.py` and `app/missions.py` are transport-independent services over SQLAlchemy connections. `app/auth.py` is the local identity boundary. `app/main.py` is the FastAPI adapter. `alembic/versions/0001_initial.py` is a standalone migration derived from the approved SQL design. `scripts/seed.py` is idempotent. Tests cover finance, API, tenant isolation, schema integrity, mission state, and concurrency.
