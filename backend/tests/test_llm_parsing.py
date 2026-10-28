"""Tests for pulling the entries out of an LLM response."""

import json
from types import SimpleNamespace

import pytest

from app.services.llm import extract_json_array, extract_response_text, validate_entries


def text_block(text: str) -> SimpleNamespace:
    return SimpleNamespace(type="text", text=text)


def thinking_block() -> SimpleNamespace:
    """Sonnet 5 runs adaptive thinking by default, so responses lead with one of these."""
    return SimpleNamespace(type="thinking", thinking="")


ENTRIES_JSON = """[
  {
    "entry_type": "feeding",
    "subtype": "formula",
    "occurred_at": "2026-08-01 20:30",
    "value": 145,
    "notes": null,
    "raw_text": "20:30 поел 145 мл",
    "confidence": "high"
  },
  {
    "entry_type": "diaper",
    "subtype": "pee",
    "occurred_at": "2026-08-01 21:40",
    "value": null,
    "notes": null,
    "raw_text": "21:40 памперс моча",
    "confidence": "high"
  }
]"""


def test_plain_array():
    entries = extract_json_array(ENTRIES_JSON)
    assert len(entries) == 2
    assert entries[0]["entry_type"] == "feeding"


def test_markdown_fenced_array():
    entries = extract_json_array(f"```json\n{ENTRIES_JSON}\n```")
    assert len(entries) == 2


def test_prose_preamble_before_array():
    """The model narrates its reasoning on ambiguous pages before emitting JSON."""
    raw = (
        'I can see the header "1 авг" (1 August). Let me analyze the entries carefully.\n\n'
        "The entries appear to be somewhat out of chronological order on the page.\n"
        '"сосал пипо/пито/питю" = сосал пипо → breast feeding\n\n'
        f"{ENTRIES_JSON}"
    )
    entries = extract_json_array(raw)
    assert len(entries) == 2
    assert entries[1]["subtype"] == "pee"


def test_prose_preamble_and_fenced_array():
    raw = f"Here is my analysis of the page.\n\n```json\n{ENTRIES_JSON}\n```"
    entries = extract_json_array(raw)
    assert len(entries) == 2


def test_trailing_commentary_after_array():
    raw = f"{ENTRIES_JSON}\n\nNote: the 21:40 entry was hard to read."
    entries = extract_json_array(raw)
    assert len(entries) == 2


def test_preamble_containing_brackets():
    """Square brackets in the prose must not be mistaken for the array."""
    raw = f"Times [unclear] and [crossed out] appear on line 3.\n\n{ENTRIES_JSON}"
    entries = extract_json_array(raw)
    assert len(entries) == 2


def test_picks_largest_array_when_example_precedes_it():
    raw = f'Format reminder: ["entry_type", "subtype"]\n\n{ENTRIES_JSON}'
    entries = extract_json_array(raw)
    assert len(entries) == 2
    assert entries[0]["entry_type"] == "feeding"


def test_empty_array_is_valid():
    assert extract_json_array("[]") == []


def test_no_array_raises_with_preview():
    raw = "I'm unable to read this photo clearly enough to extract entries."
    with pytest.raises(ValueError) as exc:
        extract_json_array(raw)
    assert "unable to read this photo" in str(exc.value)


def test_json_object_instead_of_array_raises():
    raw = '{"entries": []}'
    with pytest.raises(ValueError):
        extract_json_array(raw)


def test_response_text_from_single_text_block():
    assert extract_response_text([text_block(ENTRIES_JSON)]) == ENTRIES_JSON


def test_response_text_skips_leading_thinking_block():
    blocks = [thinking_block(), text_block(ENTRIES_JSON)]
    assert extract_response_text(blocks) == ENTRIES_JSON


def test_response_text_joins_multiple_text_blocks():
    blocks = [thinking_block(), text_block("Analysis of the page."), text_block(ENTRIES_JSON)]
    assert extract_response_text(blocks) == f"Analysis of the page.\n{ENTRIES_JSON}"


def test_response_without_text_blocks_raises():
    with pytest.raises(ValueError):
        extract_response_text([thinking_block()])


def test_validate_keeps_food_entry():
    """Solids ("прикорм") come back as a food entry with the products in notes."""
    entries = validate_entries(
        [
            {
                "entry_type": "food",
                "subtype": None,
                "occurred_at": "2026-08-01 13:00",
                "value": None,
                "notes": "брокколи, яйцо, персик",
                "raw_text": "13:00 еда брокколи яйцо персик",
                "confidence": "high",
            }
        ]
    )
    assert len(entries) == 1
    assert entries[0]["entry_type"] == "food"
    assert entries[0]["notes"] == "брокколи, яйцо, персик"
    assert entries[0]["value"] is None


def test_validate_drops_unknown_entry_type():
    entries = validate_entries(
        [{"entry_type": "sleep", "occurred_at": "2026-08-01 13:00"}, *json.loads(ENTRIES_JSON)]
    )
    assert [e["entry_type"] for e in entries] == ["feeding", "diaper"]


def test_validate_defaults_confidence_to_medium():
    entries = validate_entries([{"entry_type": "food", "occurred_at": "2026-08-01 13:00"}])
    assert entries[0]["confidence"] == "medium"
