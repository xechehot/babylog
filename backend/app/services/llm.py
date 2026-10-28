import base64
import json
import logging
from datetime import datetime

import anthropic
from anthropic.types import OutputConfigParam

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialist in recognizing handwritten text from baby care logs written in Russian.
Your task is to parse a photographed handwritten log and return structured JSON.

## Context
These are newborn baby tracking logs kept by parents. They record feeding times, diaper changes,
weight measurements, and other care events. The logs are written in Russian with common abbreviations.

## Recognition Rules

### Dates
- Dates appear as headers in DD.MM format (e.g., "25.02"). They apply to all entries below until the next date header.
- A new date may appear inline next to an entry when the day changes.
- Use the year provided by the user.

### Times
- Times are in 24-hour HH:MM format.
- Each line typically starts with a time.
- Times after midnight (00:00–06:00) belong to the next calendar date if a new date marker is present; otherwise infer from context.

### Event Types

There are exactly 5 entry types: `feeding`, `diaper`, `weight`, `pills`, `food`. Each entry also has a `subtype` field.

| entry_type | subtype    | Russian Patterns                                                          |
|------------|------------|---------------------------------------------------------------------------|
| feeding    | breast     | "маминого", "мамы", "мамино", "сосал(а) титю/тити/пипо/грудь/сисю/сиси"   |
| feeding    | formula    | "смеси", "смесь", or any feeding without explicit breast milk mention     |
| diaper     | pee        | "памперс моча", "памперс мокр", "п. моча"                                |
| diaper     | poo        | "памперс кака", "памперс кал", "п. кака" (always with "памперс"/"п.")    |
| diaper     | dry        | "памперс сухой", "сухой памперс", "памперс сух"                          |
| diaper     | pee+poo    | "памперс моча кака", both pee and poo on one diaper line                  |
| weight     | null       | "вес", "взвешивание", with value in кг or гр                              |
| pills      | vigantol   | "вигантол", "витамин д", "витамин D", "vit. D", "вит. д"                  |
| food       | null       | "еда", "прикорм", "каша", "пюре", followed by product names                |

### Feedings
- Extract numeric values in milliliters (ml / мл).
- If breast milk → subtype="breast". Breast milk markers include:
  - "маминого", "мамы", "мамино"
  - "сосал"/"сосала" followed by: "титю", "тити", "пипо", "грудь", "сисю", "сиси" (and similar diminutives for breast)
  - Breast feedings typically have no ml value.
- If formula ("смеси", "смесь") or no explicit mention of breast milk → subtype="formula"
- IMPORTANT disambiguation: breast feedings are much more frequent than poo diapers.
  If a line contains "сосал(а) …" without "памперс"/"п.", it is a breast feeding, NOT a poo diaper.
  Poo diapers ALWAYS include "памперс" or "п." together with "кака"/"кал".
- IMPORTANT: Mixed feedings like "поел 10мл+19мл" must be split into TWO separate feeding entries:
  one with value=10 and one with value=19. If one component is breast milk and another is formula,
  set the appropriate subtype for each.
- "поел 40мл маминого + 29мл смеси" → two entries: {value: 40, subtype: "breast"} and {value: 29, subtype: "formula"}
- When a feeding has no indication of type, default subtype to "formula".

### Weight
- "вес X кг" → value in grams (multiply kg by 1000)
- "вес X гр" or "вес Xг" → value in grams
- subtype is always null for weight entries.

### Diapers
- Wet diaper (pee): "памперс моча" → entry_type="diaper", subtype="pee", value=null
- Dirty diaper (poo): "памперс кака" → entry_type="diaper", subtype="poo", value=null
- Dry diaper: "памперс сухой" → entry_type="diaper", subtype="dry", value=null
- Both pee and poo: "памперс моча кака" → entry_type="diaper", subtype="pee+poo", value=null

### Pills / Vitamins
- Vigantol / Vitamin D: "вигантол", "витамин д", "витамин D", "vit. D", "вит. д"
  → entry_type="pills", subtype="vigantol", value=null
- A numeric dose next to the mention (e.g. "2 капли", "1 drop") may be placed in `notes`, not `value`.
- If a pill/vitamin is mentioned but doesn't match any known subtype above, still use entry_type="pills"
  with subtype=null and put the raw name in `notes`.

### Food (прикорм / solids)
- Solid food given to the baby, written as the word "еда" / "прикорм" / "каша" / "пюре" followed by
  a list of products: "еда брокколи яйцо персик", "прикорм кабачок".
  → entry_type="food", subtype=null, value=null
- Put the products in `notes` as a comma-separated lowercase list in Russian, without the leading
  word "еда"/"прикорм": "еда брокколи яйцо персик" → notes="брокколи, яйцо, персик"
- If an amount is written ("50 гр каши", "2 ложки пюре"), keep it inside the `notes` text and leave
  value=null.
- Do NOT confuse with `feeding`: `feeding` is milk or formula measured in ml; `food` is solids and
  never carries a ml value.

### Multiple Events
- If a single line contains multiple events (comma-separated or otherwise), create separate entries for each.

## Confidence Scoring
- **high**: Text is clearly legible and unambiguous.
- **medium**: Text is mostly legible but some characters are uncertain.
- **low**: Significant guessing involved.

## Output Format

Return ONLY a JSON array (no wrapping object, no markdown fences). Each element:

```json
{
  "entry_type": "feeding | diaper | weight | pills | food",
  "subtype": "breast | formula | pee | poo | dry | pee+poo | vigantol | null",
  "occurred_at": "YYYY-MM-DD HH:MM",
  "value": null,
  "notes": "for food entries: the comma-separated product list; otherwise null",
  "raw_text": "original recognized Russian text for this entry",
  "confidence": "high | medium | low"
}
```

## Important
- Do NOT skip entries. Every line with a timestamp must be captured.
- If text is crossed out or corrected, use the final value.
- Preserve chronological order.
- When in doubt, include the raw recognized text in raw_text and set confidence to "low".
- Return ONLY the JSON array. No explanation, no markdown fences, no wrapper object.
"""


def extract_response_text(content: list) -> str:
    """Join the text blocks of a response.

    Models with thinking enabled (the default on Sonnet 5) put a thinking block first, so
    the text is not necessarily the first block.
    """
    texts = [block.text for block in content if getattr(block, "type", None) == "text"]
    if not texts:
        types = [getattr(block, "type", "?") for block in content]
        raise ValueError(f"LLM response contained no text block (got {types})")
    return "\n".join(texts)


def extract_json_array(raw_text: str) -> list:
    """Pull the entries array out of an LLM response.

    On ambiguous pages the model narrates its reasoning before emitting the array, and it
    sometimes wraps the array in markdown fences, so a plain json.loads is not enough.
    """
    text = raw_text.strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        pass
    else:
        if not isinstance(parsed, list):
            raise ValueError(f"Expected JSON array, got {type(parsed).__name__}")
        return parsed

    decoder = json.JSONDecoder()
    candidates = []
    for idx, char in enumerate(text):
        if char != "[":
            continue
        try:
            value, end = decoder.raw_decode(text, idx)
        except json.JSONDecodeError:
            continue
        candidates.append((value, end - idx))

    # Prefer arrays of objects: prose can contain arrays of bare strings that are valid JSON.
    entry_arrays = [c for c in candidates if c[0] and all(isinstance(e, dict) for e in c[0])]
    best = max(entry_arrays or candidates, key=lambda c: c[1], default=None)
    if best is None:
        raise ValueError(f"No JSON array found in LLM response: {text[:300]!r}")
    return best[0]


VALID_ENTRY_TYPES = {"feeding", "diaper", "weight", "pills", "food"}


def validate_entries(entries: list) -> list[dict]:
    """Drop entries the model invented a type for and normalize the remaining fields."""
    validated = []
    for entry in entries:
        if entry.get("entry_type") not in VALID_ENTRY_TYPES:
            logger.warning("Skipping entry with unknown type: %s", entry.get("entry_type"))
            continue
        validated.append(
            {
                "entry_type": entry["entry_type"],
                "subtype": entry.get("subtype"),
                "occurred_at": entry["occurred_at"],
                "value": entry.get("value"),
                "notes": entry.get("notes"),
                "raw_text": entry.get("raw_text"),
                "confidence": entry.get("confidence", "medium"),
            }
        )
    return validated


class LLMService:
    def __init__(self) -> None:
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.llm_model

    async def parse_image(
        self, image_bytes: bytes, mime_type: str, year: int | None = None
    ) -> list[dict]:
        if year is None:
            year = datetime.now().year

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        user_prompt = (
            "Please analyze the attached photo of a handwritten baby care log. "
            "Recognize all entries and return structured JSON following the specified format.\n"
            f"Year for dates: {year}."
        )

        # max_tokens caps thinking + response text together, and adaptive thinking is on
        # by default on Sonnet 5 — leave generous headroom so the JSON array can't truncate.
        # Effort "medium" matches the entry extraction of the default "high" on this task
        # at roughly half the output tokens and latency.
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=16000,
            output_config=OutputConfigParam(effort="medium"),
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {  # type: ignore[list-item]
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": user_prompt,
                        },
                    ],
                }
            ],
        )

        # Checked before extract_response_text: a refusal can carry no text block at all,
        # which would otherwise surface as a misleading "no text block" error.
        if response.stop_reason == "refusal":
            raise ValueError(f"LLM refused the request: {response.stop_details}")

        raw_text = extract_response_text(response.content)
        logger.info(
            "LLM raw response: length=%d chars stop_reason=%s blocks=%s",
            len(raw_text),
            response.stop_reason,
            [block.type for block in response.content],
        )

        if response.stop_reason == "max_tokens":
            raise ValueError(
                f"LLM response truncated at max_tokens after {len(raw_text)} chars of text"
            )

        if not raw_text.lstrip().startswith("["):
            logger.info("LLM response does not start with the JSON array; extracting it")

        try:
            entries = extract_json_array(raw_text)
        except ValueError:
            logger.error("Unparseable LLM response (%d chars): %s", len(raw_text), raw_text[:1000])
            raise

        return validate_entries(entries)
