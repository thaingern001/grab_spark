from datetime import date
import logging
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, Header, Query, Request, Security
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyCookie
from sqlalchemy import text
from sqlalchemy.engine import Connection

from app import analytics, demo_reset, missions, strategies
from app.auth import MerchantContext, authenticate, check_csrf
from app.db import engine
from app.errors import AppError
from app.schemas import (
    ApprovalRequest, DashboardOut, MenuOut, MenuPerformanceOut, MerchantOut,
    MissionOut, OutcomeOut, SalesSeriesOut, ScenarioOut, ScenarioUpdate,
    StrategyEvaluationOut, StrategyInputsUpdate,
    TransitionRequest,
)

app = FastAPI(title="GrabSpark synthetic merchant API", version="0.1.0", description="Unofficial concept prototype; all business data is synthetic.")
demo_cookie = APIKeyCookie(name="demo_session", scheme_name="DemoSession", auto_error=False)
logger = logging.getLogger(__name__)


def connection():
    with engine.begin() as conn:
        yield conn


def identity(conn: Annotated[Connection, Depends(connection)], demo_session: Annotated[str | None, Security(demo_cookie)]) -> MerchantContext:
    return authenticate(conn, demo_session)


def owner_write(context: Annotated[MerchantContext, Depends(identity)], demo_session: Annotated[str | None, Security(demo_cookie)], x_csrf_token: Annotated[str | None, Header()] = None) -> MerchantContext:
    if demo_session is None:
        raise AppError(401, "unauthorized", "Demo session required")
    check_csrf(demo_session, x_csrf_token)
    from app.auth import require_owner
    require_owner(context)
    return context


@app.exception_handler(AppError)
async def app_error(request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}, "request_id": request.state.request_id})


@app.exception_handler(RequestValidationError)
async def request_error(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"error": {"code": "invalid_request", "message": "Request validation failed", "details": {"fields": [{"loc": list(e["loc"]), "message": e["msg"]} for e in exc.errors()]}}, "request_id": request.state.request_id})


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    logger.exception("Unhandled API error, request_id=%s", request.state.request_id, exc_info=exc)
    return JSONResponse(status_code=500, content={"error": {"code": "internal_error", "message": "Unexpected server error"}, "request_id": request.state.request_id})


@app.middleware("http")
async def request_id(request: Request, call_next):
    request.state.request_id = str(uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.get("/api/v1/merchants/me", response_model=MerchantOut)
def merchant_me(context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)]):
    row = conn.execute(text("SELECT id,name,business_type,currency,timezone FROM merchants WHERE id=:id"), {"id": context.merchant_id}).mappings().one()
    return {**row, "synthetic": True}


@app.post("/api/v1/demo/reset")
def reset_visual_demo(context: Annotated[MerchantContext, Depends(owner_write)], conn: Annotated[Connection, Depends(connection)]):
    return demo_reset.reset(conn, context)


@app.get("/api/v1/dashboard", response_model=DashboardOut)
def dashboard(context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)]):
    return analytics.dashboard(conn, context.merchant_id)


@app.get("/api/v1/analytics/sales", response_model=SalesSeriesOut)
def sales(context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)], start: Annotated[date, Query(alias="from")], to: date, granularity: Literal["day", "month"] = "day"):
    analytics.validate_range(start, to)
    return {"summary": analytics.sales_summary(conn, context.merchant_id, start, to), "series": analytics.sales_series(conn, context.merchant_id, start, to, granularity)}


@app.get("/api/v1/analytics/menus", response_model=list[MenuPerformanceOut])
def menu_performance(context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)], start: Annotated[date, Query(alias="from")], to: date, limit: Annotated[int, Query(ge=1, le=50)] = 10):
    return analytics.menu_performance(conn, context.merchant_id, start, to, limit)


@app.get("/api/v1/menus", response_model=list[MenuOut])
def menus(context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)]):
    return analytics.menus(conn, context.merchant_id)


@app.get("/api/v1/missions", response_model=list[MissionOut])
def list_missions(context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)], status: Literal["proposed", "approved", "running", "completed", "reviewed", "rejected", "cancelled"] | None = None):
    return missions.list_missions(conn, context.merchant_id, status)


@app.get("/api/v1/missions/{id}", response_model=MissionOut)
def mission_detail(id: UUID, context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)]):
    return missions.get_mission(conn, context.merchant_id, id)


@app.get("/api/v1/missions/{id}/scenarios", response_model=ScenarioOut)
def scenario_detail(id: UUID, context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)]):
    return missions.scenarios(conn, context.merchant_id, id)


@app.put("/api/v1/missions/{id}/scenarios", response_model=ScenarioOut)
def scenario_save(id: UUID, body: ScenarioUpdate, context: Annotated[MerchantContext, Depends(owner_write)], conn: Annotated[Connection, Depends(connection)], if_match: Annotated[int, Header(ge=1)]):
    return missions.save_scenarios(conn, context, id, if_match, body.model_dump())


@app.get("/api/v1/missions/{id}/strategies", response_model=StrategyEvaluationOut)
def strategy_evaluation(id: UUID, context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)]):
    return strategies.evaluate(conn, context.merchant_id, id)


@app.put("/api/v1/missions/{id}/strategies/assumptions", response_model=StrategyEvaluationOut)
def strategy_assumptions(id: UUID, body: StrategyInputsUpdate, context: Annotated[MerchantContext, Depends(owner_write)], conn: Annotated[Connection, Depends(connection)], if_match: Annotated[int, Header(ge=1)]):
    return strategies.save_inputs(conn, context, id, if_match, body.model_dump())


@app.post("/api/v1/missions/{id}/approve", response_model=MissionOut)
def mission_approve(id: UUID, body: ApprovalRequest, context: Annotated[MerchantContext, Depends(owner_write)], conn: Annotated[Connection, Depends(connection)], idempotency_key: Annotated[str, Header(min_length=8, max_length=100)]):
    return missions.approve(conn, context, id, body.reviewed_revision, idempotency_key, body.confirm_material_inputs, body.acknowledge_simulation, body.selected_strategy_id, body.evaluation_revision)


@app.post("/api/v1/missions/{id}/simulate", response_model=MissionOut)
def mission_simulate(id: UUID, context: Annotated[MerchantContext, Depends(owner_write)], conn: Annotated[Connection, Depends(connection)]):
    return missions.simulate(conn, context, id)


@app.post("/api/v1/missions/{id}/transitions", response_model=MissionOut)
def mission_transition(id: UUID, body: TransitionRequest, context: Annotated[MerchantContext, Depends(owner_write)], conn: Annotated[Connection, Depends(connection)]):
    return missions.transition(conn, context, id, body.action, body.reason)


@app.get("/api/v1/missions/{id}/outcome", response_model=OutcomeOut)
def mission_outcome(id: UUID, context: Annotated[MerchantContext, Depends(identity)], conn: Annotated[Connection, Depends(connection)]):
    return missions.outcome(conn, context.merchant_id, id)
