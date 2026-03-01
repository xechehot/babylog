import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import get_db, init_db
from app.routers import dashboard, entries, uploads

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    await init_db()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    # Reset any uploads stuck in 'processing' back to 'pending'
    async with get_db() as db:
        await db.execute("UPDATE uploads SET status='pending' WHERE status='processing'")
        await db.commit()
    yield


app = FastAPI(
    title="babylog",
    description="Baby log parser and dashboard",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    logger.info(
        "%s %s %d %.0fms",
        request.method, request.url.path, response.status_code, duration_ms,
    )
    return response


app.include_router(uploads.router)
app.include_router(entries.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
