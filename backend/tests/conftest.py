from collections.abc import AsyncGenerator
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import init_db
from app.main import app


@pytest.fixture()
async def tmp_db(tmp_path: Path) -> AsyncGenerator[str]:
    """Create a temporary SQLite database for each test."""
    db_path = str(tmp_path / "test.db")
    upload_dir = str(tmp_path / "uploads")
    Path(upload_dir).mkdir()

    with (
        patch("app.database.settings") as db_settings,
        patch("app.config.settings") as cfg_settings,
        patch("app.routers.uploads.settings") as upload_settings,
    ):
        for s in (db_settings, cfg_settings, upload_settings):
            s.database_path = db_path
            s.upload_dir = upload_dir
            s.llm_provider = "anthropic"
            s.anthropic_api_key = "test-key"
            s.openai_api_key = ""
            s.llm_model = "test-model"
            s.backend_port = 3849
            s.frontend_url = "http://localhost:5174"
            s.allow_origins = ["http://localhost:5174"]

        await init_db()
        yield db_path


@pytest.fixture()
async def client(tmp_db: str) -> AsyncGenerator[AsyncClient]:
    """Async HTTP client wired to the FastAPI app with a temp DB."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
