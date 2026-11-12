"""Print a local-only signed owner cookie and matching CSRF header value."""
from app.auth import issue_session
from scripts.seed import OWNER_ID


if __name__ == "__main__":
    session, csrf = issue_session(OWNER_ID)
    print("demo_session=" + session)
    print("X-CSRF-Token: " + csrf)
