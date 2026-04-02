# AI_Instructions.md — Build Instructions for AI Coding Agent

---

## Purpose

This document provides complete, step-by-step instructions for an AI coding agent to build MeetMind from scratch. All specifications exist in the other documents in this `/project-docs` folder. This document tells the agent **what to build, in what order, and how to do it correctly.**

Read all documents in `/project-docs` before writing a single line of code.

---

## Pre-Build Reading Checklist

Before writing any code, the agent must read and internalize:

- [ ] `PRD.md` — understand the problem, users, scope, and constraints
- [ ] `Features.md` — know exactly what each feature does and its acceptance criteria
- [ ] `UIUX.md` — understand every page, component, state, and interaction
- [ ] `TechStack.md` — know which tools to use and why
- [ ] `Database.md` — understand every table, column, constraint, and relationship
- [ ] `API.md` — know every endpoint, its request/response shape, validation rules, and error codes
- [ ] `Architecture.md` — understand folder structure, separation of concerns, and processing flows
- [ ] `Security.md` — internalize every security rule before touching auth or file handling
- [ ] `Deployment.md` — understand how the app runs in production before writing config files

---

## Implementation Order

Build in this exact order. Do not skip ahead. Each phase has dependencies on the previous.

### Phase 1: Project Scaffolding and Configuration

1. Create the monorepo root: `meetmind/` with `backend/` and `frontend/` subdirectories
2. Initialize Git repository. Create `.gitignore` at root (exclude: `.env`, `.env.local`, `.venv`, `__pycache__`, `node_modules`, `*.pyc`)
3. Set up backend:
   - `python3.11 -m venv .venv`
   - Create `requirements.txt` with all dependencies (see TechStack.md for tool list)
   - Create `app/config.py` using `pydantic-settings` — load all env vars from `.env`
   - Create `.env.example` with all variable names and placeholder values
4. Set up frontend:
   - `npx create-next-app@latest frontend --typescript --tailwind --app`
   - Install additional dependencies: `@tanstack/react-query`, `axios`
   - Configure `tailwind.config.ts` with MeetMind brand colors (from UIUX.md §2)
   - Create `.env.local.example`

**Verification:** `uvicorn app.main:app` starts without errors. `npm run dev` starts without errors.

---

### Phase 2: Database Schema

1. Set up SQLAlchemy async engine in `app/database.py`
2. Create all ORM models in `app/models/` — one file per table (see Database.md §3)
   - Start with: `workspace.py`, `user.py`, `refresh_token.py`
   - Then: `meeting.py`, `transcript.py`, `processing_job.py`
   - Then: `meeting_summary.py`, `action_item.py`, `decision.py`
   - Then: `notification.py`, `activity_log.py`
3. Set up Alembic: `alembic init migrations`
4. Configure `migrations/env.py` to use the async SQLAlchemy engine and import all models
5. Generate initial migration: `alembic revision --autogenerate -m "initial_schema"`
6. Review the generated migration file — ensure all tables, indexes, constraints, and triggers match Database.md exactly
7. Add a second migration for seed data (workspace + admin user)
8. Run `alembic upgrade head` against a local PostgreSQL instance
9. Verify all tables exist with correct columns and constraints using `\d+ table_name` in psql

**Verification:** `alembic upgrade head` completes without errors. All 11 tables exist. FTS triggers are in place.

---

### Phase 3: Authentication Backend

1. Create `app/utils/security.py`:
   - `hash_password(password: str) -> str` using bcrypt
   - `verify_password(plain: str, hashed: str) -> bool`
   - `create_access_token(payload: dict) -> str` using HS256
   - `decode_access_token(token: str) -> dict` — raises HTTPException on failure
   - `generate_refresh_token() -> str` using `secrets.token_hex(32)`
   - `hash_token(token: str) -> str` using SHA-256

2. Create `app/dependencies.py`:
   - `get_db()` async generator for SQLAlchemy session injection
   - `get_current_user()` — extracts and validates JWT, loads user from DB
   - `require_role(*roles)` — returns a dependency that checks user.role

3. Create `app/schemas/auth.py` — Pydantic schemas for register/login request and response

4. Create `app/services/auth_service.py`:
   - `register_user()` — validate uniqueness, hash password, create user, generate tokens
   - `login_user()` — verify credentials, generate tokens
   - `refresh_access_token()` — validate refresh token hash, return new access token
   - `logout_user()` — revoke refresh token

5. Create `app/routers/auth.py` — register all four auth endpoints

6. Create `app/main.py`:
   - FastAPI app factory
   - Include CORS middleware (allow origin from `settings.ALLOWED_ORIGINS`)
   - Register `/v1` prefix on all routers
   - Add `/v1/health` endpoint

**Verification:** All auth endpoints pass tests in `tests/test_auth.py`. Register → Login → Refresh → Logout flow works end-to-end in Swagger UI.

---

### Phase 4: User and Admin Endpoints

1. Create `app/schemas/user.py`
2. Create `app/services/user_service.py` — get_me, update_me, list_users (admin), update_role, update_status
3. Create `app/routers/users.py` — `GET /users/me`, `PATCH /users/me`
4. Create `app/routers/admin.py` — `GET /admin/users`, `PATCH /admin/users/:id/role`, `PATCH /admin/users/:id/status`
5. Apply `require_role("admin")` dependency on all `/admin/` routes

**Verification:** Role enforcement works — team_member calling `/admin/users` returns 403.

---

### Phase 5: GCP Cloud Storage Integration

1. Install `google-cloud-storage` in requirements.txt
2. Create `app/services/storage_service.py`:
   - `upload_transcript(file_content: bytes, workspace_id: str, meeting_id: str, filename: str) -> str` — uploads to GCS, returns `gcs_uri`
   - `download_transcript(gcs_uri: str) -> str` — downloads and returns raw text
3. For local development: use the GCS emulator or a real GCS bucket with ADC (`gcloud auth application-default login`)
4. For tests: mock `storage_service` using `unittest.mock.AsyncMock`

---

### Phase 6: Meeting Upload Endpoint

1. Create `app/schemas/meeting.py` — request and response schemas
2. Create `app/services/meeting_service.py`:
   - `create_meeting(...)` — creates Meeting, Transcript, ProcessingJob records in a single transaction
3. Create `app/routers/meetings.py` — `POST /meetings` (multipart/form-data)
   - Validate file extension (`.txt` only) → 415 if wrong
   - Validate file size (≤ 5MB) → 413 if exceeded
   - Call `storage_service.upload_transcript()`
   - Call `meeting_service.create_meeting()`
   - Add `BackgroundTask`: `processing_service.process_transcript(job_id)`
   - Return 201 with `meeting_id` and `job_id`

**Verification:** Upload a `.txt` file → meeting record created in DB, file appears in GCS bucket.

---

### Phase 7: Gemini AI Processing Pipeline

This is the most critical phase. Build it carefully.

1. Create `app/utils/prompt_builder.py`:
   - `sanitize_transcript(text: str) -> str` — apply sanitization rules from Security.md §6
   - `build_extraction_prompt(transcript_text: str) -> str` — construct the full prompt

   **The extraction prompt must:**
   - Have a system instruction that specifies the exact JSON schema
   - Instruct the model to extract only what is explicitly present in the transcript
   - Specify that `due_date` should be `null` if not mentioned
   - Specify that `priority` should default to `medium` if not inferable
   - Include the sanitized transcript text as the user content

   **System instruction template:**
   ```
   You are a meeting intelligence assistant. Extract structured information from the meeting transcript below.
   
   Respond with ONLY valid JSON matching this exact schema — no other text:
   {
     "summary": "string (2-5 sentence summary of the meeting)",
     "participants": ["string"],
     "action_items": [
       {
         "description": "string",
         "owner_name": "string or null",
         "due_date": "YYYY-MM-DD or null",
         "priority": "high | medium | low"
       }
     ],
     "decisions": [
       {
         "description": "string"
       }
     ]
   }
   
   Rules:
   - Only include action items that are explicitly assigned or committed to
   - Only include decisions that are clearly stated as decided
   - If no action items are found, return an empty array
   - If no decisions are found, return an empty array
   - Do not invent information not present in the transcript
   ```

2. Create `app/schemas/gemini.py`:
   - `GeminiActionItem` (Pydantic model)
   - `GeminiDecision` (Pydantic model)
   - `GeminiOutput` (Pydantic model with strict validation)

3. Create `app/services/processing_service.py`:
   - `process_transcript(job_id: UUID, db: AsyncSession)` — the main background task function
   - Implement the full pipeline from Architecture.md §6
   - Implement retry logic (3 attempts, exponential backoff: 2s, 4s, 8s)
   - On success: write summary, action items, decisions in a single transaction
   - On failure: update job to `failed`, store error message
   - Always update `processing_jobs.attempt_count` on each attempt

4. Add the `BackgroundTask` call in the `POST /meetings` router handler

5. Create `app/services/notification_service.py`:
   - `create_notification(user_id, type, message, related_meeting_id)` — called after processing completes/fails

**Verification:** Upload a real `.txt` transcript → within 30 seconds, job status becomes `completed` → `meeting_summaries`, `action_items`, `decisions` records exist in DB.

---

### Phase 8: Meeting Read Endpoints

1. Add to `app/routers/meetings.py`:
   - `GET /meetings` — paginated list with filters and sorting
   - `GET /meetings/:id` — full meeting detail (joins to summary, action items, decisions)
   - `GET /meetings/:id/status` — processing status
   - `DELETE /meetings/:id` — soft delete (Admin only)
   - `POST /meetings/:id/reprocess` — create new job, clear old AI output

2. Ensure all queries filter by `workspace_id` (IDOR prevention)

---

### Phase 9: Action Item Endpoints

1. Create `app/routers/action_items.py`:
   - `GET /action-items` — paginated, filtered list with all filters from API.md §10
   - `PATCH /action-items/:id` — update status, owner_name, due_date (Team Member+ only)
2. Log action item status changes to `activity_logs`

---

### Phase 10: Search Endpoint

1. Create `app/services/search_service.py`:
   - Build the FTS query using raw SQL (see Database.md §8 for query pattern)
   - Sanitize the query string before passing to `to_tsquery`
   - Return grouped results (meetings + action items)

2. Create `app/routers/search.py`:
   - `GET /search?q=...` with minimum 2 chars validation

---

### Phase 11: Notifications and Activity Log Endpoints

1. Create `app/routers/notifications.py`:
   - `GET /notifications` — unread count + list
   - `PATCH /notifications/:id/read`
   - `PATCH /notifications/read-all`

2. Create `app/routers/admin.py` additions:
   - `GET /admin/activity-logs`

---

### Phase 12: Frontend — Authentication

1. Create `types/index.ts` with all TypeScript interfaces matching API response shapes
2. Create `lib/api.ts` — axios instance with:
   - Base URL from `NEXT_PUBLIC_API_URL`
   - Request interceptor: inject `Authorization: Bearer {token}` from React state
   - Response interceptor: on 401 → call refresh endpoint → retry original request → on refresh failure → redirect to `/login`
3. Create `lib/auth.ts` — helper functions for token management
4. Create `providers/QueryProvider.tsx` — wrap app with `QueryClientProvider`
5. Create `middleware.ts` — protect all `(dashboard)` routes; redirect to `/login` if no valid session
6. Create `app/(auth)/login/page.tsx` — exactly matching UIUX.md §5 Screen 1
7. Create `app/(auth)/register/page.tsx` — exactly matching UIUX.md §5 Screen 2
8. Create `hooks/useAuth.ts` — current user state, login/logout actions

**UI Implementation via Stitch MCP:**

Before writing any frontend component code, use the Stitch MCP tool to generate the UI. Read UIUX.md completely and then:

For each page in UIUX.md, invoke Stitch with the full screen specification as the prompt:
1. Login/Landing page → pass Screen 1 spec verbatim
2. Register page → pass Screen 2 spec
3. Dashboard → pass Screen 3 spec
4. Upload Transcript → pass Screen 4 spec
5. Meeting Detail → pass Screen 5 spec
6. Action Items → pass Screen 6 spec
7. Search → pass Screen 7 spec
8. Settings → pass Screen 8 spec
9. Admin Users → pass Screen 9 spec

For each Stitch invocation:
- Include layout description, all component names, all states (empty, loading, error)
- Specify: "Clean, minimal, data-forward aesthetic. Notion/Linear style. Tailwind CSS. No component library."
- After generation: review output against UIUX.md acceptance criteria
- Place generated components in correct folders immediately (`/components`, `/app/` pages)
- Document outcome in `UI_BUILD_LOG.md`

If Stitch output does not match spec: iterate the prompt with more specific constraints before falling back to manual implementation.

---

### Phase 13: Frontend — Core Pages

Build in this order, using Stitch-generated bases:

1. `app/(dashboard)/layout.tsx` — Sidebar + TopBar layout wrapper
2. `components/layout/Sidebar.tsx` — nav items, role-aware visibility
3. `components/layout/TopBar.tsx` — notification bell, upload button
4. `app/(dashboard)/dashboard/page.tsx` — meeting list with all states
5. `components/meetings/MeetingCard.tsx`
6. `components/common/EmptyState.tsx`
7. `components/common/Pagination.tsx`
8. `app/(dashboard)/meetings/upload/page.tsx` — upload form
9. `components/upload/FileDropzone.tsx`
10. `app/(dashboard)/meetings/[id]/page.tsx` — meeting detail
11. `components/meetings/ProcessingStatus.tsx` — polling wrapper
12. `app/(dashboard)/action-items/page.tsx` — global action item list
13. `components/action-items/ActionItemRow.tsx` — inline status dropdown
14. `app/(dashboard)/search/page.tsx` — search with results
15. `app/(dashboard)/settings/page.tsx`
16. `app/(dashboard)/admin/users/page.tsx`

---

### Phase 14: Tests

Write tests as each module is built. Minimum coverage requirements:

**Backend (pytest):**
- All auth endpoints (register, login, refresh, logout)
- Meeting upload (valid file, wrong type, too large)
- Processing pipeline (mock Gemini: success path, invalid JSON, API failure)
- Action item PATCH (role enforcement, status transitions)
- Search endpoint (query sanitization, results format)
- RBAC: test that viewer cannot mutate, that non-admin cannot access `/admin/` routes

**Frontend (vitest + Testing Library):**
- `FileDropzone` — accepts .txt, rejects .pdf, rejects > 5MB
- `ProcessingStatus` — renders spinner when processing, renders content when complete
- `ActionItemRow` — status dropdown disabled for viewer role

**E2E (Playwright):**
- Login → upload → wait for processing → view meeting detail
- Search for a keyword → verify result appears

---

## Rules for Clean Code and Modularity

1. **One file, one responsibility.** Routers handle HTTP. Services handle business logic. Models handle ORM. Schemas handle validation. Never mix.

2. **No business logic in routers.** Router handlers call services and return responses. That is all they do.

3. **All functions must have type annotations.** No untyped parameters or return values in Python or TypeScript.

4. **No hardcoded values.** All configuration comes from `settings` (backend) or environment variables (frontend). Magic strings and numbers go in constants files.

5. **No `print()` for debugging.** Use `structlog` (backend) or `console.error` (frontend). Remove all debug logging before committing.

6. **No bare `except` or `except Exception`.** Catch specific exceptions. Log the error with context. Re-raise or return an appropriate HTTP error.

7. **Database transactions for multi-table writes.** Any operation that writes to more than one table must be wrapped in an explicit transaction. Roll back on any failure.

8. **Never commit secrets.** If you accidentally add a secret to a file, remove it and rotate the secret before committing.

9. **No `any` in TypeScript.** Use proper types. Use `unknown` if the type is genuinely unknown, then narrow.

10. **React Query for all server state.** No `useState` for API data. No manual fetch calls outside of React Query query functions.

---

## Rules for Naming and Folder Structure

- Python files: `snake_case.py`
- Python functions and variables: `snake_case`
- Python classes: `PascalCase`
- TypeScript files: `PascalCase.tsx` for components, `camelCase.ts` for utils/hooks
- TypeScript functions and variables: `camelCase`
- TypeScript interfaces: `PascalCase` (e.g., `Meeting`, `ActionItem`, `User`)
- Database columns: `snake_case`
- API endpoints: `snake_case` URL segments (e.g., `/action-items`, not `/actionItems`)
- React components: `PascalCase`, one component per file
- Hooks: prefix with `use` (e.g., `useMeetings.ts`)

Follow the exact folder structure defined in Architecture.md §2 and §3. Do not create additional top-level folders without a clear reason.

---

## Rules for Error Handling

**Backend:**
- Use FastAPI's `HTTPException` with the standard error format from API.md §3
- Create a global exception handler in `main.py` for unhandled exceptions → return 500 with `INTERNAL_ERROR` code
- Pydantic `ValidationError` → convert to 422 with field-level details
- Log all 5xx errors with stack trace to structured logger
- Never expose internal error messages (stack traces, SQL errors) in API responses

**Frontend:**
- React Query `onError` callback → show toast notification
- Axios interceptor → handles 401 (token refresh) and 403 (redirect + toast)
- Form validation errors → display inline below the relevant field
- Never show raw error objects to the user — map to friendly messages

---

## Rules for Gemini API Integration

1. **Always use `response_mime_type: "application/json"`** in the Gemini API call configuration. Do not attempt to parse JSON from a text response.

2. **Always validate the response with the `GeminiOutput` Pydantic schema** immediately after `json.loads()`. Do not write to the database without successful validation.

3. **Store the raw response** in `processing_jobs.raw_gemini_response` before attempting parsing. This enables debugging without re-calling the API.

4. **Sanitize the transcript before including it in the prompt.** Call `sanitize_transcript()` from `prompt_builder.py` on every call. Never skip this step.

5. **Implement retry with exponential backoff.** Use a utility function:
```python
async def call_with_retry(func, max_attempts=3):
    for attempt in range(max_attempts):
        try:
            return await func()
        except Exception as e:
            if attempt == max_attempts - 1:
                raise
            wait = 2 ** attempt  # 1s, 2s, 4s
            await asyncio.sleep(wait)
```

6. **Never log the Gemini API key.** Use structured logging with explicit field exclusion for auth headers.

7. **Use temperature 0.1** for extraction tasks — low temperature reduces hallucination of non-existent action items.

8. **If the transcript is empty or under 50 characters**, skip Gemini and mark the job as `failed` with message "Transcript too short to process."

9. **Do not call Gemini synchronously in a request handler.** Always use `BackgroundTasks`. The HTTP response must return before processing begins.

---

## Rules for GCP Service Usage

1. **Use Workload Identity** for Cloud Run authentication to GCS and Cloud SQL. No service account key files.

2. **Use Cloud SQL Auth Proxy** for Cloud Run → Cloud SQL connectivity (configured via `--add-cloudsql-instances` in the `gcloud run deploy` command). The connection string uses the socket path.

3. **Never make GCS files public.** Transcript files should have no public ACLs. Backend fetches them internally.

4. **Store secrets in Secret Manager**, not in Cloud Run environment variables directly. Bind secrets via `--set-secrets` in the deploy command.

5. **Use the `us-central1` region** for all services in v1 to minimize latency between Cloud Run, Cloud SQL, and GCS.

6. **Respect Cloud Run's concurrency model.** With `--concurrency=80` and `--workers=1`, FastAPI processes 80 concurrent requests per instance. Background tasks count against this limit. Do not spawn long-running background tasks that block the instance indefinitely.

---

## Rules for Not Over-Engineering

1. **No Redis in v1.** Rate limiting uses in-memory counters. Notification delivery is synchronous. If Redis is needed later (session sharing, pub/sub), add it then.

2. **No Celery or Cloud Tasks in v1.** FastAPI `BackgroundTasks` is sufficient for the job volume expected in v1 (<10 uploads/day).

3. **No GraphQL.** REST is appropriate for this application's complexity.

4. **No microservices.** The backend is a single FastAPI application. Do not split into separate services (auth service, processing service) until there is a concrete scaling reason.

5. **No custom caching layer.** PostgreSQL with proper indexes handles the read patterns. Do not add application-level caching in v1.

6. **No feature flags system.** Use `settings.ENVIRONMENT == "production"` for any environment-specific behavior.

7. **One database.** PostgreSQL handles everything: relational data, FTS, JSONB. Do not add a separate search database.

---

## Definition of Done Checklist

A feature is done when:

- [ ] All acceptance criteria from `Features.md` pass
- [ ] Backend endpoint is tested with at least: success path, validation error path, authorization path
- [ ] TypeScript has no type errors (`tsc --noEmit` passes)
- [ ] Python has no lint errors (`ruff check .` passes)
- [ ] No hardcoded secrets or URLs
- [ ] All new environment variables added to `.env.example`
- [ ] Error states are handled (not just happy path)
- [ ] Empty states are rendered correctly in UI
- [ ] Loading states are rendered correctly in UI
- [ ] Mobile layout is verified at 375px viewport width
- [ ] Roles are enforced: viewer cannot mutate, non-admin cannot access admin routes
- [ ] Activity log entry written for meaningful user actions
- [ ] Committed to feature branch with a clear commit message

The entire project is done when:

- [ ] All phases (1–13) are complete
- [ ] All tests pass (`pytest` and `npm test`)
- [ ] `alembic upgrade head` runs cleanly on a fresh database
- [ ] Docker image builds and runs locally without errors
- [ ] GitHub Actions pipeline passes on a push to main
- [ ] App is deployed and post-deployment verification checklist (Deployment.md §9) passes
- [ ] `UI_BUILD_LOG.md` documents which pages were Stitch-generated and which required manual overrides
- [ ] `README.md` at repo root describes: project purpose, local setup in 5 steps, environment variables, deployment notes

---

## UI_BUILD_LOG.md Template

Create this file at `frontend/UI_BUILD_LOG.md` and update it as each page is built:

```markdown
# UI Build Log

## Pages Generated via Stitch

| Page | Route | Stitch Used | Notes |
|------|-------|-------------|-------|
| Login | /login | Yes | Output matched spec. Minor: adjusted form padding |
| Register | /register | Yes | Output matched spec |
| Dashboard | /dashboard | Yes | Required manual override for MeetingCard status badge colors |
| Upload Transcript | /meetings/upload | Yes | FileDropzone required manual implementation (Stitch output too generic) |
| Meeting Detail | /meetings/[id] | Yes | Two-column layout required manual adjustment for mobile |
| Action Items | /action-items | Yes | Table sorting UI required manual implementation |
| Search | /search | Yes | Output matched spec |
| Settings | /settings | Yes | Output matched spec |
| Admin Users | /admin/users | No | Manual implementation — Stitch output did not match role-management table spec |

## Manual Overrides Required

- [List any components that were fully hand-written and why Stitch was insufficient]

## Stitch Prompts Archive

[Paste the full Stitch prompt used for each page here for reproducibility]
```
