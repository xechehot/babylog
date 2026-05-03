"""Tests that the dashboard correctly reports diaper counts.

Key invariant: pee+poo entries are returned as their own count so the
frontend can add them to both wet (pee) and dirty (poo) totals.
Example: pee, pee, pee+poo, poo → pee_count=2, poo_count=1, pee_poo_count=1
  → frontend wet = 2+1 = 3, dirty = 1+1 = 2
"""

import pytest

from app.database import get_db, init_db

DATE = "2026-03-01"


async def _insert_diaper(subtype: str, time: str = "10:00") -> None:
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO entries (entry_type, subtype, occurred_at, date)
            VALUES ('diaper', ?, ?, ?)
            """,
            (subtype, f"{DATE} {time}", DATE),
        )
        await db.commit()


@pytest.fixture(autouse=True)
async def _init_schema():
    """Ensure DB schema exists before each test."""
    await init_db()


@pytest.mark.anyio
async def test_pee_poo_counted_separately(client):
    """pee+poo entries appear in diaper_pee_poo_count, not in pee or poo counts."""
    await _insert_diaper("pee", "08:00")
    await _insert_diaper("pee", "09:00")
    await _insert_diaper("pee+poo", "10:00")
    await _insert_diaper("poo", "11:00")

    resp = await client.get("/api/dashboard", params={"from_date": DATE, "to_date": DATE})
    assert resp.status_code == 200

    day = resp.json()["days"][0]
    assert day["diaper_pee_count"] == 2
    assert day["diaper_poo_count"] == 1
    assert day["diaper_pee_poo_count"] == 1


@pytest.mark.anyio
async def test_frontend_wet_dirty_totals(client):
    """Verify the math the frontend does: wet = pee + pee_poo, dirty = poo + pee_poo."""
    await _insert_diaper("pee", "08:00")
    await _insert_diaper("pee", "09:00")
    await _insert_diaper("pee+poo", "10:00")
    await _insert_diaper("poo", "11:00")

    resp = await client.get("/api/dashboard", params={"from_date": DATE, "to_date": DATE})
    day = resp.json()["days"][0]

    wet = day["diaper_pee_count"] + day["diaper_pee_poo_count"]
    dirty = day["diaper_poo_count"] + day["diaper_pee_poo_count"]

    assert wet == 3, "pee+poo should count toward wet total"
    assert dirty == 2, "pee+poo should count toward dirty total"


@pytest.mark.anyio
async def test_only_pee_poo_entries(client):
    """When all diapers are pee+poo, pee and poo raw counts are 0."""
    await _insert_diaper("pee+poo", "08:00")
    await _insert_diaper("pee+poo", "09:00")

    resp = await client.get("/api/dashboard", params={"from_date": DATE, "to_date": DATE})
    day = resp.json()["days"][0]

    assert day["diaper_pee_count"] == 0
    assert day["diaper_poo_count"] == 0
    assert day["diaper_pee_poo_count"] == 2

    # Frontend totals
    assert day["diaper_pee_count"] + day["diaper_pee_poo_count"] == 2
    assert day["diaper_poo_count"] + day["diaper_pee_poo_count"] == 2


@pytest.mark.anyio
async def test_no_diaper_entries(client):
    """Dashboard returns an empty days list when there are no entries."""
    resp = await client.get("/api/dashboard", params={"from_date": DATE, "to_date": DATE})
    assert resp.status_code == 200
    assert resp.json()["days"] == []


@pytest.mark.anyio
async def test_dry_diapers_excluded_from_wet_dirty(client):
    """Dry diapers don't affect wet or dirty counts."""
    await _insert_diaper("dry", "08:00")
    await _insert_diaper("pee", "09:00")

    resp = await client.get("/api/dashboard", params={"from_date": DATE, "to_date": DATE})
    day = resp.json()["days"][0]

    assert day["diaper_dry_count"] == 1
    assert day["diaper_pee_count"] == 1
    assert day["diaper_poo_count"] == 0
    assert day["diaper_pee_poo_count"] == 0
