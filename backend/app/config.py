from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    llm_provider: str = "anthropic"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_model: str = "claude-sonnet-4-20250514"
    upload_dir: str = "./uploads"
    database_path: str = "./babylog.db"
    backend_port: int = 3849
    frontend_url: str = "http://localhost:5174/babylog"

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
