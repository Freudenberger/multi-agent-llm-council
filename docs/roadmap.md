# Roadmap — Multi-Agent LLM Council

> **Module 2 artefact.** Tracks milestones, current status, dependencies, and explicit out-of-scope items. Replaces and supersedes the roadmap section that lived inside `PRD-base.md §19`.

## 1. Status Legend

| Symbol | Meaning                                                    |
| :----: | ---------------------------------------------------------- |
| ✅     | Done — shipped on `main`                                   |
| 🚧     | In progress                                                |
| 🟡     | Planned, scoped, ready to start                            |
| ⬜     | Backlog — not yet scoped                                   |
| ❌     | Explicitly out of scope                                    |

## 2. Where We Are Today

Current snapshot (2026-06-10):

- All MVP requirements from `PRD-base.md` §8 are implemented.
- Authentication, persistence, and customization features (originally listed as v0.3 / v0.4 / v0.5) have been pulled forward.
- Certification artefacts (this document, `tech-stack.md`, `test-plan.md`) are now being produced.
- CI/CD is the largest outstanding gap and is the primary focus of M0.

## 3. Milestones

### M0 — Certification Readiness (current)

Goal: close every explicit 10xDevs 3.0 certification requirement.

| Status | Item                                                                      | Depends on |
| :----: | ------------------------------------------------------------------------- | ---------- |
| ✅     | PRD                                                                       | —          |
| ✅     | Architecture addendum                                                     | PRD        |
| ✅     | `tech-stack.md`                                                           | PRD        |
| 🚧     | `roadmap.md` (this document)                                              | PRD        |
| 🟡     | `test-plan.md` with risk map + quality gates + security row + cookbook    | tech-stack |
| 🟡     | CI workflow (`.github/workflows/ci.yml`) — lint, typecheck, vitest, playwright | tech-stack |
| 🟡     | E2E golden path test for council flow (`LLM_PROVIDER=mock`)               | test-plan  |
| 🟡     | IDOR test on `/api/conversations/:id`                                     | test-plan  |
| 🟡     | `CLAUDE.md` (copy of / pointer to `AGENTS.md`)                            | —          |
| 🟡     | Fix `your-org` placeholder in `README.md`                                 | —          |
| 🟡     | Add "Reviewer Quick Start" block to `README.md`                           | —          |

**Exit criteria:** every row in the core requirements table of `10xdevs3-compliance-report.md` is ✅.

### M1 — Quality Multipliers

Goal: visibly raise quality above the certification baseline.

| Status | Item                                                                      | Depends on |
| :----: | ------------------------------------------------------------------------- | ---------- |
| 🟡     | Pre-commit hooks (husky + lint-staged) running ESLint + `tsc --noEmit`    | CI         |
| 🟡     | Vitest coverage report uploaded as a CI artefact                          | CI         |
| 🟡     | Playwright `storageState` auth fixture (login once, reuse session)        | E2E        |
| 🟡     | Run-id correlation in structured logs                                     | —          |
| 🟡     | Rate limiting on `POST /api/council` (token-bucket or `next-rate-limit`)  | —          |
| 🟡     | Public deployment on Render in mock mode                                  | CI         |
| ⬜     | Real OpenAI provider implementation (proves the provider seam)            | —          |
| ⬜     | DB migrations committed (Supabase schema as code)                         | —          |

### M2 — Differentiation

Goal: polish + demo-worthy features.

| Status | Item                                                                      |
| :----: | ------------------------------------------------------------------------- |
| ⬜     | PDF export (already listed in `decisions.md` §6, not yet implemented)     |
| ⬜     | Cost guardrails — token / cost estimate per run, surfaced in the UI       |
| ⬜     | Streaming responses (SSE) for agent outputs                               |
| ⬜     | Accessibility pass — keyboard nav, ARIA labels, contrast audit            |
| ⬜     | Light/dark theme toggle with persistence                                  |
| ⬜     | Conversation history beyond MVP — pagination, search, tags                |
| ⬜     | CONTRIBUTING.md + architecture diagram embedded in README                 |

### M3 — Stretch Goals

| Status | Item                                                                      |
| :----: | ------------------------------------------------------------------------- |
| ⬜     | Saved agent / mode presets per user                                       |
| ⬜     | Compare-two-runs view (e.g., same input, different modes)                 |
| ⬜     | Usage statistics dashboard                                                |
| ⬜     | Public link sharing (read-only) for saved sessions                        |

## 4. Out of Scope (explicitly not building)

Captured here so future "should we add X?" discussions have an answer.

| ❌    | Item                          | Why                                                                       |
| :---: | ----------------------------- | ------------------------------------------------------------------------- |
| ❌    | Mobile app                    | MVP scope says web only.                                                  |
| ❌    | Payments / billing            | Out of MVP per `PRD-base.md §8`.                                          |
| ❌    | Multi-workspace / teams       | Single-user mental model is what differentiates this from "a SaaS".       |
| ❌    | Custom AI model training      | Out of MVP per PRD.                                                       |
| ❌    | Advanced permission system    | Owner-only authz on conversations is sufficient.                          |
| ❌    | Web search / RAG              | Adds scope without supporting the deliberation thesis.                    |
| ❌    | Mobile app                    | Out of stack and scope.                                                   |
| ❌    | Public SDK                    | CLI is the second interface; SDK is deferred per `architecture.md §9`.    |
| ❌    | Plugin system                 | Config-as-JSON for modes can replace this if needed; no infra investment yet. |

## 5. Dependency Graph

```text
PRD
 └─► tech-stack.md ──┬─► test-plan.md ──┬─► E2E golden path
                     │                  ├─► IDOR test
                     │                  └─► CI workflow
                     └─► CI workflow ───┬─► Pre-commit hooks
                                        ├─► Coverage in CI
                                        └─► Public deployment

E2E golden path ──► Playwright storageState fixture
```

Critical path for M0: `tech-stack.md → test-plan.md → CI + E2E golden path → ✅ certification`.

## 6. Decision Log Pointers

Significant decisions are recorded in [decisions.md](decisions.md). Roadmap items that change scope should leave a trail there, not here. This document tracks **what** and **when**; decisions track **why**.

## 7. Review Cadence

- After each milestone exits, re-rank the next milestone's items.
- After every E2E or CI failure that uncovered a hole in the plan, add an item.
- Anything sitting in 🚧 for more than two weeks gets either re-scoped or moved to ⬜.
