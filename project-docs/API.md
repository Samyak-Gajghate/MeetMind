# API.md — MeetMind API Reference

---

## 1. API Design Principles

- **RESTful resource-based URLs.** Nouns for resources, HTTP verbs for actions.
- **Consistent response envelope.** All responses follow the same `{data, error, meta}` structure.
- **Stateless.** Every request carries a JWT — no server-side session state.
- **Fail explicitly.** Return specific error codes and field-level validation errors, never silent failures.
- **Pagination on all list endpoints.** No endpoint returns an unbounded list.
- **Idempotent mutations where possible.** PUT and PATCH operations are safe to retry.
- **Role enforcement at the handler level.** Every endpoint declares its required role; enforcement is via FastAPI dependency injection.

**Base URL:** `https://api.meetmind.dev/v1` (production) | `http://localhost:8000/v1` (local)

---

## 2. Authentication

All endpoints except `/auth/register` and `/auth/login` require a valid JWT in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

---

## 3. Common Response Format

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 47
  }
}
```

`meta` is included only on paginated list endpoints.

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "meeting_date",
        "message": "Field is required"
      }
    ]
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `VALIDATION_ERROR` | 422 | Request body or query param validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate resource or invalid state transition |
| `PAYLOAD_TOO_LARGE` | 413 | File exceeds 5MB limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | File type not accepted |
| `RATE_LIMITED` | 429 | Too many requests |
| `PROCESSING_ERROR` | 500 | Gemini API failure or internal error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 4. Pagination / Filtering / Sorting Conventions

**Pagination query params:**
- `page` (integer, default: 1)
- `page_size` (integer, default: 20, max: 100)

**Filtering:**
- Filter params are specific to each endpoint (e.g., `?status=processed&owner_name=John`)

**Sorting:**
- `?sort=created_at&order=desc` (default: newest first)
- Allowed sort fields are listed per endpoint

---

## 5. Auth Endpoints

### POST `/auth/register`

**Description:** Register a new user.  
**Auth required:** No  

**Request body:**
```json
{
  "email": "maya@acme.com",
  "password": "SecurePass123",
  "display_name": "Maya Chen"
}
```

**Validation:**
- `email`: valid email format, max 320 chars, must be unique
- `password`: min 8 chars, must contain at least one letter and one number
- `display_name`: required, min 2 chars, max 255 chars

**Response 201:**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "a3f4b2c1d9...",
    "user": {
      "id": "a1b2c3d4-...",
      "email": "maya@acme.com",
      "display_name": "Maya Chen",
      "role": "team_member"
    }
  }
}
```

---

### POST `/auth/login`

**Auth required:** No  

**Request body:**
```json
{
  "email": "maya@acme.com",
  "password": "SecurePass123"
}
```

**Response 200:** Same structure as register response.  
**Response 401:** `UNAUTHORIZED` — "Invalid credentials"  

---

### POST `/auth/refresh`

**Auth required:** No (uses refresh token, not access token)  

**Request body:**
```json
{
  "refresh_token": "a3f4b2c1d9..."
}
```

**Response 200:**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### POST `/auth/logout`

**Auth required:** Yes  

**Request body:**
```json
{
  "refresh_token": "a3f4b2c1d9..."
}
```

**Response 200:**
```json
{
  "data": { "message": "Logged out successfully" }
}
```

---

## 6. User Endpoints

### GET `/users/me`

**Auth required:** Yes  
**Roles:** All  

**Response 200:**
```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "email": "maya@acme.com",
    "display_name": "Maya Chen",
    "role": "team_member",
    "is_active": true,
    "created_at": "2024-01-15T09:00:00Z"
  }
}
```

---

### PATCH `/users/me`

**Auth required:** Yes  
**Roles:** All  

**Request body (all fields optional):**
```json
{
  "display_name": "Maya Chen-Wang",
  "current_password": "SecurePass123",
  "new_password": "NewSecure456"
}
```

**Validation:**
- If `new_password` provided: `current_password` is required and must match
- `display_name`: min 2, max 255 chars

**Response 200:** Updated user object (same schema as GET `/users/me`)

---

## 7. Admin User Endpoints

### GET `/admin/users`

**Auth required:** Yes  
**Roles:** Admin only  
**Query params:** `page`, `page_size`, `?is_active=true`

**Response 200:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "email": "maya@acme.com",
      "display_name": "Maya Chen",
      "role": "team_member",
      "is_active": true,
      "last_active_at": "2024-03-10T14:30:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 8 }
}
```

---

### PATCH `/admin/users/:user_id/role`

**Auth required:** Yes  
**Roles:** Admin only  

**Request body:**
```json
{
  "role": "viewer"
}
```

**Validation:**
- `role` must be one of: `admin`, `team_member`, `viewer`
- Admin cannot change their own role

**Response 200:** Updated user object  
**Response 409:** If attempting to change own role

---

### PATCH `/admin/users/:user_id/status`

**Auth required:** Yes  
**Roles:** Admin only  

**Request body:**
```json
{
  "is_active": false
}
```

**Response 200:** Updated user object

---

## 8. Meeting Endpoints

### GET `/meetings`

**Auth required:** Yes  
**Roles:** All  
**Query params:**
- `page`, `page_size`
- `status`: `pending|processing|processed|failed`
- `sort`: `meeting_date` (default), `created_at`, `title`
- `order`: `asc|desc` (default: `desc`)

**Response 200:**
```json
{
  "data": [
    {
      "id": "b2c3d4e5-...",
      "title": "Q3 Product Planning Sync",
      "meeting_date": "2024-03-08",
      "duration_minutes": 60,
      "participant_names": ["Maya Chen", "Raj Patel", "Alice Wang"],
      "status": "processed",
      "action_item_count": 5,
      "open_action_item_count": 3,
      "decision_count": 2,
      "created_at": "2024-03-08T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 12 }
}
```

---

### POST `/meetings`

**Description:** Upload a transcript and create a meeting record. Uses `multipart/form-data`.  
**Auth required:** Yes  
**Roles:** Admin, Team Member  

**Request (multipart/form-data):**
```
title: "Q3 Product Planning Sync"
meeting_date: "2024-03-08"
duration_minutes: 60              (optional)
participant_names: ["Maya Chen", "Raj Patel"]
file: [binary .txt file]
```

**Validation:**
- `title`: required, max 500 chars
- `meeting_date`: required, valid ISO date, not in the future
- `participant_names`: required, at least 1 name
- `file`: required, `.txt` extension, max 5MB

**Response 201:**
```json
{
  "data": {
    "meeting_id": "b2c3d4e5-...",
    "job_id": "c3d4e5f6-...",
    "status": "pending",
    "message": "Meeting uploaded. AI processing has started."
  }
}
```

---

### GET `/meetings/:meeting_id`

**Auth required:** Yes  
**Roles:** All  

**Response 200:**
```json
{
  "data": {
    "id": "b2c3d4e5-...",
    "title": "Q3 Product Planning Sync",
    "meeting_date": "2024-03-08",
    "duration_minutes": 60,
    "participant_names": ["Maya Chen", "Raj Patel", "Alice Wang"],
    "status": "processed",
    "uploaded_by": {
      "id": "a1b2c3d4-...",
      "display_name": "Maya Chen"
    },
    "summary": {
      "summary_text": "The team discussed the Q3 roadmap priorities..."
    },
    "action_items": [
      {
        "id": "d4e5f6a7-...",
        "description": "Draft API rate limit policy document",
        "owner_name": "Raj Patel",
        "due_date": "2024-03-15",
        "priority": "high",
        "status": "open"
      }
    ],
    "decisions": [
      {
        "id": "e5f6a7b8-...",
        "description": "The team agreed to use OAuth 2.0 for the partner API authentication."
      }
    ],
    "created_at": "2024-03-08T10:00:00Z"
  }
}
```

**Response 404:** If meeting not found or soft-deleted

---

### DELETE `/meetings/:meeting_id`

**Auth required:** Yes  
**Roles:** Admin only  

**Behavior:** Soft delete — sets `deleted_at = NOW()`.

**Response 200:**
```json
{
  "data": { "message": "Meeting deleted successfully" }
}
```

---

## 9. Processing Endpoints

### GET `/meetings/:meeting_id/status`

**Auth required:** Yes  
**Roles:** All  

**Response 200:**
```json
{
  "data": {
    "meeting_id": "b2c3d4e5-...",
    "job_id": "c3d4e5f6-...",
    "status": "processing",
    "attempt_count": 1,
    "error_message": null,
    "started_at": "2024-03-08T10:01:05Z",
    "completed_at": null
  }
}
```

---

### POST `/meetings/:meeting_id/reprocess`

**Auth required:** Yes  
**Roles:** Admin, Team Member  

**Behavior:** Creates a new processing job. Clears previous AI output (summaries, action items, decisions — soft delete). Fails if a job is currently in `processing` state.

**Response 201:**
```json
{
  "data": {
    "job_id": "f6a7b8c9-...",
    "status": "queued"
  }
}
```

**Response 409:** "Meeting is currently being processed. Please wait before retrying."

---

## 10. Action Item Endpoints

### GET `/action-items`

**Auth required:** Yes  
**Roles:** All  
**Query params:**
- `page`, `page_size`
- `status`: `open|in_progress|done`
- `priority`: `high|medium|low`
- `owner_name`: string (partial match)
- `meeting_id`: UUID
- `overdue`: boolean — filters to items where `due_date < today AND status != done`
- `sort`: `due_date` (default), `priority`, `created_at`
- `order`: `asc|desc`

**Response 200:**
```json
{
  "data": [
    {
      "id": "d4e5f6a7-...",
      "meeting_id": "b2c3d4e5-...",
      "meeting_title": "Q3 Product Planning Sync",
      "meeting_date": "2024-03-08",
      "description": "Draft API rate limit policy document",
      "owner_name": "Raj Patel",
      "due_date": "2024-03-15",
      "priority": "high",
      "status": "open",
      "is_overdue": false,
      "created_at": "2024-03-08T10:01:18Z"
    }
  ],
  "meta": { "page": 1, "page_size": 25, "total": 34 }
}
```

---

### PATCH `/action-items/:action_item_id`

**Auth required:** Yes  
**Roles:** Admin, Team Member  

**Request body (all fields optional):**
```json
{
  "status": "in_progress",
  "owner_name": "Alice Wang",
  "due_date": "2024-03-20"
}
```

**Validation:**
- `status` must be: `open`, `in_progress`, or `done`
- `due_date`: valid ISO date if provided
- `owner_name`: max 255 chars

**Response 200:** Updated action item object  
**Response 403:** Viewer role attempting update

---

## 11. Search Endpoints

### GET `/search`

**Auth required:** Yes  
**Roles:** All  
**Query params:**
- `q` (required): search query, min 2 chars, max 200 chars
- `page`, `page_size`

**Response 200:**
```json
{
  "data": {
    "meetings": [
      {
        "id": "b2c3d4e5-...",
        "title": "Q3 Product Planning Sync",
        "meeting_date": "2024-03-08",
        "snippet": "The team agreed to use <b>OAuth</b> 2.0 for the partner API..."
      }
    ],
    "action_items": [
      {
        "id": "d4e5f6a7-...",
        "description": "Draft <b>OAuth</b> integration spec",
        "owner_name": "Alice Wang",
        "meeting_title": "Q3 Product Planning Sync",
        "meeting_id": "b2c3d4e5-...",
        "status": "open"
      }
    ]
  },
  "meta": {
    "query": "OAuth",
    "total_meetings": 2,
    "total_action_items": 1
  }
}
```

**Response 422:** If `q` is missing or under 2 chars

---

## 12. Notification Endpoints

### GET `/notifications`

**Auth required:** Yes  
**Roles:** All  

**Response 200:**
```json
{
  "data": {
    "unread_count": 2,
    "notifications": [
      {
        "id": "f7a8b9c0-...",
        "type": "processing_completed",
        "message": "Your meeting 'Q3 Planning Sync' has been processed.",
        "related_meeting_id": "b2c3d4e5-...",
        "is_read": false,
        "created_at": "2024-03-08T10:01:18Z"
      }
    ]
  }
}
```

---

### PATCH `/notifications/:notification_id/read`

**Auth required:** Yes  
**Roles:** All (own notifications only)  

**Response 200:**
```json
{
  "data": { "id": "f7a8b9c0-...", "is_read": true }
}
```

### PATCH `/notifications/read-all`

**Auth required:** Yes  
**Roles:** All  

Marks all of the current user's notifications as read.

**Response 200:**
```json
{
  "data": { "marked_read": 4 }
}
```

---

## 13. Activity Log Endpoints

### GET `/admin/activity-logs`

**Auth required:** Yes  
**Roles:** Admin only  
**Query params:** `page`, `page_size`, `user_id`, `entity_type`, `sort=created_at&order=desc`

**Response 200:**
```json
{
  "data": [
    {
      "id": "g8b9c0d1-...",
      "user": { "id": "a1b2c3d4-...", "display_name": "Maya Chen" },
      "action": "meeting.uploaded",
      "entity_type": "meeting",
      "entity_id": "b2c3d4e5-...",
      "metadata": { "meeting_title": "Q3 Product Planning Sync" },
      "created_at": "2024-03-08T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 50, "total": 142 }
}
```

---

## 14. Idempotency and Security Considerations

- **Reprocess endpoint:** Checks for in-flight jobs before creating a new one (409 on conflict). Safe to retry if the first request timed out before receiving a response.
- **Action item PATCH:** Idempotent — PATCHing with the same values produces no visible change and returns the current state.
- **File upload:** Not idempotent by design — uploading the same file twice creates two meeting records. User confirmation should be in the UI for duplicate detection.
- **JWT validation:** Every protected request validates JWT signature, expiry, and that the user is still active (`is_active = true`). A deactivated user's valid JWT is rejected.
- **RBAC enforcement:** Role is read from the JWT payload and cross-checked against the database on sensitive operations (admin actions). JWT role claim cannot be the sole source of truth for admin operations.
- **Input sanitization:** All text fields are stripped of leading/trailing whitespace. Transcript content is sanitized before being included in the Gemini prompt (see Security.md).

---

## 15. Rate Limiting

| Endpoint | Limit |
|---------|-------|
| `POST /auth/login` | 10 requests / minute per IP |
| `POST /auth/register` | 5 requests / minute per IP |
| `POST /meetings` (upload) | 10 requests / minute per user |
| `POST /meetings/:id/reprocess` | 3 requests / minute per user |
| `GET /search` | 30 requests / minute per user |
| All other endpoints | 100 requests / minute per user |

Rate limit headers returned on all responses:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1709901600
```
