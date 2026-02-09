# ── Stage 1: Build Frontend ──
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Install dependencies first (caching)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./
# Build output is usually in 'dist'
RUN npm run build

# ── Stage 2: Backend ──
FROM python:3.11-slim

# Install runtime dependencies (e.g. libpq for postgres drivers)
# We don't need the full postgres server, just the client libraries if needed by psycopg2/asyncpg
RUN apt-get update && apt-get install -y \
    libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
# backend 폴더의 내용을 /app 아래로 복사하여 /app/app/main.py 구조가 되도록 함
# 이렇게 해야 app.config 등을 import할 때 경로가 맞음
COPY backend/ .

# Copy Frontend Build to Static Directory
# The build output from Vite is in 'dist'
# We place it in 'static' (relative to WORKDIR /app)
RUN mkdir -p static
COPY --from=frontend-builder /app/frontend/dist ./static

# Environment Variables (Default)
ENV PORT=8080

# Expose Port
EXPOSE 8080

# Start Service directly with Uvicorn
# WORKDIR가 /app 이고, 소스는 /app/app/main.py 에 위치함
# Cloud Run의 $PORT 환경변수를 사용하기 위해 shell form 사용
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
