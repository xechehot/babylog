# Babylog — Specification

Parse, organize, and visualize baby logs from photos of handwritten notes.

## Overview

Parents track feedings, diaper changes, and weight on paper. Babylog turns those handwritten logs into structured data:

1. Take a photo of the handwritten log page
2. Upload it — the image is saved to disk and queued for processing
3. A background task sends the image to an LLM vision API (Claude or OpenAI) to extract structured entries
4. Review the parsed entries, fix any recognition errors
5. View everything on a timeline and dashboard with daily metrics

**Core workflow:** Upload → LLM parses → Review → Browse timeline & dashboard

Single-user, no auth (Tailscale handles network security). Data stored in SQLite. Hosted locally via Tailscale Serve. Handwritten logs are in Russian.

---

## Data Model

### SQLite Configuration

WAL mode enabled. Foreign keys enforced. Database file at `backend/babylog.db`.

### Tables

```sql
CREATE TABLE uploads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    filename        TEXT NOT NULL,
    filepath        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',   -- pending | processing | done | failed
    error_message   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at    TEXT
);

CREATE INDEX idx_uploads_status ON uploads(status);
CREATE INDEX idx_uploads_created_at ON uploads(created_at);

CREATE TABLE entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id       INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
    entry_type      TEXT NOT NULL,                    -- feeding | pee | poo | weight
    occurred_at     TEXT NOT NULL,                    -- YYYY-MM-DD HH:MM
    date            TEXT NOT NULL,                    -- YYYY-MM-DD (denormalized for filtering)
    value           REAL,                             -- ml for feeding, grams for weight, NULL for diapers
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_entries_date ON entries(date);
CREATE INDEX idx_entries_type ON entries(entry_type);
CREATE INDEX idx_entries_occurred_at ON entries(occurred_at);
CREATE INDEX idx_entries_upload_id ON entries(upload_id);
```

### Design Decisions

- **Denormalized `date`** — avoids `substr()` in WHERE clauses for date-range queries.
- **`upload_id` nullable, `ON DELETE SET NULL`** — entries can exist without a photo (manual entry). If an upload is deleted, entries remain.
- **`value` as REAL** — feeding in ml (e.g. 90.0), weight in grams (e.g. 4500.0). NULL for pee/poo.
- **Weight in grams** — avoids floating-point issues. Display as kg in the UI (4500 → "4.5 kg").
- **One photo → many entries across many days** — a single handwritten page often covers 2–3 days.

---

## API Endpoints

Base path: `/api` (stripped by Tailscale Serve — backend routes are mounted at root).

### Uploads

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/uploads` | Upload photo, queue processing |
| `GET` | `/api/uploads` | List uploads with status |
| `GET` | `/api/uploads/:id` | Get upload with its entries |
| `POST` | `/api/uploads/:id/reprocess` | Retry failed processing |

#### `POST /api/uploads`

Accepts `multipart/form-data` with a single image file. Saves to `{UPLOAD_DIR}/{uuid}_{filename}`, creates DB record with `status=pending`, queues `BackgroundTask`.

```json
// Response 201
{ "id": 1, "filename": "IMG_1234.jpg", "status": "pending", "created_at": "2026-02-28 10:30:00" }
```

#### `GET /api/uploads`

Newest first. Optional `?status=` filter. Includes computed `entry_count`.

```json
// Response 200
{
  "uploads": [
    { "id": 1, "filename": "IMG_1234.jpg", "status": "done", "entry_count": 12, "created_at": "...", "processed_at": "..." }
  ]
}
```

#### `GET /api/uploads/:id`

Returns upload details with all linked entries.

#### `POST /api/uploads/:id/reprocess`

Resets status to `pending`, queues new background task. Only allowed when `status=failed`.

### Entries

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/entries` | List entries (filterable) |
| `POST` | `/api/entries` | Manual add |
| `PATCH` | `/api/entries/:id` | Update entry |
| `DELETE` | `/api/entries/:id` | Delete entry |

#### `GET /api/entries`

Query params: `from` (YYYY-MM-DD), `to` (YYYY-MM-DD), `type` (feeding|pee|poo|weight). Defaults to last 7 days. Sorted by `occurred_at ASC`.

```json
// Response 200
{
  "entries": [
    { "id": 1, "upload_id": 1, "entry_type": "feeding", "occurred_at": "2026-02-27 10:30", "date": "2026-02-27", "value": 90, "notes": null, "created_at": "...", "updated_at": "..." }
  ]
}
```

#### `POST /api/entries`

`date` is auto-derived from `occurred_at` on the server.

```json
// Request
{ "entry_type": "feeding", "occurred_at": "2026-02-28 14:30", "value": 120, "notes": "грудь + бутылочка" }
```

#### `PATCH /api/entries/:id`

Partial update. `updated_at` set automatically.

#### `DELETE /api/entries/:id`

Response `204 No Content`.

### Dashboard

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/dashboard` | Aggregated daily metrics |

Query params: `from`, `to` (YYYY-MM-DD). Defaults to last 7 days.

```json
// Response 200
{
  "from": "2026-02-22",
  "to": "2026-02-28",
  "days": [
    { "date": "2026-02-22", "feeding_total_ml": 680, "feeding_count": 8, "pee_count": 6, "poo_count": 3 }
  ],
  "latest_weight": { "value": 4500, "occurred_at": "2026-02-25 09:00", "date": "2026-02-25" }
}
```

### Health

`GET /health` → `{ "status": "ok" }`

### Error Convention

`{ "detail": "Human-readable message" }` with status 400/404/422/500.

---

## LLM Integration

### Background Task Flow

```
POST /api/uploads
  1. Save file to disk
  2. INSERT uploads (status='pending')
  3. Add BackgroundTask: process_upload(upload_id)
  4. Return 201

process_upload(upload_id):
  1. UPDATE status='processing'
  2. Read image, base64-encode
  3. Send to LLM vision API with extraction prompt
  4. Parse JSON response into entries
  5. INSERT entries linked to upload_id
  6. UPDATE status='done', processed_at=now
  On error: UPDATE status='failed', error_message=str(e)
```

### Provider Configuration

```env
LLM_PROVIDER=anthropic          # anthropic | openai
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
LLM_MODEL=claude-sonnet-4-20250514
```

### Prompt Design

The system prompt instructs the LLM to extract structured data from handwritten baby logs in Russian. Typical handwritten format:

```
27.02 (четверг)
10:30 - 90мл
11:00 - пис
12:15 - 120мл
14:30 - как
16:00 - 80мл

Вес: 4.5кг (25.02)
```

**System prompt:**

```
You are a baby log parser. Extract structured entries from a photo of handwritten baby care notes in Russian.

Rules:
- Each entry has: date, time, type, and optionally a value
- Date headers look like "27.02", "27/02", "27 февраля" or similar. Infer the year from context (current year).
- Entry types:
  - "feeding": has a value in ml (e.g., "90мл", "90", "120 мл"). Value is always in milliliters.
  - "pee": wet diaper. Keywords: пис, мокр, пописал(а), мочеиспускание
  - "poo": stool. Keywords: как, стул, покакал(а), какашк
  - "weight": value in grams. If written as kg (e.g., "4.5кг"), convert to grams (4500). Keywords: вес, кг, гр, g, kg
- Time is in HH:MM 24-hour format
- If a line has just a number with "мл"/"ml" near a time, it is a feeding
- Ignore illegible entries. Do not guess values you cannot read.
- Return ONLY valid JSON, no markdown fences, no explanation.

Return a JSON array:
[
  { "entry_type": "feeding", "occurred_at": "2026-02-27 10:30", "value": 90 },
  { "entry_type": "pee", "occurred_at": "2026-02-27 11:00", "value": null },
  { "entry_type": "weight", "occurred_at": "2026-02-25 09:00", "value": 4500 }
]
```

### Provider Abstraction

```python
class LLMService:
    async def parse_image(self, image_bytes: bytes, mime_type: str) -> list[dict]:
        if settings.llm_provider == "anthropic":
            return await self._parse_with_anthropic(image_bytes, mime_type)
        else:
            return await self._parse_with_openai(image_bytes, mime_type)
```

### Response Parsing

1. Strip markdown fences if present
2. Parse JSON array
3. Validate each entry against Pydantic model
4. Derive `date` from `occurred_at`
5. Bulk insert valid entries, skip invalid ones (don't fail the whole upload)

### Crash Recovery

On startup (lifespan handler), reset any uploads with `status='processing'` back to `pending`.

---

## Frontend

Mobile-first. TanStack Router for navigation, TanStack Query for server state. Bottom tab navigation.

### Navigation

Bottom tab bar (fixed), four tabs:

| Tab | Route | Purpose |
|-----|-------|---------|
| Upload | `/` | Upload photos, see processing status |
| Log | `/log` | Timeline view of all entries |
| Review | `/review` | Review parsed entries by upload |
| Dashboard | `/dashboard` | Daily metrics and charts |

### Upload Page (`/`)

```
+------------------------------------------+
| babylog                                  |
+------------------------------------------+
|    +----------------------------------+  |
|    |        [Camera icon]             |  |
|    |     Нажмите чтобы загрузить      |  |
|    +----------------------------------+  |
|                                          |
|  Последние загрузки                      |
|  IMG_1234.jpg    done     12 entries     |
|  IMG_1235.jpg    processing...           |
|  IMG_1236.jpg    failed   [Retry]        |
+------------------------------------------+
| [Upload] [Log] [Review] [Dashboard]     |
+------------------------------------------+
```

- Large tap target for upload (full-width)
- `<input type="file" accept="image/*" capture="environment">` for camera on mobile
- Upload starts on file selection (no submit button)
- Failed uploads have a Retry button
- Polls while uploads are pending/processing (`refetchInterval: 3000`)

### Log Page (`/log`)

```
+------------------------------------------+
| babylog                    [+ Добавить]  |
+------------------------------------------+
| 26 фев, среда                            |
|  08:00  | Кормление   110мл              |
|  09:30  | Пис                            |
|  12:00  | Как                            |
|  14:30  | Кормление   120мл              |
|                                          |
| 27 фев, четверг                  СЕГОДНЯ |
|  08:15  | Кормление   100мл       [edit] |
|  09:00  | Пис                     [edit] |
|  12:00  | Вес         4500г       [edit] |
+------------------------------------------+
| [Upload] [Log] [Review] [Dashboard]     |
+------------------------------------------+
```

- Entries grouped by day, sorted by time
- Sticky day headers
- Color-coded icons: blue (feeding), yellow (pee), brown (poo), green (weight)
- Tap entry → inline edit mode
- "+ Добавить" button opens entry form as bottom sheet
- Auto-scrolls to today on mount

### Review Page (`/review`)

- Dropdown to select upload
- Shows entries from that upload, grouped by day
- Each entry has edit and delete buttons
- "Add missing entry" at bottom

### Dashboard Page (`/dashboard`)

```
+------------------------------------------+
| babylog              [7д] [14д] [30д]    |
+------------------------------------------+
| Последний вес                            |
| 4.5 кг (25 фев)                         |
|                                          |
| Кормление (мл/день)                     |
| ┌────────────────────────────────────┐   |
| │  ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓    │   |
| │  680  720  700  690  710  730  650  │   |
| └────────────────────────────────────┘   |
|                                          |
| Подгузники (шт/день)                    |
| ┌────────────────────────────────────┐   |
| │  Пис: ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓      │   |
| │  Как: ▓  ▓  ▓  ▓  ▓  ▓  ▓       │   |
| └────────────────────────────────────┘   |
|                                          |
| Сегодня                                 |
| Кормлений: 5 (всего 520мл)             |
| Пис: 4  |  Как: 2                       |
+------------------------------------------+
| [Upload] [Log] [Review] [Dashboard]     |
+------------------------------------------+
```

- Period selector: 7/14/30 days
- Latest weight card
- Bar charts: daily feeding ml, daily diaper counts
- Today's summary card
- Simple CSS/SVG bars for MVP

### Manual Entry Form (Bottom Sheet)

```
+------------------------------------------+
|  Добавить запись                   [x]   |
|  Тип:      [Кормление v]                |
|  Дата:     [2026-02-28]                  |
|  Время:    [14:30]                       |
|  Объём:    [120] мл                      |
|  Заметка:  [необязательно]               |
|  [         Сохранить          ]          |
+------------------------------------------+
```

- Native date/time inputs for mobile OS pickers
- Value field shown/hidden based on type
- `text-base` (16px) on inputs to prevent iOS zoom
- Min 44px tap targets

### State Management

TanStack Query keys:
- `['uploads']` — upload list
- `['uploads', id]` — single upload with entries
- `['entries', { from, to, type }]` — filtered entries
- `['dashboard', { from, to }]` — dashboard metrics

Mutations invalidate `entries` + `dashboard` on entry changes, `uploads` on upload changes.

### Upload Status Polling

```typescript
useQuery({
  queryKey: ['uploads'],
  queryFn: () => api.get('/api/uploads'),
  refetchInterval: (query) => {
    const hasActive = query.state.data?.uploads.some(
      u => u.status === 'pending' || u.status === 'processing'
    )
    return hasActive ? 3000 : false
  },
})
```

### CSS Patterns

- Bottom nav: `fixed bottom-0 inset-x-0` with `pb-[env(safe-area-inset-bottom)]`
- Page content: `pb-16` (nav height)
- Sticky headers: `sticky top-0 z-10 bg-white`
- Entry grid: `grid grid-cols-[4rem_1fr_auto]`
- Bottom sheet: `fixed bottom-0 inset-x-0 rounded-t-2xl` with backdrop
- Touch: `touch-action-manipulation`, min 44px targets

---

## Project Structure

```
babylog/
  README.md
  SPEC.md
  .gitignore

  backend/
    pyproject.toml
    .env.example
    app/
      __init__.py
      main.py                  # FastAPI app, CORS, lifespan, routers
      config.py                # Pydantic Settings
      database.py              # SQLite connection, schema init
      models/
        __init__.py
        upload.py              # Upload pydantic models
        entry.py               # Entry pydantic models
        dashboard.py           # Dashboard response models
      routers/
        __init__.py
        uploads.py             # Upload endpoints
        entries.py             # Entry CRUD endpoints
        dashboard.py           # Dashboard endpoint
      services/
        __init__.py
        llm.py                 # LLM provider abstraction
        upload_processor.py    # Background task: process_upload

  frontend/
    package.json
    index.html
    vite.config.ts
    tsconfig.json
    src/
      main.tsx
      index.css                # @import "tailwindcss"
      api/
        client.ts              # fetch wrapper
      types/
        index.ts               # TypeScript interfaces
      hooks/
        useIsMobile.ts
      routes/
        __root.tsx             # Layout + BottomNav
        index.tsx              # Upload page
        log.tsx
        review.tsx
        dashboard.tsx
      components/
        BottomNav.tsx
        BottomSheet.tsx
        EntryForm.tsx
        DayHeader.tsx
        EntryRow.tsx
        EntryEditor.tsx
        PhotoUploader.tsx
        UploadCard.tsx
        WeightCard.tsx
        FeedingChart.tsx
        DiaperChart.tsx
        TodaySummary.tsx
        PeriodSelector.tsx
```

---

## Tailscale Serve

| Service | Port | Path | Description |
|---------|------|------|-------------|
| babylog-frontend | 5174 | /babylog | Vite dev server |
| babylog-backend | 3849 | /babylog/api | FastAPI backend |

```bash
tailscale serve --set-path /babylog 5174
tailscale serve --set-path /babylog/api 3849
```

- All servers listen on `0.0.0.0`
- Tailscale strips path prefix before forwarding
- Frontend `base: '/babylog/'` in vite.config.ts
- Vite proxy: `/babylog/api` → `localhost:3849` with prefix stripping
- CORS: allow Tailscale hostname + localhost

---

## Tech Details

### Backend Dependencies (pyproject.toml)

```toml
[project]
name = "babylog-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]",
    "pydantic-settings",
    "aiosqlite",
    "anthropic",
    "openai",
    "python-multipart",
]

[dependency-groups]
dev = ["pytest", "pytest-asyncio", "httpx", "ruff", "mypy"]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
```

Run: `uv run fastapi dev app/main.py --host 0.0.0.0 --port 3849`

### Backend Config (.env.example)

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
LLM_MODEL=claude-sonnet-4-20250514
UPLOAD_DIR=./uploads
DATABASE_PATH=./babylog.db
BACKEND_PORT=3849
FRONTEND_URL=http://localhost:5174/babylog
```

### Frontend Dependencies (package.json)

```json
{
  "dependencies": {
    "@tailwindcss/vite": "^4",
    "@tanstack/react-query": "^5",
    "@tanstack/react-router": "^1",
    "react": "^19",
    "react-dom": "^19",
    "tailwindcss": "^4"
  },
  "devDependencies": {
    "@tanstack/router-devtools": "^1",
    "@tanstack/router-plugin": "^1",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5",
    "typescript": "~5.9",
    "vite": "^7"
  }
}
```

### Vite Config

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [react(), tailwindcss(), TanStackRouterVite()],
  base: '/babylog/',
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['.ts.net'],
    proxy: {
      '/babylog/api': {
        target: 'http://localhost:3849',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/babylog\/api/, ''),
      },
    },
  },
})
```

### TypeScript Types

```typescript
export type EntryType = 'feeding' | 'pee' | 'poo' | 'weight'
export type UploadStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface Upload {
  id: number
  filename: string
  status: UploadStatus
  error_message: string | null
  entry_count?: number
  created_at: string
  processed_at: string | null
}

export interface Entry {
  id: number
  upload_id: number | null
  entry_type: EntryType
  occurred_at: string
  date: string
  value: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DashboardDay {
  date: string
  feeding_total_ml: number
  feeding_count: number
  pee_count: number
  poo_count: number
}

export interface DashboardResponse {
  from: string
  to: string
  days: DashboardDay[]
  latest_weight: { value: number; occurred_at: string; date: string } | null
}
```

### API Client Pattern

```typescript
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '')

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => uploadRequest<T>(path, formData),
}
```
