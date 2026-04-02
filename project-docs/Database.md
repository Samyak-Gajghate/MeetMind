# Database.md — MeetMind Database Schema

---

## 1. Database Philosophy

MeetMind uses a normalized relational schema with a few deliberate denormalizations for read performance. Key design decisions:

- **Explicit audit trails:** Every meaningful state change has a corresponding record (`processing_jobs`, `activity_logs`). No silent mutations.
- **Soft deletes where appropriate:** Meetings and action items use `deleted_at` rather than hard DELETE to preserve referential integrity and support undo/audit.
- **AI output is stored separately from source data:** Raw transcript storage (`transcripts`) is decoupled from AI-derived output (`meeting_summaries`, `action_items`, `decisions`). This allows reprocessing without affecting source records.
- **String-based owner names in v1:** Action item owners are stored as `owner_name VARCHAR` (not a FK to `users`) because AI extraction returns names as strings and name-to-user resolution is a v1.1 feature.
- **Full-text search via PostgreSQL native FTS:** No Elasticsearch dependency. `tsvector` columns on `meetings`, `meeting_summaries`, `action_items` tables enable full-text search within PostgreSQL.
- **JSONB for raw Gemini output:** The raw JSON from each Gemini API call is stored in `processing_jobs.raw_gemini_response` for debugging and future reprocessing without re-calling the API.

---

## 2. Entity List

| Entity | Table | Description |
|--------|-------|-------------|
| User | `users` | Authenticated user with role |
| Refresh Token | `refresh_tokens` | Revocable refresh tokens per user |
| Workspace | `workspaces` | Logical grouping of teams (single workspace in v1) |
| Meeting | `meetings` | Metadata for each uploaded meeting |
| Transcript | `transcripts` | Raw transcript content or GCS reference |
| Processing Job | `processing_jobs` | Async Gemini API job state |
| Meeting Summary | `meeting_summaries` | AI-generated summary per meeting |
| Action Item | `action_items` | AI-extracted action items per meeting |
| Decision | `decisions` | AI-extracted key decisions per meeting |
| Notification | `notifications` | In-app notifications per user |
| Activity Log | `activity_logs` | Audit log of user actions |

---

## 3. Table Schemas

---

### `workspaces`

```sql
CREATE TABLE workspaces (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    slug          VARCHAR(100) UNIQUE NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Notes:**
- Single workspace in v1. Seeded on initial deployment.
- `slug` is URL-safe identifier (e.g., "acme-corp")

**Example record:**
```
id: 550e8400-e29b-41d4-a716-446655440000
name: "Acme Corp"
slug: "acme-corp"
created_at: 2024-01-15 09:00:00+00
```

---

### `users`

```sql
CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email             VARCHAR(320) UNIQUE NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    display_name      VARCHAR(255) NOT NULL,
    role              VARCHAR(50) NOT NULL DEFAULT 'team_member'
                          CHECK (role IN ('admin', 'team_member', 'viewer')),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    last_active_at    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_workspace_id ON users(workspace_id);
CREATE INDEX idx_users_email ON users(email);
```

**Constraints:**
- `email` is unique across the entire system (no per-workspace email uniqueness in v1)
- `role` is an enum-like VARCHAR with CHECK constraint (not a PostgreSQL ENUM to allow easier migration)
- `password_hash` stores bcrypt hash; raw password is never stored

**Example record:**
```
id: a1b2c3d4-...
workspace_id: 550e8400-...
email: maya@acme.com
password_hash: $2b$12$...
display_name: Maya Chen
role: team_member
is_active: true
last_active_at: 2024-03-10 14:30:00+00
```

---

### `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    VARCHAR(128) NOT NULL UNIQUE,
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

**Notes:**
- Raw token is never stored — only a SHA-256 hash of the token
- On logout: `revoked = TRUE`
- Expired tokens can be cleaned up by a periodic job (not in v1 scope — manual cleanup)

---

### `meetings`

```sql
CREATE TABLE meetings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
    title               VARCHAR(500) NOT NULL,
    meeting_date        DATE NOT NULL,
    duration_minutes    INTEGER CHECK (duration_minutes > 0),
    participant_names   TEXT[] NOT NULL DEFAULT '{}',
    status              VARCHAR(50) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Full-text search vector (populated by trigger)
    search_vector       TSVECTOR
);

CREATE INDEX idx_meetings_workspace_id ON meetings(workspace_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_meeting_date ON meetings(meeting_date DESC);
CREATE INDEX idx_meetings_uploaded_by ON meetings(uploaded_by_user_id);
CREATE INDEX idx_meetings_search_vector ON meetings USING GIN(search_vector);
CREATE INDEX idx_meetings_deleted_at ON meetings(deleted_at) WHERE deleted_at IS NULL;
```

**Notes:**
- `participant_names` is a `TEXT[]` (PostgreSQL native array of strings)
- `status` reflects the latest processing state
- `deleted_at IS NULL` partial index optimizes the common case of querying non-deleted meetings
- `search_vector` is populated by a trigger that concatenates `title` and `participant_names` for FTS

**Trigger for search_vector on meetings:**
```sql
CREATE OR REPLACE FUNCTION update_meetings_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.participant_names, ' '), '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meetings_search_vector_update
BEFORE INSERT OR UPDATE ON meetings
FOR EACH ROW EXECUTE FUNCTION update_meetings_search_vector();
```

**Example record:**
```
id: b2c3d4e5-...
workspace_id: 550e8400-...
uploaded_by_user_id: a1b2c3d4-...
title: Q3 Product Planning Sync
meeting_date: 2024-03-08
duration_minutes: 60
participant_names: {Maya Chen, Raj Patel, Alice Wang}
status: processed
deleted_at: NULL
```

---

### `transcripts`

```sql
CREATE TABLE transcripts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id    UUID NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
    gcs_uri       VARCHAR(1000),     -- gs://bucket/path/to/file.txt
    raw_text      TEXT,              -- populated for manual entry (v1.1) or after fetch
    file_name     VARCHAR(500),
    file_size_bytes INTEGER,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcripts_meeting_id ON transcripts(meeting_id);
```

**Notes:**
- `gcs_uri` and `raw_text` are mutually exclusive in v1 (file upload populates `gcs_uri`; manual entry populates `raw_text`)
- `UNIQUE` on `meeting_id` enforces one transcript per meeting
- `raw_text` may be populated after the backend fetches from GCS for processing (optional caching)

---

### `processing_jobs`

```sql
CREATE TABLE processing_jobs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id            UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    triggered_by_user_id  UUID REFERENCES users(id),
    status                VARCHAR(50) NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    attempt_count         INTEGER NOT NULL DEFAULT 0,
    error_message         TEXT,
    raw_gemini_response   JSONB,    -- stores full Gemini response for debugging
    started_at            TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processing_jobs_meeting_id ON processing_jobs(meeting_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
```

**Notes:**
- Multiple jobs can exist per meeting (reprocessing creates a new job)
- The most recent job with the highest `created_at` is the canonical job for a meeting
- `raw_gemini_response` stores the full API response JSONB — invaluable for debugging schema mismatches
- `attempt_count` tracks retry iterations within a single job

**Example record:**
```
id: c3d4e5f6-...
meeting_id: b2c3d4e5-...
status: completed
attempt_count: 1
error_message: NULL
raw_gemini_response: {"summary": "...", "action_items": [...], ...}
started_at: 2024-03-08 10:01:05+00
completed_at: 2024-03-08 10:01:18+00
```

---

### `meeting_summaries`

```sql
CREATE TABLE meeting_summaries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id     UUID NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
    job_id         UUID NOT NULL REFERENCES processing_jobs(id),
    summary_text   TEXT NOT NULL,
    search_vector  TSVECTOR,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meeting_summaries_meeting_id ON meeting_summaries(meeting_id);
CREATE INDEX idx_meeting_summaries_search_vector ON meeting_summaries USING GIN(search_vector);
```

**Trigger for search_vector on meeting_summaries:**
```sql
CREATE OR REPLACE FUNCTION update_summaries_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.summary_text, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER summaries_search_vector_update
BEFORE INSERT OR UPDATE ON meeting_summaries
FOR EACH ROW EXECUTE FUNCTION update_summaries_search_vector();
```

---

### `action_items`

```sql
CREATE TABLE action_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    job_id          UUID NOT NULL REFERENCES processing_jobs(id),
    description     TEXT NOT NULL,
    owner_name      VARCHAR(255),     -- raw string from AI extraction (v1)
    due_date        DATE,
    priority        VARCHAR(20) NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('high', 'medium', 'low')),
    status          VARCHAR(50) NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'in_progress', 'done')),
    updated_by_user_id UUID REFERENCES users(id),
    deleted_at      TIMESTAMPTZ,
    search_vector   TSVECTOR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_action_items_meeting_id ON action_items(meeting_id);
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_owner_name ON action_items(owner_name);
CREATE INDEX idx_action_items_due_date ON action_items(due_date);
CREATE INDEX idx_action_items_search_vector ON action_items USING GIN(search_vector);
CREATE INDEX idx_action_items_deleted_at ON action_items(deleted_at) WHERE deleted_at IS NULL;
```

**Trigger for search_vector:**
```sql
CREATE OR REPLACE FUNCTION update_action_items_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.owner_name, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER action_items_search_vector_update
BEFORE INSERT OR UPDATE ON action_items
FOR EACH ROW EXECUTE FUNCTION update_action_items_search_vector();
```

**Example record:**
```
id: d4e5f6a7-...
meeting_id: b2c3d4e5-...
description: "Draft API rate limit policy document"
owner_name: "Raj Patel"
due_date: 2024-03-15
priority: high
status: open
```

---

### `decisions`

```sql
CREATE TABLE decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    job_id          UUID NOT NULL REFERENCES processing_jobs(id),
    description     TEXT NOT NULL,
    search_vector   TSVECTOR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decisions_meeting_id ON decisions(meeting_id);
CREATE INDEX idx_decisions_search_vector ON decisions USING GIN(search_vector);
```

---

### `notifications`

```sql
CREATE TABLE notifications (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                 VARCHAR(100) NOT NULL,
                         -- 'processing_completed' | 'processing_failed' | 'action_item_assigned'
    message              TEXT NOT NULL,
    related_meeting_id   UUID REFERENCES meetings(id) ON DELETE SET NULL,
    related_action_item_id UUID REFERENCES action_items(id) ON DELETE SET NULL,
    is_read              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read) WHERE is_read = FALSE;
```

---

### `activity_logs`

```sql
CREATE TABLE activity_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(200) NOT NULL,
    -- e.g. 'meeting.uploaded', 'action_item.status_updated', 'user.role_changed'
    entity_type     VARCHAR(100),
    entity_id       UUID,
    metadata        JSONB,      -- additional context (e.g., old/new status values)
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
```

**Example records:**
```
action: 'meeting.uploaded',       entity_type: 'meeting',     entity_id: b2c3d4e5-...
action: 'action_item.updated',    entity_type: 'action_item', metadata: {old_status: 'open', new_status: 'done'}
action: 'user.role_changed',      entity_type: 'user',        metadata: {old_role: 'viewer', new_role: 'team_member'}
```

---

## 4. Relationships Summary

```
workspaces
  ├── users (workspace_id → workspaces.id)
  └── meetings (workspace_id → workspaces.id)

users
  ├── refresh_tokens (user_id → users.id)
  ├── meetings [uploaded_by] (uploaded_by_user_id → users.id)
  ├── action_items [updated_by] (updated_by_user_id → users.id)
  ├── notifications (user_id → users.id)
  ├── activity_logs (user_id → users.id)
  └── processing_jobs [triggered_by] (triggered_by_user_id → users.id)

meetings
  ├── transcripts (meeting_id → meetings.id, UNIQUE)
  ├── processing_jobs (meeting_id → meetings.id)
  ├── meeting_summaries (meeting_id → meetings.id, UNIQUE)
  ├── action_items (meeting_id → meetings.id)
  └── decisions (meeting_id → meetings.id)

processing_jobs
  ├── meeting_summaries (job_id → processing_jobs.id)
  ├── action_items (job_id → processing_jobs.id)
  └── decisions (job_id → processing_jobs.id)
```

---

## 5. Normalization Decisions

| Decision | Rationale |
|----------|-----------|
| `participant_names` as `TEXT[]` on `meetings` | Participants are strings in v1 (no user FK). Array avoids a join table for a simple list. |
| `owner_name` as VARCHAR on `action_items` | AI returns names as strings. Linking to `users` requires name resolution (v1.1). |
| `search_vector` denormalized onto source tables | Avoids a separate FTS index table. Updated by triggers. |
| `raw_gemini_response` JSONB on `processing_jobs` | Store raw AI output for debugging without schema constraints. |
| `meeting_summaries` as separate table | Decouples AI output from meeting metadata. Allows reprocessing to replace summaries. |
| Separate `decisions` and `action_items` tables | Different schemas, different access patterns (decisions are read-only; action items are updated frequently). |

---

## 6. Seed Data

On initial deployment, the following seed data is inserted:

```sql
-- Workspace
INSERT INTO workspaces (id, name, slug) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'MeetMind Demo Workspace', 'demo');

-- Admin user (password: 'Admin1234' — must be changed after first login)
INSERT INTO users (id, workspace_id, email, password_hash, display_name, role) VALUES
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000',
   'admin@meetmind.dev',
   '$2b$12$[bcrypt hash of Admin1234]',
   'System Admin', 'admin');
```

---

## 7. Migration Strategy

- All schema changes are managed via **Alembic** migration files
- Migration files are committed to version control
- Migrations run automatically on Cloud Run deploy (via startup command: `alembic upgrade head && uvicorn ...`)
- Rollback: `alembic downgrade -1` manually if needed
- Never edit migration files after they've been merged to `main`
- Each migration file includes both `upgrade()` and `downgrade()` functions

---

## 8. Full-Text Search Query Pattern

```sql
-- Search across meetings and summaries
SELECT
    m.id,
    m.title,
    m.meeting_date,
    ts_headline('english', ms.summary_text, q) AS snippet
FROM meetings m
JOIN meeting_summaries ms ON ms.meeting_id = m.id
, to_tsquery('english', 'authentication & API') AS q
WHERE
    m.deleted_at IS NULL
    AND (m.search_vector @@ q OR ms.search_vector @@ q)
ORDER BY ts_rank(ms.search_vector, q) DESC
LIMIT 50;
```
