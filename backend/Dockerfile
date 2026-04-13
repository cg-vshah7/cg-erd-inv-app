# =============================================================================
# Multi-stage Dockerfile — backend (FastAPI)
# Stages: base → development → production
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: base — shared system deps
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS base

WORKDIR /app

# System deps: curl (health check), build tools for asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip, install wheel
RUN pip install --no-cache-dir --upgrade pip wheel

# Copy dependency lists first (layer caching)
COPY requirements.txt requirements-dev.txt ./

# ---------------------------------------------------------------------------
# Stage 2: development — all deps including dev tools
# ---------------------------------------------------------------------------
FROM base AS development

RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt

COPY . .

EXPOSE 8000

# Entrypoint: run migrations then start uvicorn with hot-reload
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"]

# ---------------------------------------------------------------------------
# Stage 3: production — production deps only
# ---------------------------------------------------------------------------
FROM base AS production

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Entrypoint: run migrations then start uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"]
