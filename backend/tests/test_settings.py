import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_settings_defaults(client: AsyncClient):
    """GET /api/settings returns empty defaults."""
    resp = await client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["baby_name"] is None
    assert data["birth_date"] is None
    assert data["birth_weight"] is None


@pytest.mark.asyncio
async def test_put_and_get_roundtrip(client: AsyncClient):
    """PUT then GET returns the same values."""
    payload = {"baby_name": "Миша", "birth_date": "2026-01-15", "birth_weight": 3500}
    put_resp = await client.put("/api/settings", json=payload)
    assert put_resp.status_code == 200
    assert put_resp.json() == payload

    get_resp = await client.get("/api/settings")
    assert get_resp.status_code == 200
    assert get_resp.json() == payload


@pytest.mark.asyncio
async def test_partial_update(client: AsyncClient):
    """PUT with partial fields updates only those fields."""
    await client.put(
        "/api/settings",
        json={"baby_name": "Миша", "birth_date": "2026-01-15", "birth_weight": 3500},
    )
    # Update only name, clear others by sending None
    resp = await client.put(
        "/api/settings",
        json={"baby_name": "Саша", "birth_date": None, "birth_weight": None},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["baby_name"] == "Саша"
    assert data["birth_date"] is None
    assert data["birth_weight"] is None

    # Verify via GET
    get_resp = await client.get("/api/settings")
    assert get_resp.json()["baby_name"] == "Саша"
    assert get_resp.json()["birth_date"] is None


@pytest.mark.asyncio
async def test_clear_all_values(client: AsyncClient):
    """PUT with all None clears everything."""
    await client.put(
        "/api/settings",
        json={"baby_name": "Миша", "birth_date": "2026-01-15", "birth_weight": 3500},
    )
    resp = await client.put(
        "/api/settings",
        json={"baby_name": None, "birth_date": None, "birth_weight": None},
    )
    assert resp.status_code == 200
    assert resp.json() == {"baby_name": None, "birth_date": None, "birth_weight": None}


@pytest.mark.asyncio
async def test_invalid_birth_date_format(client: AsyncClient):
    """PUT with bad date format returns 422."""
    resp = await client.put("/api/settings", json={"birth_date": "15-01-2026"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_birth_weight_too_low(client: AsyncClient):
    """PUT with weight below 200 returns 422."""
    resp = await client.put("/api/settings", json={"birth_weight": 100})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_birth_weight_too_high(client: AsyncClient):
    """PUT with weight above 10000 returns 422."""
    resp = await client.put("/api/settings", json={"birth_weight": 15000})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_birth_weight_boundary_valid(client: AsyncClient):
    """PUT with boundary weights (200, 10000) succeeds."""
    resp = await client.put("/api/settings", json={"birth_weight": 200})
    assert resp.status_code == 200
    assert resp.json()["birth_weight"] == 200

    resp = await client.put("/api/settings", json={"birth_weight": 10000})
    assert resp.status_code == 200
    assert resp.json()["birth_weight"] == 10000
