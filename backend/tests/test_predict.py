"""API tests for the night feeding prediction endpoint."""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient

from tests.conftest import seed_entry

NOW = datetime(2026, 8, 5, 1, 15)
ENDPOINT = "/api/predict/next-feeding"


async def seed_nights(client: AsyncClient, count: int = 12) -> None:
    """Seed `count` nights of feedings whose gap grows with volume."""
    for k in range(count):
        t = (NOW - timedelta(days=2 + k)).replace(hour=21, minute=0)
        for j in range(3):
            ml = 80 + ((k + j) % 7) * 20
            await seed_entry(
                client,
                subtype="formula",
                occurred_at=t.isoformat(),
                date=t.strftime("%Y-%m-%d"),
                value=ml,
            )
            t = t + timedelta(hours=1.0 + 0.02 * ml)
        await seed_entry(
            client,
            subtype="formula",
            occurred_at=t.isoformat(),
            date=t.strftime("%Y-%m-%d"),
            value=100,
        )


@pytest.mark.asyncio
async def test_returns_insufficient_data_when_history_is_empty(client: AsyncClient):
    resp = await client.get(ENDPOINT, params={"at": NOW.isoformat(), "ml": 150})

    assert resp.status_code == 200
    body = resp.json()
    assert body["basis"] == "insufficient_data"
    assert body["predicted_at"] is None


@pytest.mark.asyncio
async def test_predicts_time_and_volume_from_seeded_history(client: AsyncClient):
    await seed_nights(client)

    resp = await client.get(ENDPOINT, params={"at": NOW.isoformat(), "ml": 150})

    assert resp.status_code == 200
    body = resp.json()
    assert body["basis"] in ("regression", "median_measured")
    predicted = datetime.fromisoformat(body["predicted_at"])
    assert predicted > NOW
    assert (predicted - NOW) <= timedelta(hours=8)
    assert body["sample_size"] > 0
    assert body["window_days"] == 30


@pytest.mark.asyncio
async def test_earliest_and_latest_bracket_the_prediction(client: AsyncClient):
    await seed_nights(client)

    resp = await client.get(ENDPOINT, params={"at": NOW.isoformat(), "ml": 150})

    body = resp.json()
    assert body["earliest_at"] <= body["predicted_at"] <= body["latest_at"]


@pytest.mark.asyncio
async def test_ml_is_optional(client: AsyncClient):
    await seed_nights(client)

    resp = await client.get(ENDPOINT, params={"at": NOW.isoformat()})

    assert resp.status_code == 200
    assert resp.json()["basis"] != "insufficient_data"


@pytest.mark.asyncio
async def test_larger_feed_predicts_a_later_next_feeding(client: AsyncClient):
    await seed_nights(client, count=20)

    small = await client.get(ENDPOINT, params={"at": NOW.isoformat(), "ml": 90})
    large = await client.get(ENDPOINT, params={"at": NOW.isoformat(), "ml": 190})

    assert small.json()["predicted_at"] < large.json()["predicted_at"]


@pytest.mark.asyncio
async def test_response_reports_the_period_it_used(client: AsyncClient):
    await seed_nights(client)

    night = await client.get(ENDPOINT, params={"at": NOW.isoformat(), "ml": 150})
    day_at = NOW.replace(hour=14, minute=0)
    day = await client.get(ENDPOINT, params={"at": day_at.isoformat(), "ml": 150})

    assert night.json()["period"] == "night"
    assert day.json()["period"] == "day"


@pytest.mark.asyncio
async def test_daytime_question_is_not_answered_from_night_history(client: AsyncClient):
    await seed_nights(client)  # night feeds only

    day_at = NOW.replace(hour=14, minute=0)
    resp = await client.get(ENDPOINT, params={"at": day_at.isoformat(), "ml": 150})

    assert resp.json()["basis"] == "insufficient_data"


@pytest.mark.asyncio
async def test_missing_at_parameter_is_rejected(client: AsyncClient):
    resp = await client.get(ENDPOINT)

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_negative_ml_is_rejected(client: AsyncClient):
    resp = await client.get(ENDPOINT, params={"at": NOW.isoformat(), "ml": -5})

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_diaper_and_weight_entries_do_not_affect_the_prediction(client: AsyncClient):
    await seed_nights(client)
    baseline = (await client.get(ENDPOINT, params={"at": NOW.isoformat(), "ml": 150})).json()

    noise_at = (NOW - timedelta(days=3)).replace(hour=2, minute=30)
    await seed_entry(
        client,
        entry_type="diaper",
        subtype="pee",
        occurred_at=noise_at.isoformat(),
        date=noise_at.strftime("%Y-%m-%d"),
        value=None,
    )
    await seed_entry(
        client,
        entry_type="weight",
        subtype=None,
        occurred_at=noise_at.isoformat(),
        date=noise_at.strftime("%Y-%m-%d"),
        value=6200,
    )

    after = (await client.get(ENDPOINT, params={"at": NOW.isoformat(), "ml": 150})).json()

    assert after["predicted_at"] == baseline["predicted_at"]
    assert after["sample_size"] == baseline["sample_size"]
