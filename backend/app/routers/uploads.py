from fastapi import APIRouter

from app.models.upload import UploadDetailResponse, UploadListResponse, UploadResponse

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("", status_code=201)
async def create_upload() -> UploadResponse:
    return UploadResponse(id=0, filename="stub", status="pending", created_at="")


@router.get("")
async def list_uploads() -> UploadListResponse:
    return UploadListResponse(uploads=[])


@router.get("/{upload_id}")
async def get_upload(upload_id: int) -> UploadDetailResponse:
    return UploadDetailResponse(
        id=upload_id, filename="stub", filepath="", status="pending", created_at=""
    )


@router.post("/{upload_id}/reprocess")
async def reprocess_upload(upload_id: int) -> UploadResponse:
    return UploadResponse(id=upload_id, filename="stub", status="pending", created_at="")
