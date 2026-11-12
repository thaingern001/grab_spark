import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

os.environ.setdefault("DEMO_SESSION_SECRET", "local-test-secret-2026-for-grabspark")

from app.core import settings
from app.auth import issue_session
from app.main import app
from scripts.seed import OWNER_ID, seed


@pytest.fixture(scope="session")
def test_engine():
    original_url = settings.database_url
    base_url = create_engine(original_url).url
    test_url = base_url.set(database="grabspark_test").render_as_string(hide_password=False)
    admin = create_engine(base_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname='grabspark_test'")).scalar()
        if not exists:
            conn.execute(text("CREATE DATABASE grabspark_test"))
    admin.dispose()
    settings.database_url = test_url
    config = Config("alembic.ini")
    command.upgrade(config, "head")
    engine = create_engine(test_url, pool_pre_ping=True)
    import app.main as main
    main.engine = engine
    yield engine
    engine.dispose()
    settings.database_url = original_url


@pytest.fixture
def db(test_engine):
    with test_engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE merchants CASCADE"))
        seed(conn)
    return test_engine


@pytest.fixture
def client(db):
    session, csrf = issue_session(OWNER_ID)
    with TestClient(app, cookies={"demo_session": session}, headers={"X-CSRF-Token": csrf}) as test_client:
        yield test_client
