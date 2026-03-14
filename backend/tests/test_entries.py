import pytest
from httpx import AsyncClient

from tests.conftest import seed_entry


@pytest.mark.asyncio
async def test_create_feeding_entry(client: AsyncClient):
    entry = await seed_entry(client)
    assert entry["entry_type"] == "feeding"
    assert entry["subtype"] == "breast"
    assert entry["value"] == 60
    assert entry["date"] == "2026-03-10"
    assert entry["confirmed"] is False


@pytest.mark.asyncio
async def test_create_diaper_entry(client: AsyncClient):
    entry = await seed_entry(
        client,
        entry_type="diaper",
        subtype="pee+poo",
        occurred_at="2026-03-10T09:00:00",
        value=None,
    )
    assert entry["entry_type"] == "diaper"
    assert entry["subtype"] == "pee+poo"
    assert entry["value"] is None


@pytest.mark.asyncio
async def test_create_weight_entry(client: AsyncClient):
    entry = await seed_entry(
        client,
        entry_type="weight",
        subtype=None,
        occurred_at="2026-03-10T10:00:00",
        value=3500,
    )
    assert entry["entry_type"] == "weight"
    assert entry["value"] == 3500


@pytest.mark.asyncio
async def test_list_entries_default_range(client: AsyncClient):
    await seed_entry(client, occurred_at="2026-03-10T08:00:00")
    await seed_entry(client, occurred_at="2026-03-10T09:00:00")

    resp = await client.get("/api/entries", params={"from_date": "2026-03-10", "to_date": "2026-03-10"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["entries"]) == 2


@pytest.mark.asyncio
async def test_list_entries_filter_by_type(client: AsyncClient):
    await seed_entry(client, entry_type="feeding", occurred_at="2026-03-10T08:00:00")
    await seed_entry(
        client, entry_type="diaper", subtype="pee", occurred_at="2026-03-10T09:00:00", value=None
    )

    resp = await client.get(
        "/api/entries", params={"from_date": "2026-03-10", "to_date": "2026-03-10", "type": "diaper"}
    )
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["entry_type"] == "diaper"


@pytest.mark.asyncio
async def test_update_entry(client: AsyncClient):
    entry = await seed_entry(client)
    entry_id = entry["id"]

    resp = await client.patch(f"/api/entries/{entry_id}", json={"value": 90, "confirmed": True})
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["value"] == 90
    assert updated["confirmed"] is True


@pytest.mark.asyncio
async def test_update_nonexistent_entry(client: AsyncClient):
    resp = await client.patch("/api/entries/9999", json={"value": 10})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_entry(client: AsyncClient):
    entry = await seed_entry(client)
    entry_id = entry["id"]

    resp = await client.delete(f"/api/entries/{entry_id}")
    assert resp.status_code == 204

    resp = await client.get(
        "/api/entries", params={"from_date": "2026-03-10", "to_date": "2026-03-10"}
    )
    assert len(resp.json()["entries"]) == 0


@pytest.mark.asyncio
async def test_delete_nonexistent_entry(client: AsyncClient):
    resp = await client.delete("/api/entries/9999")
    assert resp.status_code == 404
