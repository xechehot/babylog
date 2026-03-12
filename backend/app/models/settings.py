from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    baby_name: str | None = None
    birth_date: str | None = None  # YYYY-MM-DD
    birth_weight: int | None = None  # grams


class SettingsResponse(BaseModel):
    baby_name: str | None = None
    birth_date: str | None = None
    birth_weight: int | None = None
