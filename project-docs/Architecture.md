# Architecture.md — MeetMind System Architecture

---

## 1. High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           BROWSER / CLIENT                            │
│                   Next.js 14 (TypeScript, Tailwind)                  │
│                         Deployed on Vercel                            │
└─────────────────────────────┬────────────────────────────────────────┘
                               │ HTTPS (REST + multipart)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (Python 3.11)                     │
│                    Deployed on GCP Cloud Run                          │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │  Auth Layer  │  │  API Routers │  │   Background Tasks      │    │
│  │  JWT + RBAC  │  │  (REST)      │  │   (Gemini Processing)   │    │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘    │
│                               │                    │                 │
└───────────────────────────────┼────────────────────┼─────────────────┘
                                │                    │
            ┌───────────────────┤                    │
            │                   │                    │
            ▼                   ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  Cloud SQL       │  │  GCP Cloud       │  │  Google Gemini API   │
│  PostgreSQL 15   │  │  Storage         │  │  (gemini-1.5-pro)    │
│  (private IP)    │  │  (transcript     │  │                      │
│                  │  │   files)         │  └──────────────────────┘
└──────────────────┘  └──────────────────┘
```

---

## 2. Frontend Architecture

### Framework and Structure

Next.js 14 App Router. All routes are under `app/`. The root layout applies the sidebar and top bar for authenticated routes.

### Folder Structure

```
frontend/
├── app/
│   ├── layout.tsx                  # Root layout (fonts, global styles)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + top bar layout
│   │   ├── dashboard/page.tsx      # Meeting list
│   │   ├── meetings/
│   │   │   ├── upload/page.tsx
│   │   │   └── [id]/page.tsx       # Meeting detail
│   │   ├── action-items/page.tsx
│   │   ├── search/page.tsx
│   │   ├── settings/page.tsx
│   │   └── admin/
│   │       └── users/page.tsx
├── components/
│   ├── ui/                         # Base UI primitives
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   └── Skeleton.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── NotificationPanel.tsx
│   ├── meetings/
│   │   ├── MeetingCard.tsx
│   │   ├── MeetingList.tsx
│   │   ├── ProcessingStatus.tsx    # Polling wrapper
│   │   └── MeetingFilters.tsx
│   ├── action-items/
│   │   ├── ActionItemRow.tsx
│   │   └── ActionItemFilters.tsx
│   ├── upload/
│   │   └── FileDropzone.tsx
│   └── common/
│       ├── EmptyState.tsx
│       ├── Pagination.tsx
│       ├── SearchInput.tsx
│       └── Breadcrumb.tsx
├── lib/
│   ├── api.ts                      # Axios instance + typed API functions
│   ├── auth.ts                     # Token storage, auth helpers
│   └── utils.ts                    # Date formatting, string helpers
├── hooks/
│   ├── useAuth.ts                  # Current user state
│   ├── useMeetings.ts              # React Query hooks for meetings
│   ├── useActionItems.ts
│   ├── useSearch.ts
│   └── usePolling.ts               # Generic polling hook
├── types/
│   └── index.ts                    # Shared TypeScript interfaces
├── providers/
│   └── QueryProvider.tsx           # React Query provider
└── middleware.ts                   # Next.js middleware for auth redirect
```

### Auth Flow (Frontend)

1. User logs in → access token + refresh token received
2. Access token stored in memory (React state / `useAuth` context) — NOT in localStorage
3. Refresh token stored in `httpOnly` cookie (set by backend on login response via `Set-Cookie` header)
4. Axios interceptor checks if access token is expired before each request; if so, calls `/auth/refresh` automatically
5. If refresh fails → redirect to `/login`
6. Next.js `middleware.ts` protects all `(dashboard)` routes: if no valid token → redirect to `/login`

### State Management

- **Server state:** React Query (`@tanstack/react-query`) handles all API data: fetching, caching, background refetching, mutations
- **Client state:** `useState` / `useContext` for UI state (modal open, filter values)
- **Auth state:** `useAuth` context (wraps access token + user object in memory)
- **No Redux.** Not needed for this application's complexity level.

### Polling for Processing Status

```typescript
// usePolling.ts
const { data } = useQuery({
  queryKey: ['meeting-status', meetingId],
  queryFn: () => api.getMeetingStatus(meetingId),
  refetchInterval: (data) => {
    const status = data?.data?.status;
    if (status === 'completed' || status === 'failed') return false;
    return 3000; // Poll every 3 seconds while queued or processing
  },
  enabled: !!meetingId,
});
```

---

## 3. Backend Architecture

### Framework and Structure

FastAPI with async SQLAlchemy. All database operations are async. Background tasks use FastAPI's `BackgroundTasks` for the Gemini processing pipeline.

### Folder Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI app factory, middleware, router registration
│   ├── config.py                   # Pydantic Settings (reads env vars)
│   ├── database.py                 # SQLAlchemy async engine + session factory
│   ├── dependencies.py             # FastAPI dependency functions (get_db, get_current_user, require_role)
│   │
│   ├── models/                     # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── workspace.py
│   │   ├── meeting.py
│   │   ├── transcript.py
│   │   ├── processing_job.py
│   │   ├── meeting_summary.py
│   │   ├── action_item.py
│   │   ├── decision.py
│   │   ├── notification.py
│   │   └── activity_log.py
│   │
│   ├── schemas/                    # Pydantic request/response schemas
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── meeting.py
│   │   ├── action_item.py
│   │   ├── search.py
│   │   ├── notification.py
│   │   └── gemini.py               # Pydantic model for expected Gemini JSON output
│   │
│   ├── routers/                    # FastAPI routers (one per resource)
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── meetings.py
│   │   ├── action_items.py
│   │   ├── search.py
│   │   ├── notifications.py
│   │   └── admin.py
│   │
│   ├── services/                   # Business logic layer
│   │   ├── auth_service.py         # JWT creation, bcrypt, refresh token management
│   │   ├── meeting_service.py      # Meeting CRUD, pagination, filtering
│   │   ├── processing_service.py   # Gemini API call, retry logic, DB writes
│   │   ├── storage_service.py      # GCP Cloud Storage upload/download
│   │   ├── search_service.py       # FTS query construction
│   │   ├── notification_service.py # Create and deliver notifications
│   │   └── activity_service.py     # Write activity log entries
│   │
│   └── utils/
│       ├── security.py             # JWT encode/decode, bcrypt helpers
│       ├── rate_limit.py           # Rate limiting decorator/middleware
│       └── prompt_builder.py       # Gemini prompt construction + sanitization
│
├── migrations/                     # Alembic migration files
│   ├── env.py
│   └── versions/
│       └── 001_initial_schema.py
├── tests/
│   ├── conftest.py                 # Shared fixtures (test DB, auth headers)
│   ├── test_auth.py
│   ├── test_meetings.py
│   ├── test_processing.py
│   ├── test_action_items.py
│   └── test_search.py
├── Dockerfile
├── requirements.txt
├── alembic.ini
└── .env.example
```

---

## 4. Request Lifecycle

### Standard API Request

```
Browser → HTTPS → Cloud Run (FastAPI)
  1. CORS middleware checks origin
  2. Rate limiting middleware checks rate
  3. Router dispatches to handler
  4. `get_current_user` dependency: extracts + validates JWT → loads user from DB
  5. `require_role("admin")` dependency (if present): checks user.role
  6. Handler calls service function
  7. Service function uses async DB session (injected via `get_db` dependency)
  8. Service returns data → handler wraps in response schema
  9. Response returned with correct status code
```

### File Upload Request

```
Browser → multipart/form-data → Cloud Run
  1. Middleware + auth (same as above)
  2. Handler validates file type (extension check) and size (Content-Length)
  3. Handler calls storage_service.upload_transcript(file, meeting_id)
  4. storage_service streams file to GCS (gs://bucket/workspace/meeting_id/filename.txt)
  5. meeting_service creates Meeting record (status=pending)
  6. meeting_service creates Transcript record (gcs_uri=...)
  7. meeting_service creates ProcessingJob record (status=queued)
  8. BackgroundTask added: processing_service.process_transcript(job_id)
  9. HTTP 201 returned immediately (before background task completes)
```

### AI Processing Background Task

```
BackgroundTask: processing_service.process_transcript(job_id)
  1. Load ProcessingJob from DB
  2. Update job status → processing, set started_at = NOW()
  3. Load Transcript, get gcs_uri
  4. storage_service.download_transcript(gcs_uri) → raw text string
  5. prompt_builder.build_prompt(raw_text) → sanitized prompt string
  6. Call Gemini API (with retry logic: up to 3 attempts, exponential backoff)
  7. Receive JSON response
  8. Store raw response in job.raw_gemini_response (JSONB)
  9. Validate response against GeminiOutputSchema (Pydantic)
      - On validation failure → job status = failed, error_message = "Invalid AI response schema"
  10. Write MeetingSummary record
  11. Write ActionItem records (bulk insert)
  12. Write Decision records (bulk insert)
  13. Update ProcessingJob status → completed, set completed_at = NOW()
  14. Update Meeting status → processed
  15. Create Notification for uploading user (type=processing_completed)
  16. Write ActivityLog entry (action=meeting.processed)
```

---

## 5. RBAC Flow

```python
# In dependencies.py

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    payload = decode_jwt(token)           # Raises 401 if invalid/expired
    user = await user_repo.get_by_id(db, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    return user

def require_role(*roles: str):
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return current_user
    return role_checker

# Usage in router:
@router.delete("/meetings/{meeting_id}")
async def delete_meeting(
    meeting_id: UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    ...
```

---

## 6. Gemini API Processing Pipeline (Detail)

```
Input: GCS URI (gs://meetmind-transcripts/workspace_id/meeting_id/filename.txt)

Step 1: Fetch transcript text from GCS
  → storage_service.download_as_string(gcs_uri)
  → Returns raw UTF-8 string

Step 2: Sanitize transcript text
  → Strip HTML tags
  → Limit to first 800,000 characters (Gemini context window safety margin)
  → Remove any patterns that look like prompt injection
    (e.g., lines starting with "Ignore previous instructions")

Step 3: Build prompt
  → System prompt: specifies JSON schema, language, extraction rules
  → User prompt: "Here is the meeting transcript:\n\n{sanitized_text}"

Step 4: Call Gemini API
  → model: gemini-1.5-pro
  → generation_config: { response_mime_type: "application/json", temperature: 0.1 }
  → Retry: up to 3 times on 429 or 5xx

Step 5: Parse response
  → response.text → JSON string
  → json.loads() → dict
  → GeminiOutputSchema(**parsed_dict) → Pydantic validation

Step 6: Write to DB
  → meeting_summaries, action_items, decisions (bulk insert)
  → All in a single transaction (if any write fails, all roll back)

Step 7: Update job status → completed
```

---

## 7. Async Job Handling

FastAPI's `BackgroundTasks` is used in v1. This means:

- The background task runs in the same Cloud Run instance as the request that triggered it
- If the Cloud Run instance is terminated mid-processing (e.g., scale-down), the job is orphaned
- Recovery: A scheduled Cloud Scheduler job (every 5 minutes) queries for jobs stuck in `processing` state for > 5 minutes and marks them `failed` (allowing retry)
- In v1.1: replace with Google Cloud Tasks for true async job durability

---

## 8. Scalability Considerations

| Concern | v1 Approach | Future |
|---------|------------|--------|
| Concurrent Gemini API calls | Sequential per instance; rate limiting prevents queue flood | Cloud Tasks with worker pool |
| Database connections | SQLAlchemy async pool (5–20 connections) | PgBouncer connection pooling |
| Search performance | PostgreSQL FTS with GIN indexes | Elasticsearch or pgvector for semantic search |
| File storage | GCS (infinitely scalable) | No change needed |
| Multi-tenant isolation | Single workspace in v1 | Row-level security in PostgreSQL |
| Frontend caching | Vercel CDN for static assets | Edge caching for API responses |

---

## 9. Reliability Considerations

| Failure Scenario | Handling |
|-----------------|---------|
| Gemini API 429 (rate limit) | Exponential backoff retry (2s, 4s, 8s), then mark job failed |
| Gemini API 5xx | Same retry logic |
| Gemini returns invalid JSON | Pydantic validation catches it; job marked failed with error message stored |
| Cloud Run instance crash during processing | Orphaned job recovery via Cloud Scheduler (see §7) |
| GCS upload failure | Transaction not committed; 500 returned to client |
| PostgreSQL connection failure | SQLAlchemy retry once; then 503 returned |
| Network timeout on frontend | React Query retry (3 attempts with backoff) |

---

## 10. Where Tests Live

```
backend/tests/
  conftest.py          → test database (SQLite in memory or test PostgreSQL), auth fixtures
  test_auth.py         → register, login, refresh, logout flows
  test_meetings.py     → upload, list, get, delete; permission enforcement
  test_processing.py   → Gemini mock, job status transitions, retry logic
  test_action_items.py → list, filter, PATCH status
  test_search.py       → FTS query results

frontend/src/__tests__/
  MeetingCard.test.tsx
  FileDropzone.test.tsx
  ProcessingStatus.test.tsx
  ActionItemRow.test.tsx

playwright/e2e/
  auth.spec.ts         → login, register, redirect
  upload.spec.ts       → upload flow end-to-end
  meeting-detail.spec.ts → processing poll, view summary
```

---

## 11. Modularity Rules

- Each router file handles one resource (e.g., `meetings.py` handles only meeting routes)
- Routers never call the database directly — always via a service
- Services contain all business logic and are testable without HTTP context
- Models are pure ORM definitions — no business logic
- Schemas are pure data shapes — no business logic
- `dependencies.py` is the only file that combines auth + DB session injection
- Utility functions (`utils/`) are stateless and have no imports from `models/`, `routers/`, or `services/`
