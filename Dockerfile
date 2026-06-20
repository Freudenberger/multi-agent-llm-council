# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js 16 app using `output: "standalone"`.
# Final image ships only the traced server bundle + static assets, runs non-root.

# ---- deps: install ALL deps (incl. dev) needed to build ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: skip postinstall scripts. Dev-only tooling (promptfoo) pulls
# @playwright/browser-chromium, onnxruntime-node, sharp, @napi-rs/canvas — whose
# install scripts download browsers / build native binaries and FAIL on alpine
# (musl). None are needed to build or run the app: Next/SWC/sharp/esbuild resolve
# their prebuilt platform packages from the lockfile without any install script.
#
# Pin npm to the major version that generated package-lock.json (v11). node:22-alpine
# ships npm 10, which resolves the transitive tree differently (e.g. gcp-metadata,
# @swc/helpers) and makes `npm ci` reject the lockfile as out of sync.
RUN npm i -g npm@11 && npm ci --ignore-scripts

# ---- builder: produce the standalone Next.js output ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Non-secret build-time env. Real secrets are supplied at runtime, never baked in.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    LLM_PROVIDER=mock \
    DB_PROVIDER=local
ARG APP_VERSION=0.0.0
ARG GIT_SHA=unknown
ENV APP_VERSION=$APP_VERSION GIT_SHA=$GIT_SHA
# AUTH_SECRET only needs to exist during the build (NextAuth init); pass it inline
# so it isn't persisted in an image layer — avoids the SecretsUsedInArgOrEnv lint.
RUN AUTH_SECRET=build-time-placeholder-not-used-at-runtime npm run build

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
