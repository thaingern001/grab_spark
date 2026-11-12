from datetime import date
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "local"
    database_url: str = "postgresql+psycopg://grabspark:grabspark@127.0.0.1:5432/grabspark"
    demo_session_secret: str = ""
    demo_date: date = date(2026, 11, 7)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
