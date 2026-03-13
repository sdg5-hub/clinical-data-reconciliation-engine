import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    environment: str
    cors_origins: list[str]
    api_key: str
    openai_api_key: str
    openai_model: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    raw_origins = os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return Settings(
        app_name=os.getenv("APP_NAME", "Clinical Data Reconciliation Engine"),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
        environment=os.getenv("APP_ENV", "development"),
        cors_origins=origins,
        api_key=os.getenv("APP_API_KEY", "clinical-demo-key"),
        openai_api_key=os.getenv("OPEN_API_KEY", ""),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    )
