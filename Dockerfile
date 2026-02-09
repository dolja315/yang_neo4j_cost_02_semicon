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

# ── Stage 2: Backend + Database ──
FROM python:3.11-slim

# Install system dependencies including PostgreSQL 15 and Supervisor
# Using Debian Bookworm (default for python:3.11-slim)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg2 \
    lsb-release \
    curl \
    && sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' \
    && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
    && apt-get update \
    && apt-get install -y postgresql-15 postgresql-client-15 supervisor \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/lib/postgresql/15/main

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY backend/ ./backend/

# Copy Frontend Build to Static Directory
# The build output from Vite is in 'dist'
# We place it in 'backend/static' so FastAPI can serve it
RUN mkdir -p backend/static
COPY --from=frontend-builder /app/frontend/dist ./backend/static

# Copy Configuration Scripts
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Environment Variables (Default)
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_DB=semicon_cost
ENV PORT=8080

# Expose Port
EXPOSE 8080

# Start Service
ENTRYPOINT ["/start.sh"]
