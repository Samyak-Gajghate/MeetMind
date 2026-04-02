# Features.md — MeetMind Feature Specifications

---

## Module Overview

| Module | Description |
|--------|-------------|
| M1: User Auth & RBAC | Registration, login, JWT session, role enforcement |
| M2: Transcript Ingestion | File upload, metadata entry, storage in GCP |
| M3: AI Processing | Async Gemini API call, JSON parsing, DB writes |
| M4: Meeting Dashboard | Meeting list, pagination, status indicators |
| M5: Meeting Detail | Summary, action items, decisions for a single meeting |
| M6: Action Item Tracking | Cross-meeting action item list, status management |
| M7: Search & History | Full-text search across meetings and action items |
| M8: Notifications | In-app notification for assignment and processing completion |
| M9: Settings & Admin | User management, role assignment, workspace settings |

---

## User Roles and Permissions

| Feature | Admin | Team Member | Viewer |
|---------|-------|-------------|--------|
| Register / Login | ✅ | ✅ | ✅ |
| Upload transcript | ✅ | ✅ | ❌ |
| Trigger reprocessing | ✅ | ✅ | ❌ |
| View meeting list | ✅ | ✅ | ✅ |
| View meeting detail (summary, decisions) | ✅ | ✅ | ✅ |
| View action items | ✅ | ✅ | ✅ |
| Update action item status | ✅ | ✅ | ❌ |
| Reassign action item owner | ✅ | ✅ | ❌ |
| Delete a meeting | ✅ | ❌ | ❌ |
| Search meetings | ✅ | ✅ | ✅ |
| Invite users | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ |
| View activity log | ✅ | ❌ | ❌ |
| View all notifications | ✅ | Own only | Own only |

---

## M1: User Auth & RBAC

### F1.1 — User Registration

**Description:** New users register with email and password. On registration, a user record is created with a default role of `team_member`. Admins can change roles afterward.

**Functional requirements:**
- Email must be unique across the system
- Password must be at least 8 characters, contain at least one letter and one number
- Password is hashed using bcrypt (cost factor 12) before storage
- On successful registration, a JWT access token (15-minute TTL) and refresh token (7-day TTL) are returned
- Email verification is out of scope for v1 — registration is immediate

**Acceptance criteria:**
- Given valid email and password → user record created, tokens returned, 201 status
- Given duplicate email → 409 Conflict returned with clear message
- Given password under 8 chars → 422 Unprocessable with field-level error

---

### F1.2 — Login

**Description:** Registered users authenticate with email and password.

**Functional requirements:**
- Validate credentials against stored bcrypt hash
- On success: return JWT access token + refresh token
- On failure: return 401 with generic message (do not reveal whether email exists)
- Refresh token stored in `refresh_tokens` table with expiry and revocation flag

**Acceptance criteria:**
- Valid credentials → 200 with access + refresh token
- Invalid password → 401, no token returned
- Non-existent email → 401, same message as invalid password (no enumeration)

---

### F1.3 — Token Refresh

**Description:** Client sends refresh token to get a new access token without re-authentication.

**Functional requirements:**
- Endpoint: `POST /auth/refresh`
- Validate refresh token exists in DB, is not expired, not revoked
- Return new access token (15 min TTL)
- Optionally rotate refresh token

**Acceptance criteria:**
- Valid refresh token → new access token returned
- Expired/revoked refresh token → 401

---

### F1.4 — Logout

**Description:** Revokes the user's refresh token.

**Functional requirements:**
- Endpoint: `POST /auth/logout`
- Mark refresh token as revoked in DB
- Access token is short-lived; no server-side blacklist needed

---

### F1.5 — Role-Based Access Control (RBAC)

**Description:** Every protected API endpoint checks the authenticated user's role before executing.

**Functional requirements:**
- Roles: `admin`, `team_member`, `viewer`
- Role stored on `users` table
- FastAPI dependency injection handles role enforcement per endpoint
- Unauthorized role access → 403 Forbidden

---

## M2: Transcript Ingestion

### F2.1 — Upload Transcript

**Description:** A Team Member or Admin uploads a meeting transcript as a `.txt` file along with meeting metadata.

**Functional requirements:**
- Accepted file types: `.txt` only (v1)
- Maximum file size: 5MB
- Metadata fields required: `title` (string), `meeting_date` (ISO date), `participant_names` (comma-separated string or JSON array)
- `duration_minutes` is optional
- File is uploaded to GCP Cloud Storage bucket in path: `transcripts/{workspace_id}/{meeting_id}/{filename}`
- A `meetings` record is created with status = `pending`
- A `transcripts` record is created with `gcs_uri` reference
- A `processing_jobs` record is created with status = `queued`
- Response returns `meeting_id` and `job_id`

**Acceptance criteria:**
- Valid `.txt` file + complete metadata → meeting created, file stored, job queued, 201 returned
- File > 5MB → 413 Payload Too Large
- File is `.pdf` or `.docx` → 415 Unsupported Media Type
- Missing required metadata fields → 422 with field-level errors

---

### F2.2 — Manual Note Entry (v1.1, defined now)

**Description:** User types or pastes meeting notes directly into a text area instead of uploading a file.

**Status:** Defined for v1.1. Not implemented in v1. The data model supports it (transcript text can be stored directly in `transcripts.raw_text`).

---

## M3: AI Processing

### F3.1 — Async Gemini Processing

**Description:** After a transcript is uploaded, the backend asynchronously sends it to the Gemini API and parses the structured JSON response.

**Functional requirements:**
- Processing is triggered immediately after upload (not via cron — via background task using FastAPI's `BackgroundTasks` or a task queue)
- Transcript content is fetched from GCP Cloud Storage
- A structured prompt is constructed (see AI_Instructions.md for prompt spec)
- Gemini API call uses `gemini-1.5-pro` model
- Expected JSON output schema:
  ```json
  {
    "summary": "string",
    "participants": ["string"],
    "action_items": [
      {
        "description": "string",
        "owner_name": "string",
        "due_date": "YYYY-MM-DD or null",
        "priority": "high|medium|low"
      }
    ],
    "decisions": [
      {
        "description": "string"
      }
    ]
  }
  ```
- Response is validated against this schema (Pydantic model)
- On success: write to `meeting_summaries`, `action_items`, `decisions` tables; update `processing_jobs` status to `completed`; update `meetings.status` to `processed`
- On failure: update `processing_jobs` status to `failed` with error message; update `meetings.status` to `failed`

**Retry logic:**
- Retry up to 3 times with exponential backoff (2s, 4s, 8s) on Gemini API HTTP errors (5xx, 429)
- After 3 failures, mark job as `failed`

**Acceptance criteria:**
- Transcript uploaded → within 30s (p95), processing job status is `completed`
- Gemini API returns invalid JSON → job status = `failed`, error logged, frontend shows failure state
- Gemini API returns 429 → retry with backoff, not immediately failed

---

### F3.2 — Reprocess Meeting

**Description:** Admin or Team Member can trigger reprocessing of a previously failed or completed meeting.

**Functional requirements:**
- Endpoint: `POST /meetings/:id/reprocess`
- Creates a new `processing_jobs` record
- Re-fetches transcript from GCS and re-runs AI pipeline
- Previous AI output (summaries, action items, decisions) is soft-deleted before reprocessing

**Acceptance criteria:**
- Reprocess on `failed` meeting → new job queued, old AI output cleared
- Reprocess on `processing` meeting → 409 Conflict (already in progress)

---

### F3.3 — Processing Status Polling

**Description:** Frontend polls for processing job status until complete or failed.

**Functional requirements:**
- Endpoint: `GET /meetings/:id/status`
- Returns current `processing_jobs` status: `queued | processing | completed | failed`
- Frontend polls every 3 seconds while status is `queued` or `processing`
- On `completed` → frontend reloads meeting detail

---

## M4: Meeting Dashboard

### F4.1 — Meeting List

**Description:** The dashboard shows all meetings in the workspace, sorted by date descending by default.

**Functional requirements:**
- Endpoint: `GET /meetings` with pagination (`page`, `page_size=20`)
- Each meeting card shows: title, date, participant count, processing status, action item count, open action item count
- Filters: by status (`pending|processing|processed|failed`), by date range
- Sorting: by date (default), by title, by action item count
- Viewer, Team Member, and Admin all see the same list (no meeting-level access control in v1)

**Acceptance criteria:**
- 50 meetings in DB → paginated correctly (20 per page)
- Filter by `status=failed` → only failed meetings shown
- Empty state (no meetings) → empty state UI shown with CTA to upload

---

### F4.2 — Meeting Card

**Description:** Each meeting in the list renders as a card with key metadata and status.

**Functional requirements:**
- Status badge: `Processing` (amber), `Processed` (green), `Failed` (red), `Pending` (gray)
- Action item count: total / open shown as `3 open / 5 total`
- Clicking card navigates to `/meetings/:id`

---

## M5: Meeting Detail

### F5.1 — Meeting Summary View

**Description:** Displays the AI-generated summary for a meeting.

**Functional requirements:**
- Show meeting title, date, participants list, duration if available
- Show summary text from `meeting_summaries.summary_text`
- Show processing status if not yet complete
- If status is `failed`, show error message and "Retry" button

**Acceptance criteria:**
- Processing not done → show loading/pending state
- Processing done → show summary
- No summary found (AI returned empty) → show "No summary available" message

---

### F5.2 — Action Items Section (within Meeting Detail)

**Description:** Shows all action items extracted from this meeting.

**Functional requirements:**
- List each action item with: description, owner name, due date, priority badge, current status
- Status can be updated inline (dropdown: open → in progress → done) by Team Member or Admin
- Viewer sees status but cannot edit

**Acceptance criteria:**
- 0 action items → empty state "No action items were found in this meeting"
- Status update → PUT request fires, UI updates optimistically

---

### F5.3 — Decisions Section (within Meeting Detail)

**Description:** Shows all key decisions extracted from the meeting.

**Functional requirements:**
- List each decision as a text block
- Read-only for all roles in v1
- Empty state if no decisions found

---

## M6: Action Item Tracking

### F6.1 — Global Action Item List

**Description:** A dedicated page showing all action items across all meetings.

**Functional requirements:**
- Endpoint: `GET /action-items` with filters: `status`, `owner_name`, `meeting_id`, `priority`
- Pagination: 25 per page
- Sorting: by due date (default), by priority, by meeting date
- Each row shows: description, owner, meeting title (linked), due date, priority, status
- Overdue items (due_date < today AND status != done) are highlighted

**Acceptance criteria:**
- Filter by `owner_name=John` → only John's items shown
- Overdue item → red highlight on due date
- Update status → PATCH request, row updates without page reload

---

### F6.2 — Action Item Status Update

**Description:** Team Members and Admins can change an action item's status.

**Functional requirements:**
- Endpoint: `PATCH /action-items/:id`
- Allowed fields: `status`, `owner_name`, `due_date`
- Viewer role → 403

---

## M7: Search & History

### F7.1 — Full-Text Search

**Description:** Users can search across meeting titles, summaries, action item descriptions, and decisions.

**Functional requirements:**
- Endpoint: `GET /search?q={query}`
- Uses PostgreSQL full-text search (`tsvector` / `tsquery` on relevant columns)
- Returns grouped results: meetings, action_items
- Each result includes the matching snippet and a link to the source record
- Minimum query length: 2 characters
- Maximum results returned: 50 total (across all categories)

**Acceptance criteria:**
- Search "authentication" → returns meetings where that word appears in summary or decisions
- Empty query → 422
- No results → empty state with "No results found for '{query}'"

---

## M8: Notifications

### F8.1 — In-App Notifications

**Description:** Users receive in-app notifications for key events.

**Trigger events (v1):**
- Processing completed for a meeting you uploaded
- Processing failed for a meeting you uploaded
- You were assigned as owner of an action item (name match — v1 uses string matching)

**Functional requirements:**
- Notifications stored in `notifications` table with `user_id`, `type`, `message`, `read` flag, `related_meeting_id`
- Endpoint: `GET /notifications` — returns unread count and list
- Endpoint: `PATCH /notifications/:id/read` — marks as read
- Bell icon in nav shows unread count badge
- Notifications panel opens in a dropdown (not a separate page)

---

## M9: Settings & Admin

### F9.1 — User Management (Admin Only)

**Description:** Admin can view all users in the workspace and manage roles.

**Functional requirements:**
- Endpoint: `GET /admin/users` — list all users with role and last-active
- Endpoint: `PATCH /admin/users/:id/role` — change role
- Admin cannot demote themselves (must be another admin)
- Admin can deactivate a user (`is_active = false`) — deactivated users cannot log in

### F9.2 — Profile Settings

**Description:** Any user can update their display name and change their password.

**Functional requirements:**
- Endpoint: `PATCH /users/me`
- Password change requires current password verification

---

## Non-Functional Requirements

| Requirement | Target |
|------------|--------|
| API response time (non-AI) | < 200ms p95 |
| AI processing time | < 30s p95 |
| Uptime | 99.5% |
| File upload size limit | 5MB |
| Max concurrent processing jobs | 10 (rate limited) |
| Authentication token expiry | Access: 15min, Refresh: 7 days |
| Database connection pool | 5–20 connections (Cloud SQL) |
| Search response time | < 500ms p95 |
| HTTPS only | Required in all environments except local dev |

---

## MVP vs Future Enhancements

| Feature | MVP (v1) | Future |
|---------|----------|--------|
| `.txt` transcript upload | ✅ | — |
| `.docx`, `.pdf` support | ❌ | v1.1 |
| Zoom/Google Meet integration | ❌ | v2 |
| Manual note entry | ❌ | v1.1 |
| AI summary + action items + decisions | ✅ | — |
| Owner name-to-user linking | ❌ | v1.1 |
| Email notifications | ❌ | v1.1 |
| Slack notifications | ❌ | v2 |
| Multi-workspace support | ❌ | v2 |
| Exportable reports (PDF/CSV) | ❌ | v1.1 |
| Analytics dashboard | ❌ | v2 |
| SSO / OAuth | ❌ | v1.1 |
| Action item editing (description) | ❌ | v1.1 |
| Custom AI prompts | ❌ | v2 |
| Calendar integration | ❌ | v2 |
