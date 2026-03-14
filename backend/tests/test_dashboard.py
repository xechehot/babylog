import pytest
from httpx import AsyncClient

from tests.conftest import seed_entry


@pytest.mark.asyncio
async def test_dashboard_empty(client: AsyncClient):
    resp = await client.get(
        "/api/dashboard", params={"from_date": "2026-03-10", "to_date": "2026-03-10"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["days"] == []
    assert data["latest_weight"] is None
    assert data["all_time_totals"] is None


@pytest.mark.asyncio
async def test_dashboard_feeding_aggregation(client: AsyncClient):
    await seed_entry(client, entry_type="feeding", subtype="breast", value=60, occurred_at="2026-03-10T08:00:00")
    await seed_entry(client, entry_type="feeding", subtype="formula", value=90, occurred_at="2026-03-10T12:00:00")

    resp = await client.get(
        "/api/dashboard", params={"from_date": "2026-03-10", "to_date": "2026-03-10"}
    )
    data = resp.json()
    assert len(data["days"]) == 1
    day = data["days"][0]
    assert day["date"] == "2026-03-10"
    assert day["feeding_total_ml"] == 150
    assert day["feeding_breast_ml"] == 60
    assert day["feeding_formula_ml"] == 90
    assert day["feeding_count"] == 2


@pytest.mark.asyncio
async def test_dashboard_diaper_aggregation(client: AsyncClient):
    await seed_entry(client, entry_type="diaper", subtype="pee", value=None, occurred_at="2026-03-10T08:00:00")
    await seed_entry(client, entry_type="diaper", subtype="poo", value=None, occurred_at="2026-03-10T10:00:00")
    await seed_entry(client, entry_type="diaper", subtype="pee+poo", value=None, occurred_at="2026-03-10T12:00:00")
    await seed_entry(client, entry_type="diaper", subtype="dry", value=None, occurred_at="2026-03-10T14:00:00")

    resp = await client.get(
        "/api/dashboard", params={"from_date": "2026-03-10", "to_date": "2026-03-10"}
    )
    day = resp.json()["days"][0]
    assert day["diaper_pee_count"] == 1
    assert day["diaper_poo_count"] == 1
    assert day["diaper_pee_poo_count"] == 1
    assert day["diaper_dry_count"] == 1


@pytest.mark.asyncio
async def test_dashboard_latest_weight(client: AsyncClient):
    await seed_entry(client, entry_type="weight", subtype=None, value=3400, occurred_at="2026-03-09T10:00:00")
    await seed_entry(client, entry_type="weight", subtype=None, value=3500, occurred_at="2026-03-10T10:00:00")

    resp = await client.get(
        "/api/dashboard", params={"from_date": "2026-03-09", "to_date": "2026-03-10"}
    )
    data = resp.json()
    assert data["latest_weight"]["value"] == 3500
    assert data["previous_weight"]["value"] == 3400


@pytest.mark.asyncio
async def test_dashboard_all_time_totals(client: AsyncClient):
    await seed_entry(client, entry_type="diaper", subtype="pee", value=None, occurred_at="2026-03-10T08:00:00")
    await seed_entry(client, entry_type="diaper", subtype="poo", value=None, occurred_at="2026-03-10T09:00:00")
    await seed_entry(client, entry_type="feeding", subtype="breast", value=60, occurred_at="2026-03-10T10:00:00")
    await seed_entry(client, entry_type="feeding", subtype="formula", value=90, occurred_at="2026-03-10T11:00:00")

    resp = await client.get(
        "/api/dashboard", params={"from_date": "2026-03-10", "to_date": "2026-03-10"}
    )
    totals = resp.json()["all_time_totals"]
    assert totals["diaper_total"] == 2
    assert totals["diaper_pee"] == 1
    assert totals["diaper_poo"] == 1
    assert totals["feeding_breast"] == 1
    assert totals["feeding_formula"] == 1


@pytest.mark.asyncio
async def test_dashboard_multi_day(client: AsyncClient):
    await seed_entry(client, entry_type="feeding", subtype="breast", value=50, occurred_at="2026-03-09T08:00:00")
    await seed_entry(client, entry_type="feeding", subtype="breast", value=70, occurred_at="2026-03-10T08:00:00")

    resp = await client.get(
        "/api/dashboard", params={"from_date": "2026-03-09", "to_date": "2026-03-10"}
    )
    days = resp.json()["days"]
    assert len(days) == 2
    assert days[0]["date"] == "2026-03-09"
    assert days[0]["feeding_total_ml"] == 50
    assert days[1]["date"] == "2026-03-10"
    assert days[1]["feeding_total_ml"] == 70
