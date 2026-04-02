# Deployment.md — MeetMind Deployment Guide

---

## 1. Local Development Setup

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20.x | `nvm install 20` |
| Python | 3.11.x | `pyenv install 3.11` |
| PostgreSQL | 15.x | `brew install postgresql@15` or Docker |
| Docker | Latest | https://docker.com |
| GCP CLI (`gcloud`) | Latest | https://cloud.google.com/sdk |
| Git | Latest | System package manager |

---

### Step 1: Clone Repository

```bash
git clone https://github.com/yourname/meetmind.git
cd meetmind
```

---

### Step 2: Backend Setup

```bash
cd backend

# Create virtual environment
python3.11 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy env file and fill in values
cp .env.example .env
# Edit .env with your local values (see environment variables section below)
```

---

### Step 3: Database Setup (Local)

**Option A: Docker PostgreSQL (recommended for local)**

```bash
docker run -d \
  --name meetmind-postgres \
  -e POSTGRES_USER=meetmind \
  -e POSTGRES_PASSWORD=meetmind_dev \
  -e POSTGRES_DB=meetmind \
  -p 5432:5432 \
  postgres:15

# Set in .env:
# DATABASE_URL=postgresql+asyncpg://meetmind:meetmind_dev@localhost:5432/meetmind
```

**Option B: Local PostgreSQL**

```bash
createdb meetmind
# Set DATABASE_URL accordingly
```

---

### Step 4: Run Migrations

```bash
cd backend
alembic upgrade head
```

This creates all tables and runs seed data. Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade  -> 001_initial_schema
INFO  [alembic.runtime.migration] Running upgrade 001 -> 002_seed_data
```

---

### Step 5: Run Backend

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: http://localhost:8000/docs

---

### Step 6: Frontend Setup

```bash
cd frontend
npm install

# Copy env file
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000/v1
```

---

### Step 7: Run Frontend

```bash
cd frontend
npm run dev
```

App available at: http://localhost:3000

---

## 2. Environment Variables

### Backend (`.env`)

```bash
# Required
DATABASE_URL=postgresql+asyncpg://meetmind:meetmind_dev@localhost:5432/meetmind
GEMINI_API_KEY=AIza...
GCP_PROJECT_ID=meetmind-prod-123456
GCP_BUCKET_NAME=meetmind-transcripts-dev
JWT_SECRET=your-minimum-32-char-random-secret-here
ALLOWED_ORIGINS=http://localhost:3000

# Optional / defaulted
ENVIRONMENT=development
LOG_LEVEL=INFO
MAX_UPLOAD_SIZE_MB=5
GEMINI_MODEL=gemini-1.5-pro
GEMINI_MAX_RETRIES=3
```

### Frontend (`.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/v1
```

### Production (GCP Secret Manager + Cloud Run env vars)

Secrets stored in GCP Secret Manager:
- `meetmind-jwt-secret` → `JWT_SECRET`
- `meetmind-gemini-api-key` → `GEMINI_API_KEY`
- `meetmind-db-url` → `DATABASE_URL`

Cloud Run env vars (non-secret):
- `GCP_PROJECT_ID` — set directly in Cloud Run config
- `GCP_BUCKET_NAME` — set directly in Cloud Run config
- `ALLOWED_ORIGINS` — set directly in Cloud Run config
- `ENVIRONMENT=production`

---

## 3. GCP Infrastructure Setup

### Step 1: Create GCP Project

```bash
gcloud projects create meetmind-prod --name="MeetMind"
gcloud config set project meetmind-prod
gcloud billing accounts list
gcloud billing projects link meetmind-prod --billing-account=ACCOUNT_ID
```

### Step 2: Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

### Step 3: Create Cloud SQL Instance

```bash
gcloud sql instances create meetmind-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --no-assign-ip \
  --network=default \
  --backup-start-time=03:00 \
  --enable-point-in-time-recovery \
  --retained-backups-count=7

gcloud sql databases create meetmind --instance=meetmind-db
gcloud sql users create meetmind --instance=meetmind-db --password=SECURE_DB_PASSWORD
```

Connection string format for Cloud Run:
```
postgresql+asyncpg://meetmind:PASSWORD@/meetmind?host=/cloudsql/meetmind-prod:us-central1:meetmind-db
```

### Step 4: Create GCS Bucket

```bash
gsutil mb -p meetmind-prod -c STANDARD -l us-central1 gs://meetmind-transcripts-prod

# Set lifecycle rule: delete objects older than 365 days
gsutil lifecycle set lifecycle.json gs://meetmind-transcripts-prod
```

`lifecycle.json`:
```json
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 365}
    }
  ]
}
```

### Step 5: Create Service Account

```bash
gcloud iam service-accounts create meetmind-backend \
  --display-name="MeetMind Backend Service Account"

# Grant Cloud SQL access
gcloud projects add-iam-policy-binding meetmind-prod \
  --member="serviceAccount:meetmind-backend@meetmind-prod.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Grant Storage access (bucket-level only)
gsutil iam ch \
  serviceAccount:meetmind-backend@meetmind-prod.iam.gserviceaccount.com:objectAdmin \
  gs://meetmind-transcripts-prod

# Grant Secret Manager access
gcloud projects add-iam-policy-binding meetmind-prod \
  --member="serviceAccount:meetmind-backend@meetmind-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 6: Create Secrets in Secret Manager

```bash
echo -n "your-jwt-secret-here" | \
  gcloud secrets create meetmind-jwt-secret --data-file=-

echo -n "AIza..." | \
  gcloud secrets create meetmind-gemini-api-key --data-file=-

echo -n "postgresql+asyncpg://..." | \
  gcloud secrets create meetmind-db-url --data-file=-
```

### Step 7: Create Artifact Registry Repository

```bash
gcloud artifacts repositories create meetmind-backend \
  --repository-format=docker \
  --location=us-central1 \
  --description="MeetMind backend Docker images"
```

---

## 4. Docker Containerization

### Backend `Dockerfile`

```dockerfile
# --- Build stage ---
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# --- Runtime stage ---
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini .

# Ensure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Non-root user for security
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Run migrations then start server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]
```

### Build and Push Locally (for testing)

```bash
cd backend

# Build
docker build -t us-central1-docker.pkg.dev/meetmind-prod/meetmind-backend/api:latest .

# Configure Docker for GCP
gcloud auth configure-docker us-central1-docker.pkg.dev

# Push
docker push us-central1-docker.pkg.dev/meetmind-prod/meetmind-backend/api:latest
```

---

## 5. Backend Deployment (Cloud Run)

```bash
gcloud run deploy meetmind-backend \
  --image=us-central1-docker.pkg.dev/meetmind-prod/meetmind-backend/api:latest \
  --platform=managed \
  --region=us-central1 \
  --service-account=meetmind-backend@meetmind-prod.iam.gserviceaccount.com \
  --add-cloudsql-instances=meetmind-prod:us-central1:meetmind-db \
  --set-env-vars="GCP_PROJECT_ID=meetmind-prod,GCP_BUCKET_NAME=meetmind-transcripts-prod,ENVIRONMENT=production,ALLOWED_ORIGINS=https://meetmind.vercel.app" \
  --set-secrets="JWT_SECRET=meetmind-jwt-secret:latest,GEMINI_API_KEY=meetmind-gemini-api-key:latest,DATABASE_URL=meetmind-db-url:latest" \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --concurrency=80 \
  --allow-unauthenticated
```

Cloud Run URL will be: `https://meetmind-backend-XXXX-uc.a.run.app`

---

## 6. Frontend Deployment (Vercel)

```bash
cd frontend

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard or CLI:
vercel env add NEXT_PUBLIC_API_URL production
# Value: https://meetmind-backend-XXXX-uc.a.run.app/v1
```

**Alternatively — via Vercel dashboard:**
1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set output directory: `.next`
4. Add environment variable `NEXT_PUBLIC_API_URL`
5. Every push to `main` auto-deploys

---

## 7. GitHub Actions CI/CD Pipeline

### `.github/workflows/deploy.yml`

```yaml
name: Deploy MeetMind

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  GCP_PROJECT_ID: meetmind-prod
  GCP_REGION: us-central1
  ARTIFACT_REGISTRY: us-central1-docker.pkg.dev/meetmind-prod/meetmind-backend
  IMAGE_NAME: api

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: meetmind_test
          POSTGRES_PASSWORD: test_pass
          POSTGRES_DB: meetmind_test
        ports: [5432:5432]
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run tests
        env:
          DATABASE_URL: postgresql+asyncpg://meetmind_test:test_pass@localhost:5432/meetmind_test
          JWT_SECRET: test-secret-at-least-32-chars-long
          GEMINI_API_KEY: test-key
          GCP_PROJECT_ID: test-project
          GCP_BUCKET_NAME: test-bucket
        run: |
          cd backend
          pytest tests/ -v --cov=app --cov-report=term-missing

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run type-check
      - run: cd frontend && npm run test

  build-and-deploy:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SERVICE_ACCOUNT_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker us-central1-docker.pkg.dev

      - name: Build Docker image
        run: |
          docker build \
            -t ${{ env.ARTIFACT_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            -t ${{ env.ARTIFACT_REGISTRY }}/${{ env.IMAGE_NAME }}:latest \
            ./backend

      - name: Push Docker image
        run: |
          docker push ${{ env.ARTIFACT_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          docker push ${{ env.ARTIFACT_REGISTRY }}/${{ env.IMAGE_NAME }}:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy meetmind-backend \
            --image=${{ env.ARTIFACT_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --platform=managed \
            --region=${{ env.GCP_REGION }} \
            --project=${{ env.GCP_PROJECT_ID }}
```

**GitHub Secrets required:**
- `GCP_SERVICE_ACCOUNT_KEY` — JSON key for a CI/CD-specific service account with permissions: `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`

---

## 8. Migration Steps (Production)

Migrations run automatically on every Cloud Run deploy (in the `CMD` of the Dockerfile: `alembic upgrade head && uvicorn ...`).

To run migrations manually:
```bash
# Connect to Cloud SQL via Cloud SQL Auth Proxy
./cloud-sql-proxy meetmind-prod:us-central1:meetmind-db &
DATABASE_URL=postgresql+asyncpg://meetmind:PASSWORD@localhost:5432/meetmind \
  alembic upgrade head
```

To roll back one migration:
```bash
alembic downgrade -1
```

---

## 9. Post-Deployment Verification Checklist

After each deployment, verify the following:

```
[ ] GET https://meetmind-backend-XXXX-uc.a.run.app/v1/health → 200 {"status": "ok"}
[ ] POST /auth/register → creates user, returns tokens
[ ] POST /auth/login → returns tokens
[ ] POST /meetings (with .txt file) → returns meeting_id and job_id
[ ] GET /meetings/:id/status → returns status field
[ ] Frontend loads at https://meetmind.vercel.app → no console errors
[ ] Login flow works end-to-end in browser
[ ] Upload flow works: file uploads, processing begins
[ ] Search returns results for a known keyword
[ ] Cloud Run logs show no ERROR-level entries in first 5 minutes
[ ] Cloud SQL connections are being made (check Cloud SQL monitoring)
[ ] GCS bucket shows new files after upload
```

---

## 10. Monitoring and Error Tracking

### Sentry Setup

Backend (`app/main.py`):
```python
import sentry_sdk
sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.ENVIRONMENT,
    traces_sample_rate=0.1,
)
```

Frontend (`app/layout.tsx`):
```typescript
import * as Sentry from "@sentry/nextjs";
Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
```

### GCP Cloud Monitoring Alerts

Set up alerts for:
- Cloud Run error rate > 1% → PagerDuty or email
- Cloud Run p95 latency > 2s
- Cloud SQL CPU > 80%
- Failed processing jobs count > 10/hour (custom metric via log-based metric)

### Health Check Endpoint

```python
@app.get("/v1/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "environment": settings.ENVIRONMENT}
```

---

## 11. Backup and Recovery

### Cloud SQL Backups

- Automated backups enabled with 7-day retention (configured during instance creation)
- Point-in-time recovery enabled
- To restore to a point in time:
```bash
gcloud sql instances restore-backup meetmind-db \
  --backup-instance=meetmind-db \
  --restore-point-in-time=2024-03-08T10:00:00Z
```

### GCS Backups

Transcript files are stored in GCS with a 365-day lifecycle. GCS is regionally redundant by default.

---

## 12. Rollback Strategy

### Cloud Run Rollback

```bash
# List recent revisions
gcloud run revisions list --service=meetmind-backend --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic meetmind-backend \
  --to-revisions=meetmind-backend-00042-abc=100 \
  --region=us-central1
```

### Database Rollback

```bash
# Via Alembic (developer machine with Cloud SQL proxy)
alembic downgrade -1
```

**Important:** Alembic `downgrade` only works if the migration has a `downgrade()` function defined. All migration files must include `downgrade()`.

### Frontend Rollback

Vercel keeps all previous deployments. In the Vercel dashboard:
- Go to Deployments
- Find the last working deployment
- Click "Promote to Production"
