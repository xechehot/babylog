from pydantic import BaseModel


class UploadResponse(BaseModel):
    id: int
    filename: str
    status: str
    created_at: str


class UploadListItem(BaseModel):
    id: int
    filename: str
    status: str
    error_message: str | None = None
    entry_count: int = 0
    created_at: str
    processed_at: str | None = None


class UploadListResponse(BaseModel):
    uploads: list[UploadListItem]


class UploadDetailResponse(BaseModel):
    id: int
    filename: str
    filepath: str
    status: str
    error_message: str | None = None
    created_at: str
    processed_at: str | None = None
    entries: list[dict] = []
