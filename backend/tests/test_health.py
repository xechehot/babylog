import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_health_check_under_api_prefix(client: AsyncClient):
    """Tailscale Serve only forwards /api/*, so agents need the aliased path."""
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_openapi_schema_served_under_api_prefix(client: AsyncClient):
    resp = await client.get("/api/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()
    assert "/api/entries" in schema["paths"]
    assert "/api/dashboard" in schema["paths"]


@pytest.mark.asyncio
async def test_docs_served_under_api_prefix(client: AsyncClient):
    resp = await client.get("/api/docs")
    assert resp.status_code == 200
