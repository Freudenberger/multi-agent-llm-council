# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js 16 app using `output: "standalone"`.
# Final image ships only the traced server bundle + static assets, runs non-root.

# ---- deps: install ALL deps (incl. dev) needed to build ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce the standalone Next.js output ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time only — dummy values. Real secrets are supplied at runtime, never baked in.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    LLM_PROVIDER=mock \
    DB_PROVIDER=local \
    AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ARG APP_VERSION=0.0.0
ARG GIT_SHA=unknown
ENV APP_VERSION=$APP_VERSION GIT_SHA=$GIT_SHA
RUN npm run build

# ---- runner: minimal runtime image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
ARG APP_VERSION=0.0.0
ARG GIT_SHA=unknown
ENV APP_VERSION=$APP_VERSION GIT_SHA=$GIT_SHA

# Run as an unprivileged user.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Standalone server (incl. a minimal node_modules + package.json), static assets, public files.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Liveness probe hits the dependency-free /api/health route (busybox wget is in alpine).
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
