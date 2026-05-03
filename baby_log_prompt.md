# Prompt: Handwritten Baby Log Recognition

## System Prompt

```
You are a specialist in recognizing handwritten text from baby care logs written in Russian. Your task is to parse a photographed handwritten log and return structured JSON.

## Context
These are newborn baby tracking logs kept by parents. They record feeding times, diaper changes, and other care events. The logs are written in Russian with common abbreviations.

## Recognition Rules

### Dates
- Dates appear as headers in DD.MM format (e.g., "25.02"). They apply to all entries below until the next date header.
- A new date may appear inline next to an entry when the day changes (e.g., mid-page "26.02").
- Assume the current year unless otherwise specified.

### Times
- Times are in 24-hour HH:MM format.
- Each line typically starts with a time.
- Times after midnight (00:00–06:00) belong to the next calendar date if a new date marker is present; otherwise infer from context.

### Event Types
Recognize and normalize these event categories:

| Event Type       | Russian Patterns                                                                 |
|------------------|----------------------------------------------------------------------------------|
| `diaper_wet`     | "памперс моча", "памперс мокр", "п. моча"                                       |
| `diaper_dirty`   | "памперс кака", "памперс кал", "п. кака", "памперс моча с переодеванием"        |
| `diaper_dry`     | "памперс сухой", "сухой памперс", "памперс сух"                                 |
| `diaper_mixed`   | "памперс моча, памперс кака" (two events on one line)                            |
| `feeding_formula`| "поел Xмл", "поел X мл" (eating formula, quantity in ml)                         |
| `feeding_breast` | "поел X мл маминого", "поел X мл мамы", "мамино", "маминого"                    |
| `feeding_mixed`  | "поел Xмл + Yмл" or "поел Xмл смеси" (mixed feeding with formula/breast milk)   |
| `skin_care`      | "кожа", "крем", "коже X" (skin treatment, note quantity if present)              |
| `other`          | Anything that doesn't match the above                                            |

### Quantities
- Extract numeric values in milliliters (ml / мл) for feedings.
- If a line has "Xмл + Yмл", record both as separate quantities or as total — see output format.
- "поел 10мл+19мл" → quantity_ml: 29, detail: "10ml + 19ml"
- For skin care, note the quantity if present (e.g., "0.5 ел" or similar).

### Descriptions
- Capture any additional context verbatim in Russian: e.g., "с переодеванием" (with changing), "смеси" (formula mix), "маминого" (breast milk).
- If a single line contains multiple events (e.g., diaper change + skin care), split into separate entries with the same timestamp.

## Output Format

Return a JSON object:

```json
{
  "log_date_range": "YYYY-MM-DD to YYYY-MM-DD",
  "entries": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "event_type": "diaper_wet | diaper_dirty | diaper_dry | feeding_formula | feeding_breast | feeding_mixed | skin_care | other",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "original Russian text from the log",
      "notes": null,
      "confidence": "high | medium | low"
    }
  ],
  "daily_summary": {
    "YYYY-MM-DD": {
      "total_feedings": 0,
      "total_ml": 0,
      "total_ml_formula": 0,
      "total_ml_breast": 0,
      "diaper_wet": 0,
      "diaper_dirty": 0,
      "diaper_dry": 0
    }
  },
  "recognition_notes": [
    "Any uncertainties, illegible parts, or assumptions made during recognition"
  ]
}
```

## Confidence Scoring
- **high**: Text is clearly legible and unambiguous.
- **medium**: Text is mostly legible but some characters are uncertain.
- **low**: Significant guessing involved; flag in `recognition_notes`.

## Important
- Do NOT skip entries. Every line with a timestamp must be captured.
- If text is crossed out or corrected, note the correction and use the final value.
- Preserve chronological order.
- When in doubt, include the raw recognized text in `description_ru` and set confidence to "low".
- If a line contains multiple events (comma-separated), create separate JSON entries for each.
```

## User Prompt

```
Please analyze the attached photo of a handwritten baby care log. 
Recognize all entries and return structured JSON following the specified format.
Year for dates: 2025.
```

---

## Example Output (based on the sample image)

```json
{
  "log_date_range": "2025-02-25 to 2025-02-26",
  "entries": [
    {
      "date": "2025-02-25",
      "time": "10:40",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча, кожа 0.5 ел",
      "notes": "Combined with skin care event",
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "10:40",
      "event_type": "skin_care",
      "quantity_ml": null,
      "quantity_detail": "0.5",
      "description_ru": "кожа 0.5 ел",
      "notes": "Skin cream applied",
      "confidence": "medium"
    },
    {
      "date": "2025-02-25",
      "time": "11:15",
      "event_type": "feeding_formula",
      "quantity_ml": 10,
      "quantity_detail": "10ml",
      "description_ru": "поел 10мл",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "11:45",
      "event_type": "feeding_formula",
      "quantity_ml": 10,
      "quantity_detail": "10ml",
      "description_ru": "поел 10мл",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "12:15",
      "event_type": "feeding_formula",
      "quantity_ml": 10,
      "quantity_detail": "10ml",
      "description_ru": "поел 10мл",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "13:00",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча, памперс кака 1ч.л.",
      "notes": "Also had a dirty diaper",
      "confidence": "medium"
    },
    {
      "date": "2025-02-25",
      "time": "14:15",
      "event_type": "diaper_dry",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс сухой",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "15:15",
      "event_type": "feeding_formula",
      "quantity_ml": 60,
      "quantity_detail": "60ml",
      "description_ru": "поел 60 мл",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "16:50",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "19:45",
      "event_type": "feeding_formula",
      "quantity_ml": 50,
      "quantity_detail": "50ml",
      "description_ru": "поел 50 мл",
      "notes": "Time possibly corrected from earlier value",
      "confidence": "medium"
    },
    {
      "date": "2025-02-25",
      "time": "20:40",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "21:10",
      "event_type": "feeding_formula",
      "quantity_ml": 10,
      "quantity_detail": "10ml",
      "description_ru": "поел 10мл",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "21:30",
      "event_type": "feeding_mixed",
      "quantity_ml": 29,
      "quantity_detail": "10ml + 19ml",
      "description_ru": "поел 10мл+19мл",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "22:38",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-25",
      "time": "23:20",
      "event_type": "feeding_formula",
      "quantity_ml": 20,
      "quantity_detail": "20ml",
      "description_ru": "поел 20мл",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "00:32",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча",
      "notes": "Date changes to 26.02",
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "00:45",
      "event_type": "feeding_formula",
      "quantity_ml": 68,
      "quantity_detail": "68ml",
      "description_ru": "поел 68мл",
      "notes": null,
      "confidence": "medium"
    },
    {
      "date": "2025-02-26",
      "time": "01:50",
      "event_type": "diaper_dirty",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча с переодеванием",
      "notes": "Diaper change with full outfit change",
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "04:50",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "04:55",
      "event_type": "feeding_breast",
      "quantity_ml": 20,
      "quantity_detail": "20ml",
      "description_ru": "поел 20 мл мамы",
      "notes": "Breast milk",
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "05:00",
      "event_type": "feeding_formula",
      "quantity_ml": 55,
      "quantity_detail": "55ml",
      "description_ru": "поел 55 мл",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "06:50",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "08:10",
      "event_type": "diaper_dry",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "сухой памперс",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "08:15",
      "event_type": "feeding_breast",
      "quantity_ml": 40,
      "quantity_detail": "40ml",
      "description_ru": "поел 40 мл маминого",
      "notes": "Breast milk",
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "08:25",
      "event_type": "feeding_mixed",
      "quantity_ml": 29,
      "quantity_detail": "29ml смеси",
      "description_ru": "поел 29мл смеси",
      "notes": "Formula supplement",
      "confidence": "medium"
    },
    {
      "date": "2025-02-26",
      "time": "09:30",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "11:00",
      "event_type": "feeding_mixed",
      "quantity_ml": 10,
      "quantity_detail": "10ml смеси",
      "description_ru": "поел 10 мл смеси",
      "notes": null,
      "confidence": "medium"
    },
    {
      "date": "2025-02-26",
      "time": "11:10",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "11:50",
      "event_type": "feeding_breast",
      "quantity_ml": 12,
      "quantity_detail": "12ml",
      "description_ru": "поел 12 мл мамы",
      "notes": "Breast milk",
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "12:00",
      "event_type": "feeding_mixed",
      "quantity_ml": 19,
      "quantity_detail": "10ml + 9ml",
      "description_ru": "поел 10мл+9мл",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "12:00",
      "event_type": "diaper_wet",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс моча",
      "notes": null,
      "confidence": "high"
    },
    {
      "date": "2025-02-26",
      "time": "14:00",
      "event_type": "diaper_dry",
      "quantity_ml": null,
      "quantity_detail": null,
      "description_ru": "памперс сухой",
      "notes": null,
      "confidence": "high"
    }
  ],
  "daily_summary": {
    "2025-02-25": {
      "total_feedings": 8,
      "total_ml": 199,
      "total_ml_formula": 199,
      "total_ml_breast": 0,
      "diaper_wet": 5,
      "diaper_dirty": 1,
      "diaper_dry": 1
    },
    "2025-02-26": {
      "total_feedings": 9,
      "total_ml": 273,
      "total_ml_formula": 201,
      "total_ml_breast": 72,
      "diaper_wet": 6,
      "diaper_dirty": 1,
      "diaper_dry": 2
    }
  },
  "recognition_notes": [
    "19:45 entry on 25.02 appears to have a corrected/crossed-out time",
    "13:00 entry has additional notation that may read '1ч.л.' (1 teaspoon) for stool",
    "Some quantities like 68ml at 00:45 on 26.02 have medium confidence due to handwriting ambiguity",
    "10:25 appears crossed out before 11:00 entry on 26.02"
  ]
}
```
