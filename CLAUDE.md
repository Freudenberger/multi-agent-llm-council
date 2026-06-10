# CLAUDE.md

> Claude Code reads this file. The full repo rules — module map, conventions, don't-touch zones, env vars, workflow for adding modes/agents — live in [AGENTS.md](AGENTS.md). This file exists so Claude Code finds something at the canonical filename; everything in `AGENTS.md` applies here verbatim.

## Quick orientation

- **Project:** Multi-Agent LLM Council — multi-agent deliberation system.
- **Stack:** Next.js 16 + React 19 + TypeScript (strict) + Tailwind CSS 4 + Vitest + Playwright + NextAuth 5.
- **Architecture:** modular monolith. Core logic in [src/core/](src/core/) is UI-independent; consumed by both the API route and the CLI. See [docs/architecture.md](docs/architecture.md).
- **Demo mode:** `LLM_PROVIDER=mock` runs end-to-end with no API keys. Always use this for tests.

## Before you change anything

Read these in order:

1. [AGENTS.md](AGENTS.md) — module responsibilities, conventions, don't-touch zones.
2. [docs/PRD-base.md](docs/PRD-base.md) — product requirements.
3. [docs/architecture.md](docs/architecture.md) — architectural rules (Core must not depend on UI).
4. [docs/tech-stack.md](docs/tech-stack.md) — stack rationale and env vars.
5. [docs/test-plan.md](docs/test-plan.md) — risk map and the cookbook for adding tests.
6. [docs/roadmap.md](docs/roadmap.md) — what's planned and what's explicitly out of scope.

## Don't-touch zones

Edit with extreme care (see AGENTS.md for the full list):

- [src/core/runCouncil.ts](src/core/runCouncil.ts)
- [src/providers/openRouterProvider.ts](src/providers/openRouterProvider.ts)
- [src/core/errors.ts](src/core/errors.ts)

## Commands

| Command           | What it does                                |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start the Next.js dev server                |
| `npm run build`   | Production build                            |
| `npm test`        | Vitest unit + integration                   |
| `npm run typecheck` | `tsc --noEmit` (strict)                  |
| `npm run lint`    | ESLint                                      |
| `npm run council` | CLI — `npm run council -- --mode decision "..."` |
