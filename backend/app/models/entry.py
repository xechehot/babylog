from pydantic import BaseModel


class EntryCreate(BaseModel):
    entry_type: str
    subtype: str | None = None
    occurred_at: str
    value: float | None = None
    notes: str | None = None
    confidence: str | None = None
    raw_text: str | None = None


class EntryUpdate(BaseModel):
    entry_type: str | None = None
    subtype: str | None = None
    occurred_at: str | None = None
    value: float | None = None
    notes: str | None = None
    confirmed: bool | None = None


class EntryResponse(BaseModel):
    id: int
    upload_id: int | None = None
    entry_type: str
    subtype: str | None = None
    occurred_at: str
    date: str
    value: float | None = None
    notes: str | None = None
    confidence: str | None = None
    raw_text: str | None = None
    confirmed: bool = False
    created_at: str
    updated_at: str


class EntryListResponse(BaseModel):
    entries: list[EntryResponse]
