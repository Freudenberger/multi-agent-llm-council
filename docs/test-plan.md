# Test Plan — Multi-Agent LLM Council

> **Module 3 artefact.** Risk-based test plan covering: sources, scope, risk map (impact × likelihood), test profile, quality gates, security row, and the cookbook for adding new tests.

## 1. Sources of Context

The plan is derived from the following artefacts (each is a load-bearing input):

- [PRD-base.md](PRD-base.md) — user flow, requirements, non-goals.
- [architecture.md](architecture.md) — modular monolith, core ↔ provider seams.
- [tech-stack.md](tech-stack.md) — Next.js + React + Vitest + Playwright + Zod + NextAuth.
- [roadmap.md](roadmap.md) — what is shipped and what is next.
- [AGENTS.md](../AGENTS.md) — repo rules, don't-touch zones.
- Existing test directory — [tests/](../tests/) (vitest) and [tests/e2e/](../tests/e2e/) (Playwright).
- Git churn (high-traffic files: `runCouncil.ts`, `openRouterProvider.ts`, `page.tsx`, settings + auth additions in recent commits).

## 2. Scope

### 2.1 In Scope

- Council orchestration ([src/core/runCouncil.ts](../src/core/runCouncil.ts)) — Phase 1 (parallel specialists), Phase 2 (anonymized peer ranking), Phase 3 (judge synthesis with retry).
- Provider layer ([src/providers/](../src/providers/)) — retry, timeout, error normalization.
- Public HTTP surface — `/api/council`, `/api/conversations`, `/api/conversations/:id`, `/api/discuss`, `/api/discussions`, `/api/discussions/:id`, `/api/auth/*`, `/api/user/settings/*`, `/api/models`.
- Auth — credentials login, registration, session protection.
- Storage layer — local JSON + Supabase implementations for both conversations and roundtable discussions (each pair must behave identically).
- Critical user flow — sign in → enter question → pick mode → run council → see report → save → export.

### 2.2 Out of Scope (by intent)

Recorded explicitly so a future agent doesn't quietly add tests here:

- **Marketing / landing pages** — none exist; if added, no snapshot tests.
- **Static markdown rendering** (`Markdown.tsx`) — pure rendering, low risk; deferred.
- **CLI argument parsing** — narrow surface, low churn; the CLI is exercised manually.
- **Mock provider internals** — the mock is itself a test fixture; testing it would be circular.
- **Third-party libraries** — Next.js, React, Zod, NextAuth are assumed correct.
- **Visual regression / screenshot diffs** — fragile, expensive, not worth the budget for this project.

## 3. Existing Test Profile

| Layer        | Tool       | Files                                                                                                  |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------ |
| Core unit    | Vitest     | [tests/core/runCouncil.test.ts](../tests/core/runCouncil.test.ts), [errors.test.ts](../tests/core/errors.test.ts), [logger.test.ts](../tests/core/logger.test.ts), [modes.test.ts](../tests/core/modes.test.ts) |
| Prompts      | Vitest     | [tests/prompts/buildPrompts.test.ts](../tests/prompts/buildPrompts.test.ts)                            |
| Providers    | Vitest     | [tests/providers/openRouterProvider.test.ts](../tests/providers/openRouterProvider.test.ts)            |
| Storage      | Vitest     | [tests/storage/localStorage.test.ts](../tests/storage/localStorage.test.ts)                            |
| E2E          | Playwright | [tests/e2e/tests/smoke.spec.ts](../tests/e2e/tests/smoke.spec.ts) (home smoke + registration)         |

**Baseline assessment:** unit coverage is solid; **E2E does not yet exercise the council flow itself** — that is the single largest hole.

## 4. Risk Map (impact × likelihood)

Risks are described as **user-facing failure scenarios**, not as "file X has no test" (per the M3 §"Sygnał, nie diagnoza" rule).

### 4.1 Scale

| Rating | Impact                                                          | Likelihood                                                       |
| :----: | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| High   | User loses data / access / money; failure publicly visible      | Area changes weekly, or we've been bitten here before            |
| Med    | Feature degrades, workaround exists, only some users affected   | Code touched periodically, has been a source of bugs             |
| Low    | Cosmetic, easy to revert, no data impact                        | Stable area, rarely touched                                      |

### 4.2 Functional Risks

| # | Scenario (what the user feels)                                                            | Impact | Likelihood | Priority | Source signal                                              |
| - | ----------------------------------------------------------------------------------------- | :----: | :--------: | :------: | ---------------------------------------------------------- |
| 1 | User runs a council and gets nothing back (empty report, blank UI)                        | High   | Med        | **P0**   | `runCouncil.ts` is a don't-touch zone; recent churn in API |
| 2 | One agent times out and the run aborts instead of degrading gracefully                    | High   | Med        | **P0**   | Graceful degradation is an architectural promise (PRD NFR-03) |
| 3 | Final judge returns empty content and the user sees a malformed report                    | High   | Low        | **P1**   | `MAX_JUDGE_RETRIES = 2` exists for exactly this            |
| 4 | Saved conversation does not persist after refresh                                         | High   | Med        | **P0**   | Storage layer has two impls — drift between them is the risk |
| 5 | User customizes an agent, runs council — customization is silently ignored                | Med    | Med        | **P1**   | `mergeCustomAgents` is non-trivial; recent agent customization feature |
| 6 | Per-agent model selection silently falls back to default                                  | Med    | Med        | **P1**   | New feature; OpenRouter free model list churns             |
| 7 | Login page accepts invalid credentials                                                    | High   | Low        | **P1**   | NextAuth + bcrypt is well-trodden but auth bugs are loud   |
| 8 | Registration succeeds but no user record is written                                       | High   | Low        | **P1**   | Recent commit adds API-key validation; touched user storage |
| 9 | Markdown export contains broken / missing sections                                        | Low    | Med        | **P2**   | Exports are derived from `finalReport`; format may drift   |
| 10 | History sidebar shows another user's sessions                                            | High   | Low        | **P0**   | See security row 4.3 #1                                    |

### 4.3 Security Risks (mandatory M3 row)

| # | Class                | Scenario                                                                                       | Impact | Likelihood | Priority |
| - | -------------------- | ---------------------------------------------------------------------------------------------- | :----: | :--------: | :------: |
| 1 | **IDOR / Authz**     | User A reads / deletes user B's conversation or discussion via `GET/DELETE /api/conversations/:id` or `/api/discussions/:id` | High   | Med        | **P0**   |
| 2 | **Untrusted input**  | Malicious system prompt injection via `customAgents.systemPrompt`                              | Med    | Med        | **P1**   |
| 3 | **Abuse / cost**     | Unauthenticated caller hits `/api/council` in a loop, draining OpenRouter budget                | High   | High       | **P0**   |
| 4 | **Secrets in logs**  | API key leaks into structured logs (e.g. via error message echoing a header)                   | High   | Low        | **P1**   |
| 5 | **User-supplied keys** | API key submitted to `/api/user/settings` leaks to other users via storage / logs            | High   | Low        | **P1**   |
| 6 | **Session hijack**   | `AUTH_SECRET` weak / default in production                                                     | High   | Low        | **P1**   |
| 7 | **CSRF**             | State-changing endpoints invoked from another origin                                           | Med    | Low        | **P2**   |
| 8 | **Open redirect**    | Post-login redirect to an attacker-controlled URL                                              | Med    | Low        | **P2**   |

Code anchors:

- IDOR is **already guarded** in [src/app/api/conversations/[id]/route.ts:30-32, 60-63](../src/app/api/conversations/[id]/route.ts#L30) and the mirrored [src/app/api/discussions/[id]/route.ts](../src/app/api/discussions/[id]/route.ts) (owner check on GET + DELETE) — a test must lock both guards in place.
- Abuse risk has **no rate limit yet** — see roadmap M1.
- `OPENROUTER_API_KEY` is not echoed in errors today; a test prevents future regressions.

### 4.4 Risks We Will NOT Cover

Equally important per M3:

- **OpenRouter outage** — handled by retry + clear error UI; we will not mock a multi-hour partial outage.
- **DDoS at network layer** — out of scope; relies on hosting platform.
- **Browser back/forward navigation quirks** — manual smoke only.
- **Visual style regressions** — no snapshot tests.

## 5. Phases of Rollout

Aligns with `roadmap.md` M0/M1. Each phase corresponds to one round of `/10x-research → /10x-plan → /10x-implement`.

| Phase | Goal                                                                                | Covers risks            | Status   |
| :---: | ----------------------------------------------------------------------------------- | ----------------------- | -------- |
| 1     | E2E golden path under `LLM_PROVIDER=mock`: login → run → see report → save → export | 1, 4, 5                 | 🟡 planned |
| 2     | E2E authz test (IDOR) on `/api/conversations/:id`                                   | sec-1, 10               | 🟡 planned |
| 3     | Unit test for graceful degradation when one specialist fails / times out            | 2, 3                    | 🟡 planned |
| 4     | Unit/integration test for `mergeCustomAgents` + per-agent model override            | 5, 6                    | 🟡 planned |
| 5     | API rate-limit middleware + test                                                    | sec-3                   | ⬜ backlog |
| 6     | Negative auth tests (wrong password, missing fields, registration round-trip)       | 7, 8                    | 🟡 planned |
| 7     | Log-scrubbing test — assert `OPENROUTER_API_KEY` value never appears in any log     | sec-4, sec-5            | ⬜ backlog |

## 6. Quality Gates

Layered, cheapest first.

| Gate                 | What it does                                                       | Where it runs               | Status         |
| -------------------- | ------------------------------------------------------------------ | --------------------------- | -------------- |
| `npm run lint`       | ESLint (`eslint-config-next`)                                      | Local + CI                  | 🟡 CI missing  |
| `npm run typecheck`  | `tsc --noEmit` — strict TypeScript                                 | Local + CI                  | 🟡 CI missing  |
| `npm test`           | Vitest unit + integration                                          | Local + CI                  | 🟡 CI missing  |
| Playwright `npx playwright test` | E2E (Phase 1+)                                          | Local + CI                  | 🟡 CI missing  |
| Pre-commit hook      | Lint + typecheck on staged files                                   | Local (husky / lefthook)    | ⬜ planned     |
| CI workflow          | All of the above on push / PR                                      | GitHub Actions              | ⬜ planned     |

**Rule:** no gate is allowed to be skipped without a written reason in the PR description. CI must remain green on `main`.

## 7. The Oracle Problem (don't betonate the bug)

Tests must verify behaviour against **independent expectations**, not against "whatever the code currently returns" (M3 lesson 1).

- Each Vitest assertion must have a defensible source — PRD requirement, ticket, contract, or specified behaviour in `runCouncil.ts` docstring.
- When in doubt, ask the agent to break the production code and confirm the test fails. If it stays green, the test is decoration.
- Avoid `expect(result).toMatchSnapshot()` for anything but stable structural data.

## 8. Cookbook (how to add a test in this repo)

> Empty sections are intentional — they fill up as Phase 1 lands. Don't pre-write what we haven't validated yet.

### 8.1 Adding a unit test (core / providers / prompts / storage)

- **Location:** `tests/<layer>/<thing>.test.ts`.
- **Convention:** `describe(<unit name>, () => { it("does X when Y", …) })`.
- **Mocking policy:** never mock the unit under test; mock at the seam (provider, storage). For LLM calls use `MockProvider`.
- **Reference test:** [tests/core/runCouncil.test.ts](../tests/core/runCouncil.test.ts).
- **Run locally:** `npm test -- tests/core/runCouncil.test.ts`.

### 8.2 Adding an E2E test (Playwright)

- **Location:** `tests/e2e/tests/<feature>.spec.ts`.
- **Authentication:** use the `storageState` fixture (planned, Phase 2). Until it lands, prefer unauthenticated flows or one-shot login in `beforeEach`.
- **Mock LLM:** the dev server must start with `LLM_PROVIDER=mock` so tests are deterministic and free.
- **Reference test:** [tests/e2e/tests/smoke.spec.ts](../tests/e2e/tests/smoke.spec.ts).
- **Run locally:** `cd tests/e2e && npx playwright test`.

### 8.3 Adding a security / authz test

- **Approach:** drive both authenticated user A and user B through the API (not the UI). Use raw `fetch` with the session cookie obtained from the login endpoint.
- **Expectation source:** authorization rules documented in this test plan §4.3, not the code path.
- _To be filled in once Phase 2 lands._

### 8.4 Adding a regression test for a fixed bug

_To be filled in after the first bug fix lands a test._ Pattern will be: reproduce → fix → keep test.

## 9. Tooling Notes

- **Vitest** is configured at the repo root via [vitest.config.ts](../vitest.config.ts).
- **Playwright** runs from a nested package at [tests/e2e/](../tests/e2e/) with its own `package.json` and `tsconfig.json`. This isolates the heavier dependency.
- **Mock provider** lives at [src/providers/mockProvider.ts](../src/providers/mockProvider.ts) — extend it before adding any test that depends on a specific LLM behaviour.

## 10. Triggers for Refreshing This Plan

Re-run `/10x-test-plan --refresh` when any of the following happens:

- A new top-level capability is added (new mode, new provider, new storage backend).
- A risk that was rated Low/Med actually fires in production.
- A new piece of user-supplied data enters the system (new form field, new endpoint).
- An incident that was not on the map occurs — add it as a row.
- Stack churn: a major dependency (Next.js, NextAuth, Supabase) jumps a major version.

## 11. Status Summary

| Phase   | Status     | Blocker                              |
| ------- | ---------- | ------------------------------------ |
| Phase 1 | 🟡 planned | Awaiting CI workflow                 |
| Phase 2 | 🟡 planned | Depends on Playwright auth fixture   |
| Phase 3 | 🟡 planned | Independent — could land first       |
| Phase 4 | 🟡 planned | Independent — could land alongside 3 |
| Phase 5 | ⬜ backlog | Needs rate-limit middleware design   |
| Phase 6 | 🟡 planned | Independent                          |
| Phase 7 | ⬜ backlog | Needs log-scrubbing convention first |
