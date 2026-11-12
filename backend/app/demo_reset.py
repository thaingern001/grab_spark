"""Reset only the disposable local visual demo to its deterministic seed."""

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.auth import MerchantContext
from app.core import settings
from app.errors import AppError
from scripts.seed import MERCHANT_ID, OWNER_ID, PROPOSED_ID, seed


def _is_disposable_preview(conn: Connection) -> bool:
    url = conn.engine.url
    return settings.app_env == "local" and url.database == "grabspark_a1_visual" and url.host in {"127.0.0.1", "localhost"}


def reset(conn: Connection, context: MerchantContext) -> dict:
    if not _is_disposable_preview(conn) or context.merchant_id != MERCHANT_ID or context.user_id != OWNER_ID:
        raise AppError(403, "demo_reset_unavailable", "Demo reset is available only for the local visual preview owner")
    conn.execute(text("TRUNCATE TABLE merchants CASCADE"))
    seeded = seed(conn)
    return {"reset": True, "seed_version": seeded["seed_version"], "mission_id": str(PROPOSED_ID), "mission_status": "proposed"}
