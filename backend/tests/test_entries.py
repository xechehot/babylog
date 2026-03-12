import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_entry(client: AsyncClient):
    resp = await client.post(
        "/api/entries",
        json={
            "entry_type": "feeding",
            "subtype": "breast",
            "occurred_at": "2026-03-10T08:30:00",
            "value": 120,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["entry_type"] == "feeding"
    assert data["subtype"] == "breast"
    assert data["value"] == 120
    assert data["date"] == "2026-03-10"
    assert data["confirmed"] is False


@pytest.mark.asyncio
async def test_list_entries(client: AsyncClient):
    # Create two entries on different dates
    await client.post(
        "/api/entries",
        json={
            "entry_type": "feeding",
            "subtype": "formula",
            "occurred_at": "2026-03-10T10:00:00",
            "value": 90,
        },
    )
    await client.post(
        "/api/entries",
        json={
            "entry_type": "diaper",
            "subtype": "pee",
            "occurred_at": "2026-03-10T11:00:00",
        },
    )

    resp = await client.get(
        "/api/entries", params={"from_date": "2026-03-10", "to_date": "2026-03-10"}
    )
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert len(entries) == 2


@pytest.mark.asyncio
async def test_list_entries_filter_by_type(client: AsyncClient):
    await client.post(
        "/api/entries",
        json={
            "entry_type": "feeding",
            "subtype": "breast",
            "occurred_at": "2026-03-10T08:00:00",
            "value": 100,
        },
    )
    await client.post(
        "/api/entries",
        json={
            "entry_type": "diaper",
            "subtype": "poo",
            "occurred_at": "2026-03-10T09:00:00",
        },
    )

    resp = await client.get(
        "/api/entries",
        params={"from_date": "2026-03-10", "to_date": "2026-03-10", "type": "feeding"},
    )
    entries = resp.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["entry_type"] == "feeding"


@pytest.mark.asyncio
async def test_update_entry(client: AsyncClient):
    create_resp = await client.post(
        "/api/entries",
        json={
            "entry_type": "feeding",
            "subtype": "breast",
            "occurred_at": "2026-03-10T08:00:00",
            "value": 100,
        },
    )
    entry_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/entries/{entry_id}",
        json={"value": 150, "confirmed": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["value"] == 150
    assert data["confirmed"] is True


@pytest.mark.asyncio
async def test_update_entry_not_found(client: AsyncClient):
    resp = await client.patch("/api/entries/9999", json={"value": 100})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_entry(client: AsyncClient):
    create_resp = await client.post(
        "/api/entries",
        json={
            "entry_type": "diaper",
            "subtype": "dry",
            "occurred_at": "2026-03-10T12:00:00",
        },
    )
    entry_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/entries/{entry_id}")
    assert resp.status_code == 204

    # Verify it's gone
    resp = await client.get(
        "/api/entries", params={"from_date": "2026-03-10", "to_date": "2026-03-10"}
    )
    assert len(resp.json()["entries"]) == 0


@pytest.mark.asyncio
async def test_delete_entry_not_found(client: AsyncClient):
    resp = await client.delete("/api/entries/9999")
    assert resp.status_code == 404
