# ═══════════════════════════════════════════════════════════
# CodeCity AI — Backend Multi-Stage Dockerfile
# ═══════════════════════════════════════════════════════════
# Section 3, Contract 4: Parser sandbox runs inside a
# resource-capped container. This Dockerfile creates that
# isolated environment.

# ── Stage 1: Install dependencies ─────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
RUN npm ci --workspace=packages/shared --workspace=apps/backend

# ── Stage 2: Build shared + backend ──────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY package.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/backend/ apps/backend/
RUN npm run build --workspace=packages/shared && \
    npm run build --workspace=apps/backend

# ── Stage 3: Production runtime ─────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Security: non-root user for sandbox isolation
RUN addgroup --system codecity && \
    adduser --system --ingroup codecity codecity

# Copy only production artifacts
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/apps/backend/dist apps/backend/dist
COPY --from=builder /app/apps/backend/package.json apps/backend/
COPY --from=deps /app/node_modules node_modules
COPY package.json ./

# Git is required for the ingestion pipeline clone step
RUN apk add --no-cache git

# Sandbox directory for temporary repo clones
RUN mkdir -p /app/.sandbox && chown codecity:codecity /app/.sandbox

USER codecity
EXPOSE 3001

CMD ["node", "apps/backend/dist/server.js"]
