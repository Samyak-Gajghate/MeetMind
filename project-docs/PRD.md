# PRD.md — MeetMind: Internal Meeting Intelligence Assistant

---

## 1. Project Name

**MeetMind** — Internal Meeting Intelligence Assistant

---

## 2. Product Vision

MeetMind transforms unstructured meeting transcripts and notes into structured, searchable, and actionable records — reducing the operational overhead that accumulates when teams rely on manual note-taking, informal follow-ups, and institutional memory to drive work forward.

The platform is built on a single conviction: **every meeting produces decisions and commitments that deserve to be tracked with the same rigor as a task in a project management tool.** MeetMind bridges the gap between conversation and execution by using AI to extract meaning from raw meeting content and surface it in a form that teams can actually act on.

This is not a meeting recording tool. MeetMind is a **meeting intelligence layer** — it sits downstream of however teams capture meeting content (transcripts, notes, summaries) and converts that content into structured data: who owns what, by when, what was decided, and what the overall context was.

---

## 3. Problem Statement

Internal teams at mid-to-large organizations run dozens of meetings per week. The output of those meetings — decisions, action items, blockers, context — is routinely captured in inconsistent formats: a Zoom auto-transcript, a Google Doc of scattered bullet points, a Slack message sent after the call. No single system owns this data. As a result:

- **Action items get lost.** They live in someone's personal notes or a transcript that nobody re-reads.
- **Ownership is unclear.** "We said John would handle it" is not the same as John knowing he owns it.
- **Decisions are not recorded.** A week later, teams relitigate what was already decided because there is no source of truth.
- **Institutional memory degrades.** When someone leaves or joins, the context from past meetings is not recoverable.
- **Meeting ROI is invisible.** Teams cannot measure whether meetings produce follow-through without tracking action item completion rates.

This problem compounds in fast-moving organizations — like fintech startups, product teams, and ops-heavy orgs — where meeting volume is high and the cost of follow-up failure is real.

---

## 4. Target Users

**Primary:** Corporate teams at technology companies — specifically engineering, product, design, and operations teams that run high-volume internal meetings.

**Secondary:** Project managers and team leads who are responsible for follow-through on decisions and action items.

**Tertiary:** Executives and department heads who want visibility into what is being decided and acted on across multiple teams.

**Archetype organization:** A fintech company like Plaid — where internal operational efficiency is taken seriously, AI tooling is valued, and cross-functional alignment depends on clear ownership of action items from meetings.

---

## 5. User Personas

### Persona 1: Maya — Senior Product Manager

- Runs 8–12 meetings per week across engineering, design, and stakeholder syncs
- Currently pastes meeting notes into Notion manually after each call
- Main pain: action items get buried in Notion pages and nobody checks them
- What she wants: automatic extraction of action items with owners, a place to track them, and a way to search past decisions
- Tech comfort: high — uses Linear, Notion, Slack daily

### Persona 2: Raj — Engineering Team Lead

- Attends sprint planning, standups, architecture reviews, and 1:1s
- Rarely takes notes himself; depends on whoever happened to write things down
- Main pain: misses decisions made in meetings he wasn't invited to; has to reconstruct context manually
- What he wants: searchable meeting history, decision records, and notifications when he's assigned an action item
- Tech comfort: high — developer background

### Persona 3: Chloe — Operations Manager

- Coordinates cross-functional projects, tracks milestones, manages stakeholder updates
- Main pain: she is the human glue keeping track of what was decided and by whom — this is unsustainable
- What she wants: a system that does this automatically so she can focus on escalations and blockers
- Tech comfort: medium — uses spreadsheets and project tools but is not a developer

### Persona 4: David — Department VP (Viewer)

- Attends only high-level meetings; relies on reports from team leads
- Main pain: no visibility into what decisions are being made below him without asking for updates
- What he wants: a read-only view of meeting summaries and action item status across his team
- Tech comfort: low-to-medium — wants dashboards, not raw data

---

## 6. Core Use Cases

### UC-01: Upload a Meeting Transcript

A team member uploads a raw meeting transcript (plain text or `.txt` file) after a meeting. The system ingests the file, stores it, and queues it for AI processing.

### UC-02: AI Processing of Transcript

The system sends the transcript to the Gemini API with a structured prompt. Gemini returns a JSON payload containing: a meeting summary, a list of action items (with owner names, deadlines, and priority), a list of key decisions, and a list of participants extracted from the content.

### UC-03: View Meeting Summary

The team member opens the meeting record and sees the AI-generated summary, the extracted action items, and the key decisions — all organized in a clean UI.

### UC-04: Track Action Items

Action items extracted from a meeting are displayed in a dedicated Action Items view. Team members can update status (open, in progress, done), reassign owners, and filter by meeting, owner, or status.

### UC-05: Search Past Meetings

A user searches for a keyword (e.g., "API rate limit decision") and gets results from past meeting summaries, action items, and decisions that match — with links to the source meeting.

### UC-06: View Meeting History

The dashboard shows a chronological list of all meetings the user's team has uploaded, with metadata (title, date, participants, status of associated action items).

### UC-07: Manage Team and Permissions

An Admin can invite team members, assign roles (Admin, Team Member, Viewer), and manage workspace settings.

---

## 7. Business Goals

1. **Reduce time spent on post-meeting follow-up.** Target: 60% reduction in time team leads spend manually summarizing and distributing meeting notes.
2. **Increase action item completion rates.** By making action items visible, owned, and trackable, completion rates should improve measurably.
3. **Create institutional memory.** All decisions and action items from meetings should be searchable and queryable, reducing repeated context-setting.
4. **Demonstrate AI-augmented productivity ROI.** The platform should be measurable — teams can see how many action items were extracted, completed, and how long it took.

---

## 8. Success Metrics

| Metric | Target (v1) |
|--------|------------|
| Transcript → structured output latency | < 30 seconds (p95) |
| AI extraction accuracy (manual audit) | > 85% precision on action items |
| Action item completion rate (tracked users) | > 60% within deadline |
| Search result relevance (user rating) | > 4/5 |
| Time to first meeting uploaded (onboarding) | < 5 minutes |
| Weekly active users (post-launch pilot) | > 70% of invited team members |

---

## 9. Scope of v1

### In Scope

- User authentication (email/password, JWT-based)
- Three-role RBAC: Admin, Team Member, Viewer
- Workspace/team concept (single workspace per deployment in v1)
- Transcript upload (`.txt` files, up to 5MB)
- Async AI processing via Gemini API
- AI extraction of: summary, action items (owner name string, deadline, priority), decisions, participants
- Meeting detail view (summary, action items, decisions)
- Action item list with status management (open → in progress → done)
- Meeting history dashboard with pagination
- Full-text search across meetings and action items
- Processing status indicator (pending, processing, complete, failed)
- Basic notifications (in-app: "your action item has been assigned")
- GCP deployment: Cloud Run (backend), Cloud SQL (PostgreSQL), Cloud Storage (transcript files), Vercel (frontend)
- CI/CD via GitHub Actions

### Out of Scope for v1

- Audio/video file ingestion (only text transcripts)
- Real-time meeting transcription
- Native integrations with Zoom, Google Meet, or Microsoft Teams
- Calendar sync
- Email notifications
- Mobile app
- Multi-workspace support (multiple orgs)
- Billing or subscription management
- Custom AI prompt configuration by users
- Slack/Teams bot integration
- Exportable reports (PDF/CSV)
- Advanced analytics dashboards
- SSO / OAuth login (Google, Okta)

---

## 10. End-to-End User Journey

```
1. Admin creates account and sets up workspace
2. Admin invites team members (assigns roles)
3. Team member logs in and lands on Dashboard (empty state on first visit)
4. Team member clicks "Upload Transcript"
5. Team member fills in meeting metadata (title, date, participant names) and uploads .txt file
6. System stores file in GCP Cloud Storage and creates a Meeting record in PostgreSQL
7. System queues a ProcessingJob and triggers Gemini API call asynchronously
8. Dashboard shows meeting in "Processing" state with a spinner
9. Gemini API returns JSON (summary, action items, decisions)
10. Backend parses and validates JSON, writes to PostgreSQL (MeetingSummary, ActionItems, Decisions tables)
11. ProcessingJob status updated to "complete"
12. Frontend polls /api/meetings/:id/status and detects completion
13. Team member is notified (in-app) that processing is done
14. Team member opens Meeting Detail view — sees summary, action items, decisions
15. Team member updates an action item status or reassigns an owner
16. Viewer (e.g., David the VP) logs in, sees meeting list, reads summaries — cannot edit
17. Team lead searches "authentication decision" — finds the meeting where the auth approach was decided
18. Admin views all action items across meetings, filters by status = "overdue"
```

---

## 11. Key Assumptions

- Transcripts are in English (v1 only)
- Transcripts are clean enough text that Gemini can parse them without preprocessing
- The Gemini API (gemini-1.5-pro or equivalent) is available and returns valid JSON reliably enough for production use with retry logic
- Teams are small (< 100 users per workspace in v1)
- Transcript files are provided as `.txt` and will not exceed 5MB
- All team members share a single workspace in v1 (no sub-team isolation)
- The product is deployed in a single GCP region (us-central1) in v1
- Owners extracted by AI are string names, not linked to user accounts (v1 limitation — future: name resolution)

---

## 12. Risks and Constraints

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Gemini API returns malformed or incomplete JSON | Medium | High | Validate schema strictly; implement retry with exponential backoff; surface "processing failed" state with option to retry |
| Gemini API rate limits / quota exceeded | Medium | High | Queue jobs and process sequentially; implement rate limiter on processing endpoint |
| Low extraction accuracy for poorly written transcripts | High | Medium | Document limitations clearly; allow manual editing of action items (v1.1) |
| GCP service costs exceed budget | Low | Medium | Use Cloud Run min-instances=0; use Cloud SQL smallest tier; set Cloud Storage lifecycle rules |
| Prompt injection via malicious transcript content | Medium | High | Sanitize transcript content before insertion into prompt; enforce output JSON schema validation |
| Users upload non-transcript files | Low | Low | Validate file type and content server-side |
| Action item owner names do not match actual users | High | Medium | In v1, owners are stored as strings; resolution is a v2 feature |
