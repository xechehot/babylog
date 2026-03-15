# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules

- When asked to implement a feature, start coding immediately if a plan/spec is provided. Do not spend time exploring the codebase or writing a plan unless explicitly asked.
- Always commit and push after completing implementation unless told otherwise. The typical workflow is: implement → build/test → commit → push.

## What is babylog

A full-stack app that turns photos of handwritten baby logs (in Russian) into structured data. Parents photograph paper notes tracking feedings, diaper changes, and weight — an LLM (Claude/OpenAI vision API) extracts entries, which are then reviewed and visualized on a dashboard. Single-user, no auth (Tailscale handles network security), SQLite storage.

## Development Commands

### Backend (FastAPI + Python 3.12+ with uv)
```bash
cd backend
uv run fastapi dev app/main.py --host 0.0.0.0 --port 3849
```
Requires `.env` file (copy from `.env.example`, set `ANTHROPIC_API_KEY`).

Lint: `cd backend && uv run ruff check app/`
Format: `cd backend && uv run ruff format app/`
Type check: `cd backend && uv run mypy app/`
Tests: `cd backend && uv run pytest`
Single test: `cd backend && uv run pytest tests/test_dashboard_diapers.py::test_name -v`

Tests use `httpx.AsyncClient` with `ASGITransport`, auto-patched to a temp SQLite DB per test (see `conftest.py`).

### Build & Test

This is a TypeScript-primary project with a Python backend. Always run `npm run build` (or equivalent) after frontend changes and `uv run pytest` after backend changes before committing.

### Frontend (React 19 + Vite 7 + TypeScript)
```bash
cd frontend
npm install
npm run dev        # dev server on port 5174
npm run build      # tsc -b && vite build
```

## Architecture

### Data Flow
Upload photo → `POST /api/uploads` → saved to disk, DB record created (status=pending) → FastAPI `BackgroundTask` calls `process_upload` → image sent to LLM vision API → JSON array of entries parsed → entries inserted in DB → status=done. On startup, any stuck `processing` uploads are reset to `pending`.

### Entry Types (differs from original spec)
- `feeding` with subtype `breast` | `formula` — value in ml
- `diaper` with subtype `pee` | `poo` | `dry` | `pee+poo` — no value
- `weight` — value in grams (displayed as kg in UI)

Entries also carry `confidence` (high/medium/low), `raw_text` from LLM parsing, and `confirmed` (bool, default false — toggled by user on Review page).

### Backend Structure
- `app/main.py` — FastAPI app, CORS, lifespan (DB init + crash recovery), mounts routers
- `app/config.py` — Pydantic Settings from `.env` (LLM provider, keys, paths, CORS origins)
- `app/database.py` — async SQLite via aiosqlite, WAL mode, schema init, `get_db()` context manager
- `app/routers/` — uploads, entries, dashboard endpoints under `/api`
- `app/services/llm.py` — LLM provider abstraction (Anthropic/OpenAI), system prompt for Russian handwriting parsing
- `app/services/upload_processor.py` — background task: base64 encode image → LLM → parse → bulk insert entries

Ruff config: py312, line-length 100, select E/F/I/N/W/UP.

### Frontend Structure
- TanStack Router with file-based routing in `src/routes/`
- TanStack Query for server state; query keys: `['uploads']`, `['entries', {from, to, type}]`, `['dashboard', {from, to}]`
- `src/api/client.ts` — fetch wrapper using `BASE_URL` from Vite; all API calls go through `/babylog/api` proxy
- `src/types/index.ts` — TypeScript interfaces matching backend models
- Bottom tab navigation: Upload (`/`), Log (`/log`), Review (`/review`), Dashboard (`/dashboard`)
- Mobile-first, Tailwind CSS v4
- All charts are hand-crafted SVG (no chart library) in `src/components/dashboard/`
- Dashboard uses feeding session merging (20-min window) for velocity/gap calculations — see `mergeCloseFeedings()` in `utils.ts`

### Data & Business Logic

When fixing counting/aggregation logic, clarify the exact semantics with the user before implementing. E.g., should 'pee+poo' count toward both pee AND poo totals?

### Key Conventions
- `pee+poo` diaper counting: backend returns raw `diaper_pee_poo_count`; frontend adds it to both wet and dirty totals
- iOS PWA: `sessionStorage` flag `babylog_upload_pending` survives page eviction from camera; `visibilitychange` event triggers re-fetch
- Deployment: `tail_serve.sh` sets up Tailscale Serve routes for both frontend and backend

### Tailscale Serve / Path Routing
Both frontend and backend are designed for Tailscale Serve with path-based routing:
- Frontend: `base: '/babylog/'` in vite.config.ts, served at `/babylog`
- Backend: API at `/babylog/api`, Vite proxy strips the prefix before forwarding to port 3849
- CORS origins configured via `FRONTEND_URL` env var (comma-separated)

### Database
SQLite with WAL mode. Two tables: `uploads` (photo tracking with status machine) and `entries` (typed log entries linked to uploads via nullable foreign key with ON DELETE SET NULL). `date` column is denormalized from `occurred_at` for efficient date-range queries.
