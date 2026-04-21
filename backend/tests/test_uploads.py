from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.database import get_db


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


@pytest.mark.asyncio
async def test_delete_upload_removes_entries_and_file(client: AsyncClient, _tmp_settings):
    with patch("app.routers.uploads.process_upload", new_callable=AsyncMock):
        create_resp = await client.post(
            "/api/uploads",
            files={"file": ("wipe.jpg", b"image-bytes", "image/jpeg")},
        )
    upload_id = create_resp.json()["id"]

    # Locate the saved file and seed an entry tied to this upload.
    async with get_db() as db:
        cursor = await db.execute("SELECT filepath FROM uploads WHERE id=?", (upload_id,))
        row = await cursor.fetchone()
        assert row is not None
        filepath = Path(row["filepath"])
    assert filepath.exists()

    seed_resp = await client.post(
        "/api/entries",
        json={
            "entry_type": "feeding",
            "subtype": "breast",
            "occurred_at": "2026-04-21T08:00:00",
            "value": 60,
            "upload_id": upload_id,
        },
    )
    assert seed_resp.status_code == 201

    resp = await client.delete(f"/api/uploads/{upload_id}")
    assert resp.status_code == 204

    # Upload gone, entries gone, file gone.
    assert (await client.get(f"/api/uploads/{upload_id}")).status_code == 404
    entries = (await client.get("/api/entries")).json()["entries"]
    assert all(e["upload_id"] != upload_id for e in entries)
    assert not filepath.exists()


@pytest.mark.asyncio
async def test_delete_upload_not_found(client: AsyncClient):
    resp = await client.delete("/api/uploads/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_upload_missing_file_succeeds(client: AsyncClient):
    with patch("app.routers.uploads.process_upload", new_callable=AsyncMock):
        create_resp = await client.post(
            "/api/uploads",
            files={"file": ("ghost.jpg", b"bytes", "image/jpeg")},
        )
    upload_id = create_resp.json()["id"]

    async with get_db() as db:
        cursor = await db.execute("SELECT filepath FROM uploads WHERE id=?", (upload_id,))
        row = await cursor.fetchone()
        assert row is not None
    Path(row["filepath"]).unlink()

    resp = await client.delete(f"/api/uploads/{upload_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_reprocess_upload_clears_entries_and_requeues(client: AsyncClient):
    with patch("app.routers.uploads.process_upload", new_callable=AsyncMock) as mock_proc:
        create_resp = await client.post(
            "/api/uploads",
            files={"file": ("rescan.jpg", b"image-bytes", "image/jpeg")},
        )
        upload_id = create_resp.json()["id"]

        # Mark upload done and seed an entry so we can verify it gets wiped.
        async with get_db() as db:
            await db.execute("UPDATE uploads SET status='done' WHERE id=?", (upload_id,))
            await db.commit()

        seed_resp = await client.post(
            "/api/entries",
            json={
                "entry_type": "feeding",
                "subtype": "formula",
                "occurred_at": "2026-04-21T09:00:00",
                "value": 80,
                "upload_id": upload_id,
            },
        )
        assert seed_resp.status_code == 201

        mock_proc.reset_mock()
        resp = await client.post(f"/api/uploads/{upload_id}/reprocess")
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"
        mock_proc.assert_called_once_with(upload_id)

    detail = (await client.get(f"/api/uploads/{upload_id}")).json()
    assert detail["entries"] == []
    assert detail["status"] == "pending"
    assert detail["error_message"] is None


@pytest.mark.asyncio
async def test_reprocess_upload_rejects_pending(client: AsyncClient):
    with patch("app.routers.uploads.process_upload", new_callable=AsyncMock):
        create_resp = await client.post(
            "/api/uploads",
            files={"file": ("pending.jpg", b"data", "image/jpeg")},
        )
    upload_id = create_resp.json()["id"]

    resp = await client.post(f"/api/uploads/{upload_id}/reprocess")
    assert resp.status_code == 400
