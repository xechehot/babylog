"""Shared test fixtures: temp SQLite DB per test, async FastAPI client."""

import tempfile
from collections.abc import AsyncGenerator
from pathlib import Path
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.database import init_db
from app.main import app


@pytest.fixture(autouse=True)
def _tmp_settings(tmp_path: Path):
    """Patch settings so each test gets its own DB and upload dir."""
    db_path = str(tmp_path / "test.db")
    upload_dir = str(tmp_path / "uploads")
    Path(upload_dir).mkdir()

    test_settings = Settings(
        database_path=db_path,
        upload_dir=upload_dir,
        anthropic_api_key="test-key",
        llm_provider="anthropic",
    )
    with patch("app.database.settings", test_settings), patch(
        "app.config.settings", test_settings
    ), patch("app.routers.uploads.settings", test_settings):
        yield test_settings


@pytest_asyncio.fixture
async def db(_tmp_settings):
    """Initialize the DB schema for the current test."""
    await init_db()


@pytest_asyncio.fixture
async def client(db) -> AsyncGenerator[AsyncClient]:
    """Async HTTP client bound to the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def seed_entry(client: AsyncClient, **overrides) -> dict:
    """Helper: create an entry and return the JSON response."""
    data = {
        "entry_type": "feeding",
        "subtype": "breast",
        "occurred_at": "2026-03-10T08:00:00",
        "value": 60,
    }
    data.update(overrides)
    resp = await client.post("/api/entries", json=data)
    assert resp.status_code == 201
    return resp.json()
