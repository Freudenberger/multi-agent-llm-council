# Code-Review Definition of Done — Multi-Agent LLM Council

**Artifact:** 10xChampion path (M5L3, Task 1) · The five acceptance criteria the AI reviewer scores, derived from this stack (Next.js 16 + TypeScript strict + Vitest/Playwright + the modular-monolith rules in [AGENTS.md](../../AGENTS.md)).

> These criteria were **derived via a recorded agent conversation**, not hand-authored — the working session is at [criteria-derivation.md](./criteria-derivation.md).

These are passed to the agent as its rubric ([reviewAgent.ts](./reviewAgent.ts) embeds them in the system prompt) and become the mechanical gate in CI. Each is scored **1–10**; the agent returns a binding **pass/fail**.

| # | Dimension | What a 9–10 looks like | What a 1–3 looks like |
| - | --------- | ---------------------- | --------------------- |
| 1 | **implementationCorrectness** | The change does what the diff claims; edge cases and error paths handled; no obvious logic bug | Silent wrong behaviour, unhandled errors, off-by-one / null deref |
| 2 | **idiomaticity** | Matches repo conventions: `Core` stays UI-independent, errors use the `core/errors` taxonomy, types in `core/types`, no `any` | Fights the architecture (Core importing UI), reinvents existing helpers, loose `any` |
| 3 | **simplicity** | Smallest change that solves it; no needless abstraction or dead branches | Over-engineered, duplicated logic, dead `case`s, magic strings |
| 4 | **testRiskCoverage** | New/changed risky paths have a Vitest or Playwright test; ties to a row in [docs/test-plan.md](../../docs/test-plan.md) | Risky path (auth, persistence, parsing) shipped with no test |
| 5 | **securitySafety** | Authz enforced at the right seam, input validated (Zod), no secrets, no injection/IDOR/abuse opening | Ownership left to convention, unvalidated input, secret in code, open expensive endpoint |

## Verdict rule (the gate)

- **`fail`** if **any** dimension scores **≤ 3**, OR `securitySafety ≤ 5`, OR a `blocker` finding exists.
- **`pass`** otherwise.

Security is weighted: a change can be correct and idiomatic and still **fail** on an unguarded authorization path — consistent with the project's own top risk ([docs/test-plan.md](../../docs/test-plan.md) security rows and the IDOR seam tracked in [context/changes/refactor-opportunities/plan.md](../../context/changes/refactor-opportunities/plan.md)).

**Scope of `securitySafety` (to avoid false positives):** it scores only **concrete code-level vulnerabilities evidenced in the diff** — missing authz, unvalidated input, leaked secrets, injection/IDOR/abuse. It defaults to **8–10** when no such vulnerability is present. Engineering/config choices — **which LLM model or provider is used (including free tiers like `openrouter/free`), CI/tooling values, dependency/version picks** — are **out of scope** and must never lower `securitySafety` or raise a `blocker`. The choice of a free model is not a code vulnerability.

## Why these five

They map 1:1 to where this repo actually breaks (see the architecture analysis in [context/](../../context/)): correctness of the orchestrator, idiomatic Core/UI separation, simplicity (the repo has real magic-string and dead-case debt), test coverage of risky paths, and security (the authorization-by-convention seam). The reviewer is tuned to *this* codebase, not a generic linter.
