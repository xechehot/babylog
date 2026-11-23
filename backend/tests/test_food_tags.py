"""Tests for allergen / food-group tags on `food` entries.

Semantics being pinned down:
- tags are a closed vocabulary: anything the LLM invents is dropped, not stored
- tags live on `food` entries only; other entry types always store NULL
- an empty list means "we looked and there was nothing" — distinct from NULL
  ("never tagged"), which is what the allergen panel uses to tell untagged
  history apart from a genuinely allergen-free meal
"""

import pytest

from app.database import get_db, init_db
from app.food_tags import ALLERGENS, FOOD_GROUPS, normalize_tags
from app.services.llm import validate_entries

DATE = "2026-11-18"


@pytest.fixture(autouse=True)
async def _init_schema():
    await init_db()


# --- normalize_tags ------------------------------------------------------------


def test_normalize_keeps_only_known_tags():
    assert normalize_tags(["milk", "unicorn", "egg"], ALLERGENS) == ["egg", "milk"]


def test_normalize_returns_canonical_order():
    """Order is the vocabulary order, so stored tags compare equal regardless of LLM order."""
    assert normalize_tags(["shellfish", "peanut", "gluten"], ALLERGENS) == [
        "peanut",
        "gluten",
        "shellfish",
    ]


def test_normalize_dedupes_and_lowercases():
    assert normalize_tags(["Milk", "milk", "MILK"], ALLERGENS) == ["milk"]


def test_normalize_accepts_bare_string():
    """The model sometimes returns a single tag instead of an array."""
    assert normalize_tags("egg", ALLERGENS) == ["egg"]


def test_normalize_empty_list_stays_empty():
    assert normalize_tags([], ALLERGENS) == []


def test_normalize_none_stays_none():
    assert normalize_tags(None, ALLERGENS) is None


def test_normalize_rejects_non_list():
    assert normalize_tags({"milk": True}, ALLERGENS) is None


def test_normalize_food_groups():
    assert normalize_tags(["produce", "protein", "nonsense"], FOOD_GROUPS) == [
        "protein",
        "produce",
    ]


# --- validate_entries ----------------------------------------------------------


def test_validate_keeps_food_tags():
    entries = validate_entries(
        [
            {
                "entry_type": "food",
                "subtype": None,
                "occurred_at": f"{DATE} 12:30",
                "notes": "моцарелла, голубика",
                "allergens": ["milk"],
                "food_groups": ["protein", "fat", "fiber", "produce"],
            }
        ]
    )
    assert entries[0]["allergens"] == ["milk"]
    assert entries[0]["food_groups"] == ["protein", "fat", "fiber", "produce"]


def test_validate_drops_tags_on_non_food_entries():
    """A feeding is milk, but it is not a solid-food milk exposure."""
    entries = validate_entries(
        [
            {
                "entry_type": "feeding",
                "subtype": "formula",
                "occurred_at": f"{DATE} 12:30",
                "allergens": ["milk"],
                "food_groups": ["protein"],
            }
        ]
    )
    assert entries[0]["allergens"] is None
    assert entries[0]["food_groups"] is None


def test_validate_food_without_tags_is_null():
    entries = validate_entries(
        [{"entry_type": "food", "occurred_at": f"{DATE} 12:30", "notes": "банан"}]
    )
    assert entries[0]["allergens"] is None
    assert entries[0]["food_groups"] is None


def test_validate_food_with_empty_tags_stays_empty():
    entries = validate_entries(
        [
            {
                "entry_type": "food",
                "occurred_at": f"{DATE} 12:30",
                "notes": "вода",
                "allergens": [],
                "food_groups": [],
            }
        ]
    )
    assert entries[0]["allergens"] == []
    assert entries[0]["food_groups"] == []


# --- API round-trip ------------------------------------------------------------


@pytest.mark.anyio
async def test_create_and_read_food_tags(client):
    resp = await client.post(
        "/api/entries",
        json={
            "entry_type": "food",
            "occurred_at": f"{DATE}T12:30:00",
            "notes": "хлеб, арахис, мандарин",
            "allergens": ["gluten", "peanut"],
            "food_groups": ["carbs", "produce"],
        },
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["allergens"] == ["peanut", "gluten"]
    assert created["food_groups"] == ["carbs", "produce"]

    listed = await client.get(
        "/api/entries", params={"type": "food", "from_date": DATE, "to_date": DATE}
    )
    assert listed.json()["entries"][0]["allergens"] == ["peanut", "gluten"]


@pytest.mark.anyio
async def test_create_drops_unknown_tags(client):
    resp = await client.post(
        "/api/entries",
        json={
            "entry_type": "food",
            "occurred_at": f"{DATE}T12:30:00",
            "notes": "орешки",
            "allergens": ["treenut", "egg"],
        },
    )
    assert resp.json()["allergens"] == ["egg"]


@pytest.mark.anyio
async def test_untagged_entry_reads_back_as_null(client):
    resp = await client.post(
        "/api/entries",
        json={"entry_type": "food", "occurred_at": f"{DATE}T12:30:00", "notes": "банан"},
    )
    assert resp.json()["allergens"] is None
    assert resp.json()["food_groups"] is None


@pytest.mark.anyio
async def test_patch_replaces_tags(client):
    created = await client.post(
        "/api/entries",
        json={
            "entry_type": "food",
            "occurred_at": f"{DATE}T12:30:00",
            "notes": "яйцо",
            "allergens": ["egg"],
        },
    )
    entry_id = created.json()["id"]

    patched = await client.patch(f"/api/entries/{entry_id}", json={"allergens": []})
    assert patched.status_code == 200
    assert patched.json()["allergens"] == [], "an empty patch means 'no allergens', not 'unchanged'"


# --- dashboard per-day counts --------------------------------------------------


async def _insert(entry_type: str, time: str, subtype: str | None = None) -> None:
    async with get_db() as db:
        await db.execute(
            "INSERT INTO entries (entry_type, subtype, occurred_at, date) VALUES (?, ?, ?, ?)",
            (entry_type, subtype, f"{DATE} {time}", DATE),
        )
        await db.commit()


@pytest.mark.anyio
async def test_dashboard_counts_food_and_pills_per_day(client):
    await _insert("food", "09:40")
    await _insert("food", "12:30")
    await _insert("food", "19:30")
    await _insert("pills", "10:00", "vigantol")
    await _insert("pills", "20:00")
    await _insert("feeding", "08:00", "breast")

    resp = await client.get("/api/dashboard", params={"from_date": DATE, "to_date": DATE})
    day = resp.json()["days"][0]

    assert day["food_count"] == 3
    assert day["pills_count"] == 2, "pills with no subtype still count as a medicine"
    assert day["feeding_count"] == 1


@pytest.mark.anyio
async def test_dashboard_zero_counts_when_only_other_types(client):
    await _insert("diaper", "08:00", "pee")

    resp = await client.get("/api/dashboard", params={"from_date": DATE, "to_date": DATE})
    day = resp.json()["days"][0]

    assert day["food_count"] == 0
    assert day["pills_count"] == 0
