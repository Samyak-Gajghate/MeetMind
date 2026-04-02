# UIUX.md — MeetMind UI/UX Specification

---

## 1. Design Principles

1. **Data-forward:** The interface exists to surface structured information quickly. Data density is preferred over decoration.
2. **Clarity of status:** Every meeting and action item has a clear, unambiguous status. Status is always visible without scrolling or hovering.
3. **Minimal chrome:** Navigation and UI structure stay out of the way of content. The focus is always on the meeting or action item being viewed.
4. **Progressive disclosure:** Summary-level information is shown first; detail is available on demand. Lists are scannable before they are readable.
5. **Predictable interaction:** Actions are where users expect them. Editing happens inline or in sheets, not in separate pages.
6. **Accessibility by default:** Color is never the only signal. All interactive elements are keyboard-navigable. Sufficient contrast everywhere.

---

## 2. Visual Style

**Aesthetic:** Clean, minimal, and data-forward. Reference: Notion for information architecture, Linear for data density and status management, Vercel dashboard for deployment/job status UX.

**Color palette:**
- Background: `#FAFAFA` (off-white, not pure white — reduces eye strain)
- Surface: `#FFFFFF` (cards, panels)
- Border: `#E5E7EB` (gray-200)
- Primary accent: `#2563EB` (blue-600) — used for primary buttons, links, active nav items
- Success: `#16A34A` (green-600)
- Warning: `#D97706` (amber-600)
- Danger: `#DC2626` (red-600)
- Text primary: `#111827` (gray-900)
- Text secondary: `#6B7280` (gray-500)
- Text muted: `#9CA3AF` (gray-400)

**Typography:**
- Font family: `Inter` (Google Fonts) — clean, readable at small sizes
- Heading sizes: `text-2xl` for page titles, `text-xl` for section headers, `text-base` for card titles
- Body: `text-sm` (14px) for most UI text, `text-xs` (12px) for metadata and labels
- Monospace: `JetBrains Mono` for transcript content display

**Spacing system:** Tailwind defaults (4px base unit). Standard section padding: `p-6`. Card padding: `p-4`. Gap between list items: `gap-3`.

**Border radius:** `rounded-lg` (8px) for cards and panels, `rounded-md` (6px) for buttons and inputs, `rounded-full` for badges and avatars.

**Shadows:** `shadow-sm` for cards (subtle lift), `shadow-md` for dropdowns and modals.

---

## 3. Information Architecture

```
/                           → Redirects to /dashboard if authenticated, /login if not
/login                      → Login page
/register                   → Registration page
/dashboard                  → Meeting list (main view)
/meetings/upload            → Upload transcript form
/meetings/:id               → Meeting detail (summary, action items, decisions)
/action-items               → Global action item list
/search                     → Search results page
/settings                   → User profile settings
/admin/users                → Admin: user management (Admin role only)
```

---

## 4. Navigation Structure

**Left sidebar (persistent, collapsible on mobile):**

```
[MeetMind logo]

Nav items:
  📋 Dashboard           → /dashboard
  ✅ Action Items        → /action-items
  🔍 Search              → /search

[divider]

⚙️ Settings             → /settings
[Admin only] 👥 Team    → /admin/users

[Bottom of sidebar]
[User avatar] [Name] [Role badge]
```

**Top bar (right side):**
- 🔔 Notification bell with unread count badge
- Notification dropdown panel (opens on click)
- [Upload Transcript] primary button (visible on dashboard)

**Mobile navigation:**
- Hamburger menu collapses sidebar into a slide-out drawer
- Bottom tab bar (dashboard, action items, search, settings) on mobile

---

## 5. Screen-by-Screen UI Specification

---

### Screen 1: Login / Landing (`/login`)

**Purpose:** Authenticate existing users. Entry point for unauthenticated visitors.

**Layout:** Centered card on a light gray background. No sidebar. Full-page centered column.

**Components:**
- MeetMind logo + wordmark (top center of card)
- Tagline: "Turn meetings into action." (below logo, muted text)
- Form: Email input, Password input, [Sign In] button (full-width, primary blue)
- "Don't have an account? Register" link (bottom of card)

**Form behavior:**
- Email: `type="email"`, required, placeholder "you@company.com"
- Password: `type="password"`, required, placeholder "Password"
- Submit: disabled while loading; shows spinner on button when submitting
- On success: redirect to `/dashboard`
- On error: show inline error below form ("Invalid email or password")

**Empty / error states:**
- Invalid credentials → red inline error below form, fields not cleared
- Server error → "Something went wrong. Please try again." toast (top-right)

---

### Screen 2: Registration (`/register`)

**Layout:** Same as Login — centered card.

**Components:**
- Same logo + tagline
- Form: Full name input, Email input, Password input, Confirm Password input, [Create Account] button
- "Already have an account? Sign in" link

**Form behavior:**
- Password mismatch → inline error on Confirm Password field before submit
- Successful registration → redirect to `/dashboard` with welcome toast

---

### Screen 3: Dashboard (`/dashboard`)

**Purpose:** Primary view. Shows meeting history with status, pagination, and CTA to upload.

**Layout:**
- Sidebar (left, fixed) + Main content area (right)
- Top of main content: page title "Meetings", filter bar, [Upload Transcript] button (top-right)
- Content: meeting card list OR empty state

**Filter bar (below title):**
- Status filter: All | Pending | Processing | Processed | Failed (pill buttons)
- Date range picker (optional, v1: simple month dropdown)
- Sort dropdown: Newest first | Oldest first | Most action items

**Meeting card:**
```
[Status badge]   [Meeting Title]                    [Date]
                 [Participant avatars + overflow]
                 [N open action items] · [M decisions]
```
- Status badge colors: gray=Pending, amber=Processing, green=Processed, red=Failed
- Clicking anywhere on card → navigates to `/meetings/:id`
- Cards have `hover:shadow-md` transition and subtle border highlight

**Pagination:**
- "Showing 1–20 of 47 meetings"
- Previous / Next buttons at bottom
- Page number indicator

**Empty state (no meetings):**
```
[Upload icon illustration]
"No meetings yet"
"Upload your first meeting transcript to get started."
[Upload Transcript] → primary button
```

**Loading state (initial page load):**
- 3 skeleton card rows (gray animated pulse blocks)

---

### Screen 4: Upload Transcript (`/meetings/upload`)

**Purpose:** Form to upload a meeting transcript file with metadata.

**Layout:**
- Sidebar + main content. Narrower content column (max-width ~640px, centered).
- Breadcrumb: Dashboard › Upload Transcript

**Form sections:**

**Section 1: Meeting Details**
- Title (required): text input, placeholder "e.g. Q3 Planning Sync"
- Meeting Date (required): date picker
- Duration (optional): number input, "minutes", placeholder "60"
- Participants (required): text input, placeholder "Alice, Bob, Charlie" — comma-separated names

**Section 2: Transcript**
- File upload area: dashed border dropzone
  - "Drag & drop your .txt file here, or click to browse"
  - Shows file name and size after selection
  - Accepted types: `.txt` only
  - Max size: 5MB

**Buttons:**
- [Upload & Process] → primary button, full-width
- [Cancel] → text link back to dashboard

**Form behavior:**
- Validation fires on submit (not on blur in v1)
- File type validation: if non-.txt selected → inline error "Only .txt files are accepted"
- File size: if > 5MB → inline error "File must be under 5MB"
- On submit: button shows spinner "Uploading...", then "Processing queued!"
- On success: redirect to `/meetings/:id` with toast "Meeting uploaded — AI processing started"

**Error states:**
- Network error during upload → "Upload failed. Please check your connection and try again."
- Server error → "Something went wrong. Please try again."

---

### Screen 5: Meeting Detail (`/meetings/:id`)

**Purpose:** Show all AI-extracted information for a single meeting.

**Layout:**
- Sidebar + two-column main content (left: summary + decisions; right: action items panel)
- On mobile: single-column stacked

**Top section:**
- Meeting title (h1)
- Date · Duration · Participants (chips/tags)
- Status badge + "Reprocess" button (shown if status = failed OR Admin/Team Member)

**Processing pending state:**
```
[Animated spinner]
"AI is processing your transcript..."
"This usually takes 15–30 seconds."
[Checks every 3 seconds via polling]
```

**Processing failed state:**
```
[Warning icon]
"Processing failed"
[Error message from job record]
[Retry Processing] → button
```

**Left column (after processing complete):**

*Summary section:*
- "Summary" subheading
- Summary text (paragraph, `text-sm`, line-height 1.7)
- Truncated at 300 chars with "Show more" toggle if long

*Decisions section:*
- "Key Decisions" subheading
- Numbered list of decisions
- Each decision: text block with subtle left border (`border-l-2 border-blue-400`)
- Empty state: "No key decisions were identified in this transcript."

**Right column:**

*Action Items panel:*
- "Action Items" subheading + count badge
- Each action item row:
  ```
  [Priority badge]  [Description]
                    Owner: [name]  Due: [date or "No date"]
                    [Status dropdown]
  ```
- Priority badge: red=high, yellow=medium, gray=low
- Status dropdown: Open → In Progress → Done (only for Admin/Team Member; read-only for Viewer)
- Empty state: "No action items were found in this meeting."

---

### Screen 6: Action Items (`/action-items`)

**Purpose:** Global view of all action items across all meetings.

**Layout:**
- Sidebar + full-width main content
- Filter row + sortable table

**Filter row:**
- Status filter: All | Open | In Progress | Done | Overdue
- Owner filter: text input (filters by owner name string)
- Priority filter: All | High | Medium | Low

**Table columns:**
| # | Description | Owner | Meeting | Due Date | Priority | Status |
- Description truncated at 80 chars, hover shows full text in tooltip
- Meeting column: linked text → `/meetings/:id`
- Due date: overdue dates shown in red with "(Overdue)" label
- Status: inline dropdown (editable for Admin/Team Member)

**Sorting:** Click column headers to sort (meeting date, due date, priority, status)

**Empty state:** "No action items yet. Upload a meeting transcript to get started."

---

### Screen 7: Search (`/search`)

**Purpose:** Search across meeting content.

**Layout:**
- Sidebar + main content
- Large search input at top (with search icon, keyboard shortcut hint ⌘K)
- Results below, grouped by type

**Search input behavior:**
- Auto-focuses on page load
- Debounce: 300ms before firing search
- Shows "Searching..." spinner while in flight
- Clears with × button

**Results layout:**

```
[Section: Meetings (N results)]
  [Meeting result card]
    Meeting title
    Date · Matching snippet highlighted
    Link → /meetings/:id

[Section: Action Items (N results)]
  [Action item row]
    Description (match highlighted)
    Owner · Meeting title (linked) · Status badge
```

**Match highlighting:** Bold the matching substring in results.

**Empty state (no results):**
```
"No results for '{query}'"
"Try different keywords or check your spelling."
```

**Empty state (no query yet):**
```
[Search icon]
"Search meetings, action items, and decisions"
"Type at least 2 characters to begin"
```

---

### Screen 8: Settings (`/settings`)

**Purpose:** User profile management.

**Layout:**
- Sidebar + centered content column (max-width 480px)
- Sections separated by dividers

**Sections:**
1. **Profile:** Display name (editable), Email (read-only), Role badge (read-only)
2. **Change Password:** Current password, New password, Confirm new password
3. **Danger Zone:** (Admin only) — not shown to other roles

**Form behavior:**
- Separate save buttons per section
- Success: inline "Saved" confirmation with green checkmark
- Error: inline error message

---

### Screen 9: Admin — User Management (`/admin/users`)

**Only visible to Admin role. Redirects others to /dashboard.**

**Layout:**
- Sidebar + full-width table

**Table columns:**
| Name | Email | Role | Status | Last Active | Actions |

**Actions per row:**
- Change role dropdown (cannot change own role)
- Deactivate / Reactivate toggle

**Invite user section (top-right):**
- [Invite User] button → modal with email input + role selector
- In v1, invitation is immediate (no email sent — user is created with a temporary password shown once)

---

## 6. Component Inventory

| Component | Location | Description |
|-----------|----------|-------------|
| `StatusBadge` | Global | Color-coded pill for meeting/job status |
| `PriorityBadge` | Action Items | High/Medium/Low color-coded pill |
| `MeetingCard` | Dashboard | Clickable card for meeting list |
| `ActionItemRow` | Meeting Detail, Action Items page | Row with inline status dropdown |
| `ProcessingState` | Meeting Detail | Spinner + polling wrapper |
| `FileDropzone` | Upload form | Drag & drop + file validation |
| `SearchResultCard` | Search page | Meeting or action item result with highlight |
| `NotificationPanel` | Top bar | Dropdown with notification list |
| `EmptyState` | Dashboard, Action Items, Search | Centered icon + message + optional CTA |
| `SkeletonCard` | Dashboard | Loading placeholder |
| `Pagination` | Dashboard, Action Items | Page navigation |
| `ConfirmModal` | Admin actions | Confirmation dialog |
| `Toast` | Global | Top-right toast for success/error |
| `Breadcrumb` | Upload, Meeting Detail | Navigation path |
| `SidebarNav` | Global | Left navigation with role-aware items |

---

## 7. Loading States

| Context | Behavior |
|---------|----------|
| Dashboard initial load | 3 skeleton card rows (pulse animation) |
| Meeting detail (processing) | Spinner + "AI is processing..." message, polls every 3s |
| Upload form submitting | Button spinner, form fields disabled |
| Search in progress | Spinner inside search input, results area shows "Searching..." |
| Action item status update | Optimistic UI update, revert on error |
| Notification panel loading | Spinner inside dropdown |

---

## 8. Error States

| Context | Behavior |
|---------|----------|
| Gemini API failure | Meeting detail shows red banner with error message + Retry button |
| Invalid file type | Inline error on dropzone: "Only .txt files are accepted" |
| File too large | Inline error: "File must be under 5MB" |
| Login failure | Inline error below form |
| Network error (any) | Toast: "Network error. Please check your connection." |
| 403 Forbidden (role) | Redirect to dashboard with toast: "You don't have permission to do that." |
| 404 Not Found | Full-page 404 with "Go to Dashboard" link |
| Server 500 | Toast: "Something went wrong on our end. Please try again." |

---

## 9. Responsive Design Rules

- **Desktop (≥1024px):** Two-column layout on Meeting Detail. Sidebar always visible.
- **Tablet (768px–1023px):** Single column. Sidebar collapsible via hamburger.
- **Mobile (<768px):** Sidebar hidden behind drawer. Table views become card lists. Upload form uses full-width inputs.
- Font sizes do not change across breakpoints (14px body is readable on all screens).
- Touch targets minimum 44px height on mobile.

---

## 10. Accessibility Considerations

- All interactive elements have `aria-label` or visible label
- Color alone is never used to convey status — badges include text labels
- Form inputs have associated `<label>` elements (not just placeholders)
- Focus states visible on all focusable elements (`focus:ring-2 focus:ring-blue-500`)
- Keyboard navigation: tab order follows visual order; modals trap focus
- `role="status"` on loading/processing state containers for screen readers
- Alt text on all non-decorative images
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text (WCAG AA)
