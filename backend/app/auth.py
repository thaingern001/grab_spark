"""Local-only signed demo sessions. Replace with real identity before remote use."""
import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.core import settings
from app.errors import AppError


@dataclass(frozen=True)
class MerchantContext:
    user_id: UUID
    merchant_id: UUID
    role: str


def _secret() -> bytes:
    if settings.app_env != "local" or len(settings.demo_session_secret) < 24:
        raise RuntimeError("Demo sessions require APP_ENV=local and a 24+ character secret")
    return settings.demo_session_secret.encode()


def issue_session(user_id: UUID, expires_at: int | None = None) -> tuple[str, str]:
    payload = json.dumps({"uid": str(user_id), "exp": expires_at or int(time.time()) + 86400}, separators=(",", ":")).encode()
    body = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    signature = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()
    session = f"{body}.{signature}"
    return session, csrf_token(session)


def csrf_token(session: str) -> str:
    return hmac.new(_secret(), f"csrf:{session}".encode(), hashlib.sha256).hexdigest()


def authenticate(conn: Connection, session: str | None) -> MerchantContext:
    if not session:
        raise AppError(401, "unauthorized", "Demo session required")
    try:
        body, signature = session.split(".", 1)
        expected = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("signature")
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        if int(payload["exp"]) < int(time.time()):
            raise ValueError("expired")
        user_id = UUID(payload["uid"])
    except (ValueError, KeyError, TypeError, UnicodeDecodeError):
        raise AppError(401, "unauthorized", "Invalid demo session") from None
    row = conn.execute(text("SELECT id, merchant_id, role FROM merchant_users WHERE id=:id AND active=true"), {"id": user_id}).mappings().first()
    if row is None:
        raise AppError(401, "unauthorized", "Inactive or unknown user")
    return MerchantContext(row["id"], row["merchant_id"], row["role"])


def require_owner(context: MerchantContext) -> None:
    if context.role != "owner":
        raise AppError(403, "forbidden", "Owner role required")


def check_csrf(session: str, supplied: str | None) -> None:
    if not supplied or not hmac.compare_digest(csrf_token(session), supplied):
        raise AppError(403, "forbidden", "Valid CSRF token required")
