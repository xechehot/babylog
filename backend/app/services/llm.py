import base64
import json
import logging
from datetime import datetime

import anthropic

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

| entry_type   | Russian Patterns                                                              |
|--------------|-------------------------------------------------------------------------------|
| feeding      | "поел Xмл", "поел X мл", any feeding entry with quantity in ml               |
| pee          | "памперс моча", "памперс мокр", "п. моча"                                    |
| poo          | "памперс кака", "памперс кал", "п. кака", "памперс моча с переодеванием"     |
| diaper_dry   | "памперс сухой", "сухой памперс", "памперс сух"                              |
| weight       | "вес", "взвешивание", with value in кг or гр                                  |

### Feedings
- Extract numeric values in milliliters (ml / мл).
- If breast milk ("маминого", "мамы", "мамино") → set notes="маминого"
- If formula ("смеси", "смесь") → set notes="смеси"
- IMPORTANT: Mixed feedings like "поел 10мл+19мл" must be split into TWO separate feeding entries:
  one with value=10 and one with value=19. If one component is breast milk and another is formula,
  label each accordingly in notes.
- "поел 40мл маминого + 29мл смеси" → two entries: {value: 40, notes: "маминого"} and {value: 29, notes: "смеси"}

### Weight
- "вес X кг" → value in grams (multiply kg by 1000)
- "вес X гр" or "вес Xг" → value in grams

### Diapers
- Wet diaper (pee): "памперс моча" → entry_type="pee", value=null
- Dirty diaper (poo): "памперс кака" → entry_type="poo", value=null
- Dry diaper: "памперс сухой" → entry_type="diaper_dry", value=null

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
  "entry_type": "feeding | pee | poo | weight | diaper_dry",
  "occurred_at": "YYYY-MM-DD HH:MM",
  "value": null,
  "notes": null,
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

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
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

        raw_text = response.content[0].text  # type: ignore[union-attr]
        logger.info("LLM raw response length: %d chars", len(raw_text))

        # Strip markdown fences if present
        text = raw_text.strip()
        if text.startswith("```"):
            # Remove opening fence (```json or ```)
            first_newline = text.index("\n")
            text = text[first_newline + 1 :]
            # Remove closing fence
            if text.endswith("```"):
                text = text[: -len("```")]
            text = text.strip()

        entries = json.loads(text)
        if not isinstance(entries, list):
            raise ValueError(f"Expected JSON array, got {type(entries).__name__}")

        valid_types = {"feeding", "pee", "poo", "weight", "diaper_dry"}
        validated = []
        for entry in entries:
            if entry.get("entry_type") not in valid_types:
                logger.warning("Skipping entry with unknown type: %s", entry.get("entry_type"))
                continue
            validated.append(
                {
                    "entry_type": entry["entry_type"],
                    "occurred_at": entry["occurred_at"],
                    "value": entry.get("value"),
                    "notes": entry.get("notes"),
                    "raw_text": entry.get("raw_text"),
                    "confidence": entry.get("confidence", "medium"),
                }
            )

        return validated
