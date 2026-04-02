# TechStack.md — MeetMind Technology Stack

---

## Frontend

### Next.js 14 (App Router)

**Version:** 14.x with App Router  
**Language:** TypeScript  
**Why:** Next.js is the industry standard for React-based production web applications. The App Router provides server components, nested layouts, and first-class support for loading/error states — all of which map directly to MeetMind's requirements (per-page layouts, streaming loading states, data fetching patterns). The App Router's `loading.tsx` and `error.tsx` conventions reduce boilerplate for the many async states MeetMind has.

**Alternatives considered:**
- Vite + React SPA: simpler for a small app, but loses SSR/SSG benefits and has a weaker DX for nested routing
- Remix: solid choice, but Next.js has broader ecosystem support and is more recognizable on a portfolio

**Key Next.js patterns used:**
- App Router with nested layouts (sidebar layout wraps all authenticated routes)
- `use client` components for interactive islands (status dropdowns, file upload, polling)
- Server components for data-fetching pages (dashboard, meeting detail)
- Route handlers (`app/api/`) are NOT used — all API calls go to the FastAPI backend
- `next/navigation` for programmatic routing

---

### TypeScript

All frontend and any shared types are written in TypeScript. Strict mode enabled (`"strict": true` in `tsconfig.json`). No `any` types in production code.

---

### Tailwind CSS

**Version:** 3.x  
**Why:** Utility-first CSS is ideal for a data-dense UI like MeetMind. Tailwind eliminates the naming overhead of CSS modules and keeps styling co-located with markup. It works natively with Next.js.

**Configuration:** Custom `tailwind.config.ts` extends the default palette with MeetMind's brand colors. No third-party component libraries — all components are hand-built to avoid dependency bloat and to match the Linear/Notion aesthetic precisely.

---

### State Management

**Tool:** React built-in state (`useState`, `useReducer`) + React Query (`@tanstack/react-query`)  
**Why:** React Query handles server state (API data, caching, background refetching, polling) cleanly without the overhead of Redux. It is the right tool for MeetMind's pattern of fetching meeting data and polling for processing status. There is no complex client-side state that would require a global store.

**Polling:** React Query's `refetchInterval` is used for the processing status polling pattern (every 3 seconds until status = `completed` or `failed`).

---

### HTTP Client

**Tool:** `axios` with a configured instance (base URL, auth header injection, error interceptor)  
**Alternative:** Native `fetch` — acceptable, but axios interceptors make JWT injection and global error handling cleaner.

---

## Backend

### Python 3.11

All backend code is written in Python 3.11. Async/await is used throughout.

---

### FastAPI

**Why:** FastAPI is the correct choice for a Python API backend in 2024. It provides:
- Automatic OpenAPI docs (useful during development)
- Pydantic-based request/response validation (aligns with structured JSON output from Gemini)
- Native async support (required for non-blocking Gemini API calls)
- Dependency injection system (used for RBAC enforcement and DB session injection)

**Alternatives considered:**
- Django REST Framework: heavier, ORM-coupled, less ergonomic for async
- Flask: no built-in async, no validation layer, more boilerplate

---

### Pydantic v2

Used for all request/response schemas and for validating the Gemini API JSON output against the expected schema. Pydantic's strict mode is used for AI response validation to catch schema drift early.

---

### SQLAlchemy 2.x (async)

**Why:** SQLAlchemy 2.x with async support (`asyncpg` driver) provides a clean ORM for PostgreSQL with full async compatibility. Declarative models are used for schema definition. Raw SQL is used for full-text search queries (where ORM ergonomics break down).

**Alternative:** Tortoise ORM, Databases — SQLAlchemy is more mature and has better ecosystem support.

---

### Alembic

Database migration tool. All schema changes go through Alembic migration files. No manual `CREATE TABLE` in production.

---

## Database

### PostgreSQL 15 (Cloud SQL on GCP)

**Why:** PostgreSQL is the correct relational database for MeetMind. It provides:
- JSONB support (useful for storing raw Gemini output before parsing)
- Full-text search via `tsvector`/`tsquery` (used for meeting/action item search)
- Strong ACID guarantees for processing job state
- Mature ecosystem with SQLAlchemy

**GCP Cloud SQL:**
- Managed PostgreSQL — handles backups, patching, failover
- Private IP connectivity from Cloud Run via Cloud SQL Auth Proxy
- Instance: `db-f1-micro` (Cloud SQL) for v1 (cheapest tier, adequate for <100 users)
- Auto-backup enabled, 7-day retention

**Alternatives considered:**
- Supabase: managed PostgreSQL with nice DX, but adds dependency on third-party hosting
- AlloyDB: overkill for v1
- SQLite: not appropriate for a multi-user production system

---

## AI / LLM Layer

### Gemini API (Google AI)

**Model:** `gemini-1.5-pro` (or `gemini-1.5-flash` as fallback for cost/speed)  
**SDK:** `google-generativeai` Python SDK  
**Why:** Gemini is chosen because:
1. The project deploys on GCP — using Gemini (also Google) simplifies IAM, billing, and reduces vendor sprawl
2. Gemini 1.5 Pro has a 1M token context window — sufficient for long meeting transcripts
3. Gemini supports structured JSON output mode (`response_mime_type: "application/json"`) which simplifies parsing

**Prompt engineering approach:**
- System prompt specifies the output JSON schema exactly
- User prompt contains the sanitized transcript text
- `response_mime_type: "application/json"` enforced to get clean JSON
- Pydantic model validates the output immediately after receipt

**Fallback strategy:**
- If Gemini returns invalid JSON after parsing: mark job as `failed`, log raw response
- Retry on HTTP 5xx or 429 with exponential backoff (up to 3 retries)
- No fallback to another LLM provider in v1 (cost/complexity tradeoff)

---

## Authentication

### JWT (JSON Web Tokens)

- Access token: HS256, 15-minute expiry, signed with `JWT_SECRET`
- Refresh token: random 64-byte hex string, stored in `refresh_tokens` DB table, 7-day expiry
- FastAPI `Security` dependency injects and validates JWT on all protected routes
- No third-party auth provider in v1 (Clerk, Auth0 are good v1.1 options)

**Password hashing:** `passlib` with `bcrypt` (cost factor 12)

---

## File Storage

### GCP Cloud Storage

**Why:** Native GCP service, integrates with Cloud Run IAM without additional credential management. Object storage is appropriate for transcript files (write once, read occasionally, no querying).

**Bucket structure:**
```
meetmind-transcripts-{env}/
  {workspace_id}/
    {meeting_id}/
      original_{filename}.txt
```

**Access:** Cloud Run service account has `roles/storage.objectAdmin` on the bucket. Files are never served directly from GCS to the frontend — the FastAPI backend reads them internally for processing.

---

## Validation and Testing

### Backend

| Tool | Purpose |
|------|---------|
| `pytest` | Test runner |
| `pytest-asyncio` | Async test support |
| `httpx` | Async HTTP test client for FastAPI |
| `factory_boy` | Test data factories |
| `pytest-cov` | Coverage reporting |

### Frontend

| Tool | Purpose |
|------|---------|
| `vitest` | Unit test runner (fast, Vite-native) |
| `@testing-library/react` | Component tests |
| `msw` (Mock Service Worker) | API mocking in tests |
| `playwright` | E2E tests (critical paths: login, upload, view meeting) |

---

## Deployment

### GCP Cloud Run (FastAPI Backend)

**Why:** Serverless containers — no server management, scales to zero (cost-effective), handles burst traffic. Docker image is built via GitHub Actions and pushed to GCP Artifact Registry. Cloud Run is the correct choice for a stateless Python API.

**Configuration:**
- Min instances: 0 (scales to zero when idle)
- Max instances: 10
- Memory: 512MB
- CPU: 1
- Concurrency: 80
- Region: `us-central1`
- Env vars injected from GCP Secret Manager via Cloud Run secret bindings

### Vercel (Next.js Frontend)

**Why:** Vercel is the native deployment platform for Next.js, providing edge CDN, automatic preview deployments on PRs, and zero-config deployment. For a portfolio project, Vercel's free tier is sufficient.

**Alternative:** GCP Cloud Run for the frontend (containerized Next.js) — this is the GCP-native alternative if the goal is single-cloud deployment. Both are documented in Deployment.md.

### Docker

FastAPI backend is containerized with a `Dockerfile`. Multi-stage build: build stage installs dependencies, runtime stage copies only what's needed.

### GitHub Actions CI/CD

Pipeline: test → lint → build Docker → push to Artifact Registry → deploy to Cloud Run

---

## Monitoring and Logging

| Tool | Purpose |
|------|---------|
| GCP Cloud Logging | Backend logs (structured JSON logs via `structlog`) |
| GCP Cloud Monitoring | Metrics, uptime checks, alerting |
| Sentry | Error tracking (frontend + backend) — free tier sufficient for v1 |
| Vercel Analytics | Frontend performance (built-in) |

---

## Technology Choice Summary Table

| Layer | Tool | Rationale |
|-------|------|-----------|
| Frontend framework | Next.js 14 | SSR, App Router, industry standard |
| Frontend language | TypeScript | Type safety, portfolio signal |
| CSS | Tailwind CSS | Utility-first, no component library overhead |
| Server state | React Query | Polling, caching, background refetch |
| Backend framework | FastAPI | Async, Pydantic, OpenAPI, Python |
| Database | PostgreSQL 15 | FTS, JSONB, ACID, GCP native |
| ORM | SQLAlchemy 2.x async | Mature, async, Alembic integration |
| Migrations | Alembic | Standard Python migration tool |
| AI | Gemini 1.5 Pro | GCP-native, long context, JSON mode |
| Auth | JWT + bcrypt | No vendor lock-in, standard approach |
| File storage | GCP Cloud Storage | GCP-native, managed, cheap |
| Backend deployment | GCP Cloud Run | Serverless containers, scales to zero |
| Frontend deployment | Vercel | Native Next.js platform |
| CI/CD | GitHub Actions | Free, integrates with GCP |
| Error tracking | Sentry | Free tier, works in both frontend/backend |
| Logging | GCP Cloud Logging | Native GCP, structured logs |
