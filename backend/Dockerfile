# --- Build stage ---
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Runtime stage ---
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini .

# Non-root user for security
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Run migrations then start server
CMD ["sh", "-c", "ok=0; for i in 1 2 3 4 5; do alembic upgrade head && ok=1 && break; echo \"DB not reachable (attempt ${i}/5), retrying in 4s...\"; sleep 4; done; [ \"$ok\" = \"1\" ] || exit 1; uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]
