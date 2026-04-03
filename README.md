# MeetMind — Internal Meeting Intelligence Assistant

MeetMind transforms unstructured meeting transcripts into structured, searchable, and actionable records. Extract decisions, action items, and summaries automatically using AI-powered processing, then track accountability and outcomes through an intuitive team interface.

## Overview

**Problem:** Internal teams run dozens of meetings per week, but decisions, action items, and context are routinely lost in scattered notes, transcripts, and informal follow-ups.

**Solution:** MeetMind bridges the gap between conversation and execution by using AI to extract and surface meeting intelligence as structured data that teams can act on.

## Key Features

- **Meeting Ingestion** — Upload transcripts and meeting notes (text, raw transcripts)
- **AI-Powered Extraction** — Automatically extract:
  - Meeting summaries (key discussions, context)
  - Action items (what, who, by when)
  - Decisions (what was decided, implications)
- **Meeting Dashboard** — Browse, filter, and search meetings across your workspace
- **Action Item Tracking** — View all action items across meetings with ownership and status
- **Search & History** — Full-text search over meeting content, decisions, and action items
- **Role-Based Access Control** — Admin, Team Member, and Viewer roles with granular permissions
- **Activity Logging** — Track who uploaded what, processed meetings, and updated items
- **Notifications** — In-app alerts for action item assignments and processing completion

## Tech Stack

### Frontend
- **Next.js 14** (App Router) with TypeScript
- **React** for interactive UI components
- **TailwindCSS** for styling
- **Shadcn/UI** for accessible, reusable components

### Backend
- **FastAPI** (Python) for async REST API
- **SQLAlchemy** (async ORM) for database operations
- **Alembic** for database migrations
- **Google Gemini API** for AI-powered extraction and summarization
- **Pydantic** for schema validation

### Data & Infrastructure
- **PostgreSQL** (Supabase) for transactional data
- **Supabase Storage** for transcript file uploads
- **Asyncpg** for high-performance async database connectivity

## Getting Started

### Prerequisites
- Node.js 18+ (frontend)
- Python 3.10+ (backend)
- PostgreSQL (or Supabase account)
- Google Cloud credentials for Gemini API and Cloud Storage
- `.env` files configured for both frontend and backend

### Installation

#### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

#### Database Setup
```bash
cd backend
# Ensure DATABASE_URL is set in .env
alembic upgrade head
```

#### Frontend Setup
```bash
cd frontend
npm install
```

### Running Locally

#### Start the Backend API
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

The backend will be available at `http://localhost:8000` with API docs at `http://localhost:8000/docs`.

#### Start the Frontend
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## Project Structure

```
MeetMind/
├── backend/                    # FastAPI backend service
│   ├── app/
│   │   ├── api/               # API route handlers
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic validation schemas
│   │   ├── services/          # Business logic (Gemini, storage)
│   │   ├── core/              # Security, dependencies, database
│   │   ├── config.py          # Configuration and environment
│   │   ├── database.py        # SQLAlchemy engine setup
│   │   └── main.py            # FastAPI app definition
│   ├── migrations/            # Alembic database migrations
│   ├── requirements.txt       # Python dependencies
│   └── Dockerfile             # Container image definition
│
├── frontend/                   # Next.js frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/          # API integration layer
│   │   │   ├── dashboard/    # Meeting dashboard page
│   │   │   ├── login/        # Auth pages
│   │   │   ├── register/
│   │   │   ├── meetings/     # Meeting detail page
│   │   │   └── layout.tsx    # Root layout with auth
│   │   └── lib/              # Utilities and API client
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
│
└── project-docs/             # Documentation
    ├── PRD.md               # Product Requirements Document
    ├── Architecture.md      # System architecture
    ├── API.md              # API reference
    ├── Database.md         # Database schema
    ├── Features.md         # Feature specifications
    ├── TechStack.md        # Technology decisions
    └── Deployment.md       # Deployment guide
```

## Environment Configuration

### Backend (.env)
```
DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname
GEMINI_API_KEY=your-google-gemini-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_BUCKET_NAME=your-storage-bucket-name
JWT_SECRET=your-jwt-secret-key
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Deployment

### Backend (Render)
The backend is deployed on Render as a containerized service. See [Deployment.md](../project-docs/Deployment.md) for detailed instructions.

### Frontend (Vercel)
The frontend is deployed on Vercel with automatic deployments on push to main branch.

## API Documentation

When running the backend locally, interactive API documentation is available at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

For detailed endpoint documentation, see [API.md](../project-docs/API.md).

## Database Schema

The application uses PostgreSQL with the following core entities:
- **users** — User accounts with role-based access control
- **workspaces** — Isolated team environments
- **meetings** — Uploaded meeting transcripts and metadata
- **transcripts** — Raw uploaded transcript content
- **meeting_summaries** — AI-generated meeting summaries
- **decisions** — Extracted decisions from meetings
- **action_items** — Extracted action items with ownership and status
- **activity_logs** — Audit trail of system activities

See [Database.md](../project-docs/Database.md) for complete schema documentation.

## Development

### Running Tests
```bash
cd backend
pytest
```

### Code Style
- **Python:** Follow PEP 8; use black and flake8
- **TypeScript/React:** Follow ESLint configuration; enable strict TS checks

### Database Migrations
```bash
cd backend
alembic revision --autogenerate -m "Description of change"
alembic upgrade head
```

## Known Limitations & Future Work

- Migration execution on Render is manual (GitHub Actions or local terminal) due to platform constraints
- Transcript file size limit: 50 MB
- Gemini API rate limiting applies to batch processing
- Real-time transcription (live meeting capture) not yet implemented

## Support & Documentation

Refer to [project-docs/](../project-docs/) for:
- Architecture decisions ([Architecture.md](../project-docs/Architecture.md))
- API specifications ([API.md](../project-docs/API.md))
- Feature details ([Features.md](../project-docs/Features.md))
- Deployment procedures ([Deployment.md](../project-docs/Deployment.md))
- Security practices ([Security.md](../project-docs/Security.md))

## License

This project is proprietary and confidential.

---

**Project Status:** ✅ Complete — All core features implemented and deployed.
