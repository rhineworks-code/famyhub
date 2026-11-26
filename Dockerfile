# ---------- 1. Frontend build ----------
FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- 2. Backend dependencies (native modules: sqlite3, sharp) ----------
FROM node:22-bookworm-slim AS backend-deps
# Build tools only as fallback in case no prebuilt sqlite3 binary can be downloaded
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 3. Runtime ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3265 \
    TZ=Europe/Berlin \
    DATA_DIR=/app/data \
    UPLOADS_DIR=/app/uploads \
    PUBLIC_DIR=/app/public

RUN apt-get update \
 && apt-get install -y --no-install-recommends tini tzdata ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=backend-deps /build/backend/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY backend/src ./src
COPY --from=frontend /build/frontend/dist ./public

RUN mkdir -p /app/data /app/uploads && chown -R node:node /app/data /app/uploads
USER node

EXPOSE 3265
VOLUME ["/app/data", "/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3265)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
