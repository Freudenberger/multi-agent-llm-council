# ADR-0010: Docker Standalone Deployment

## Status

Accepted

## Date

2026-06-20

## Context

The application needs to be deployable as a Docker container for:

- **Cloud hosting** — Render, Fly.io, Railway, or any container platform.
- **Self-hosted deployments** — users who want to run the app on their own infrastructure.
- **Reproducible environments** — CI/CD pipelines that build and test the same image that runs in production.

We must decide on a Docker build strategy that produces a minimal, secure, and fast-starting container.

Forces at play:

- Next.js supports `output: "standalone"` — a traced build that includes only the files needed to run the server, producing a much smaller output than the full `.next` directory.
- The app has dev dependencies (Playwright, promptfoo, sharp, onnxruntime-node) whose install scripts download large native binaries or browsers. These are not needed at runtime but can break `npm ci` on Alpine Linux (musl incompatibility).
- Secrets (API keys, `AUTH_SECRET`) must never be baked into the image — they must be supplied at runtime via environment variables.
- The container should run as a non-root user for security.
- A health check endpoint is needed for container orchestration (liveness probes).

## Decision

We will use a **multi-stage Docker build with Next.js standalone output**:

1. **Stage 1 (`deps`)** — installs all dependencies (including dev) using `npm ci --ignore-scripts` to skip native binary install scripts that fail on Alpine. Pins `npm@11` to match the lockfile version (node:22-alpine ships npm 10, which resolves the dependency tree differently).

2. **Stage 2 (`builder`)** — copies source and runs `npm run build` with `BUILD_STANDALONE=true`. This env var conditionally sets `output: "standalone"` in `next.config.ts`, producing a traced server bundle. A build-time `AUTH_SECRET` placeholder is passed inline (not persisted in an image layer) so NextAuth initialises without error.

3. **Stage 3 (`runner`)** — copies only the standalone output, static assets, and public files. Runs as an unprivileged user (`nextjs:nodejs`). Exposes port 3000. No dev dependencies, no build tools, no source code.

4. **Health check** — `GET /api/health` returns a lightweight JSON response with `Cache-Control: no-store` to prevent caching by proxies. Used as a Docker/Render liveness probe.

5. **Build arguments** — `APP_VERSION` and `GIT_SHA` are passed as build args and exposed as env vars for the footer version display.

## Consequences

### Positive

- Minimal image size — only the traced server bundle and static assets. No `node_modules` bloat from dev dependencies.
- Fast cold start — the standalone server starts in ~1 second vs. ~5 seconds for a full Next.js server.
- Secure — runs as non-root, no secrets in image layers, no dev tools in the runtime image.
- Reproducible — the same Dockerfile works for local development, CI, and production deployment.
- `--ignore-scripts` avoids the Alpine/musl incompatibility with native binary install scripts.

### Negative

- The standalone output is Next.js-specific — if we ever migrate away from Next.js, the Dockerfile must be rewritten.
- `npm@11` pinning is fragile — if the lockfile is regenerated with a different npm version, `npm ci` may reject it. The pin must be kept in sync.
- `BUILD_STANDALONE=true` means the dev server and the production build use different Next.js output modes. Any standalone-specific bugs won't be caught in development.
- The build-time `AUTH_SECRET` placeholder is a workaround — it exists only so NextAuth doesn't crash during build. If NextAuth changes its initialisation logic, this workaround may break.

### Neutral

- The health endpoint is dependency-free (no database, no provider calls) so it responds even when external services are down.

## Alternatives Considered

### Single-stage build with full `node_modules`

Simpler Dockerfile, but the image would be 5–10× larger (all dev dependencies, native binaries, Playwright browsers). Unacceptable for production deployment.

### Docker Compose with separate build and runtime images

Would separate build concerns more cleanly, but adds complexity (two images to manage, version synchronisation). The multi-stage build achieves the same result in a single Dockerfile.

### Non-Alpine base image (node:22-slim)

Would avoid the musl/npm compatibility issues, but the image is larger (~200MB vs. ~120MB for Alpine). Alpine is worth the minor build complexity for the size savings.

## References

- [Dockerfile](../../Dockerfile) — multi-stage build
- [next.config.ts](../../next.config.ts) — conditional `output: "standalone"`
- [src/app/api/health/route.ts](../../src/app/api/health/route.ts) — health check endpoint
- [render.yaml](../../render.yaml) — Render deployment config
