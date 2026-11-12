"""Reset only the disposable local visual-preview database to its deterministic seed.

Run from backend/: python -m scripts.reset_visual_demo --confirm
"""
import argparse

from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core import settings
from app.db import engine
from scripts.seed import seed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm", action="store_true", help="Acknowledge deletion of preview demo records")
    args = parser.parse_args()
    url = make_url(settings.database_url)
    if not args.confirm or settings.app_env != "local" or url.database != "grabspark_a1_visual" or url.host not in {"127.0.0.1", "localhost"}:
        parser.error("Reset allowed only with --confirm, APP_ENV=local, and a loopback grabspark_a1_visual database")
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE TABLE merchants CASCADE"))
        result = seed(connection)
    print(f"Restored disposable visual demo: {result}")


if __name__ == "__main__":
    main()
