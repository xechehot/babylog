from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    llm_provider: str = "anthropic"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_model: str = "claude-sonnet-4-20250514"
    # Default to an external location so multiple checkouts/worktrees share one data store.
    # Override via UPLOAD_DIR / DATABASE_PATH in .env. Leading ~ is expanded.
    upload_dir: str = "~/.babylog/uploads"
    database_path: str = "~/.babylog/data/babylog.db"
    backend_port: int = 3849
    frontend_url: str = "http://localhost:5174/babylog"

    @field_validator("upload_dir", "database_path", mode="after")
    @classmethod
    def _expand_path(cls, v: str) -> str:
        return str(Path(v).expanduser())

    @property
    def allow_origins(self) -> list[str]:
        from urllib.parse import urlparse

        origins = []
        for url in self.frontend_url.split(","):
            url = url.strip()
            if url:
                parsed = urlparse(url)
                origins.append(f"{parsed.scheme}://{parsed.netloc}")
        return origins


settings = Settings()
