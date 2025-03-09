# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/ .
RUN npm install
RUN npm run build

# Stage 2: Build Backend
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS backend-builder
# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Build flare_ai_defai
ADD . /flare_ai_defai
WORKDIR /flare_ai_defai
RUN uv sync --frozen

# Build flare_ai_rag
WORKDIR /flare_ai_rag
ADD . /flare_ai_rag
RUN uv sync --frozen

# Stage 3: Final Image
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Install nginx
RUN apt-get update && apt-get install -y nginx supervisor curl && \
    rm -rf /var/lib/apt/lists/*

# Copy flare_ai_defai
WORKDIR /app
COPY --from=backend-builder /flare_ai_defai/.venv ./.venv
COPY --from=backend-builder /flare_ai_defai/src ./src
COPY --from=backend-builder /flare_ai_defai/pyproject.toml .
COPY --from=backend-builder /flare_ai_defai/README.md .

# Copy flare_ai_rag
WORKDIR /app/flare_ai_rag
COPY --from=backend-builder /flare_ai_rag/.venv ./.venv
COPY --from=backend-builder /flare_ai_rag/src ./src
COPY --from=backend-builder /flare_ai_rag/pyproject.toml .

# Copy frontend files
COPY --from=frontend-builder /frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/sites-enabled/default

# Setup supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Allow workload operator to override environment variables
LABEL "tee.launch_policy.allow_env_override"="GEMINI_API_KEY,GEMINI_MODEL,WEB3_PROVIDER_URL,WEB3_EXPLORER_URL,SIMULATE_ATTESTATION"
LABEL "tee.launch_policy.log_redirect"="always"

EXPOSE 80

# Start supervisor (which will start both nginx and the backend)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]