import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_list_uploads_empty(client: AsyncClient):
    resp = await client.get("/api/uploads")
    assert resp.status_code == 200
    assert resp.json()["uploads"] == []


@pytest.mark.asyncio
async def test_create_upload(client: AsyncClient):
    with patch("app.routers.uploads.process_upload", new_callable=AsyncMock):
        resp = await client.post(
            "/api/uploads",
            files={"file": ("test.jpg", b"fake-image-data", "image/jpeg")},
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["filename"] == "test.jpg"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_create_upload_no_filename(client: AsyncClient):
    resp = await client.post(
        "/api/uploads",
        files={"file": ("", b"", "application/octet-stream")},
    )
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_list_uploads_after_create(client: AsyncClient):
    with patch("app.routers.uploads.process_upload", new_callable=AsyncMock):
        await client.post(
            "/api/uploads",
            files={"file": ("a.jpg", b"data", "image/jpeg")},
        )
        await client.post(
            "/api/uploads",
            files={"file": ("b.jpg", b"data", "image/jpeg")},
        )

    resp = await client.get("/api/uploads")
    assert resp.status_code == 200
    uploads = resp.json()["uploads"]
    assert len(uploads) == 2


@pytest.mark.asyncio
async def test_get_upload_detail(client: AsyncClient):
    with patch("app.routers.uploads.process_upload", new_callable=AsyncMock):
        create_resp = await client.post(
            "/api/uploads",
            files={"file": ("test.jpg", b"image-bytes", "image/jpeg")},
        )
    upload_id = create_resp.json()["id"]

    resp = await client.get(f"/api/uploads/{upload_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "test.jpg"
    assert data["entries"] == []


@pytest.mark.asyncio
async def test_get_upload_not_found(client: AsyncClient):
    resp = await client.get("/api/uploads/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_upload_image_not_found(client: AsyncClient):
    resp = await client.get("/api/uploads/9999/image")
    assert resp.status_code == 404
