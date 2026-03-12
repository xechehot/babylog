import pytest
from httpx import AsyncClient


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
async def test_dashboard_with_entries(client: AsyncClient):
    # Insert feedings and diapers
    for hour, subtype, value in [(8, "breast", 120), (10, "formula", 90)]:
        await client.post(
            "/api/entries",
            json={
                "entry_type": "feeding",
                "subtype": subtype,
                "occurred_at": f"2026-03-10T{hour:02d}:00:00",
                "value": value,
            },
        )

    await client.post(
        "/api/entries",
        json={
            "entry_type": "diaper",
            "subtype": "pee+poo",
            "occurred_at": "2026-03-10T09:00:00",
        },
    )

    resp = await client.get(
        "/api/dashboard", params={"from_date": "2026-03-10", "to_date": "2026-03-10"}
    )
    data = resp.json()
    assert len(data["days"]) == 1
    day = data["days"][0]
    assert day["date"] == "2026-03-10"
    assert day["feeding_count"] == 2
    assert day["feeding_total_ml"] == 210
    assert day["feeding_breast_ml"] == 120
    assert day["feeding_formula_ml"] == 90
    assert day["diaper_pee_poo_count"] == 1


@pytest.mark.asyncio
async def test_dashboard_weight(client: AsyncClient):
    await client.post(
        "/api/entries",
        json={
            "entry_type": "weight",
            "occurred_at": "2026-03-08T10:00:00",
            "value": 3500,
        },
    )
    await client.post(
        "/api/entries",
        json={
            "entry_type": "weight",
            "occurred_at": "2026-03-10T10:00:00",
            "value": 3600,
        },
    )

    resp = await client.get(
        "/api/dashboard", params={"from_date": "2026-03-10", "to_date": "2026-03-10"}
    )
    data = resp.json()
    assert data["latest_weight"]["value"] == 3600
    assert data["previous_weight"]["value"] == 3500
