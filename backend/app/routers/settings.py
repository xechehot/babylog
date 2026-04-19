from typing import Literal, cast

from fastapi import APIRouter

from app.database import get_db
from app.models.settings import SettingsResponse, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTING_KEYS = ("baby_name", "birth_date", "birth_weight", "sex")


@router.get("", response_model=SettingsResponse)
async def get_settings() -> SettingsResponse:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?)",
            SETTING_KEYS,
        )
        rows = await cursor.fetchall()
    raw: dict[str, str | None] = {row["key"]: row["value"] for row in rows}
    sex_raw = raw.get("sex")
    sex_val = cast("Literal['boy', 'girl']", sex_raw) if sex_raw in ("boy", "girl") else None
    return SettingsResponse(
        baby_name=raw.get("baby_name"),
        birth_date=raw.get("birth_date"),
        birth_weight=int(bw) if (bw := raw.get("birth_weight")) else None,
        sex=sex_val,
    )


@router.put("", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate) -> SettingsResponse:
    async with get_db() as db:
        for key in SETTING_KEYS:
            value = getattr(body, key)
            if value is not None:
                await db.execute(
                    "INSERT INTO settings (key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (key, str(value)),
                )
            else:
                await db.execute("DELETE FROM settings WHERE key = ?", (key,))
        await db.commit()
    return SettingsResponse(
        baby_name=body.baby_name,
        birth_date=body.birth_date,
        birth_weight=body.birth_weight,
        sex=body.sex,
    )
