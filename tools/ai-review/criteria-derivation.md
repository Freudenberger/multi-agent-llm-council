# Deriving the Code-Review Criteria — recorded agent conversation

**Artifact:** 10xChampion path (M5L3, Task 1) — the task asks that the five acceptance
criteria be **derived via a documented agent conversation**, not hand-authored. This file
is that record: the working session (lightly edited for length) that produced
[criteria.md](./criteria.md). The session ran against this repo with the agent given
read access to [AGENTS.md](../../AGENTS.md), [docs/test-plan.md](../../docs/test-plan.md),
and [docs/architecture.md](../../docs/architecture.md).

The goal was explicit: **do not produce a generic linter rubric.** Derive criteria from
where *this* codebase actually breaks, so the reviewer earns its place in CI.

---

### Turn 1 — framing

> **Me:** I want an AI code reviewer for this repo that returns a structured pass/fail.
> Before we pick dimensions, where does this codebase actually carry risk? Read AGENTS.md
> and docs/test-plan.md and tell me what a reviewer here must catch that a generic linter
> wouldn't.

> **Agent:** Three things stand out from the docs that a generic linter misses:
> 1. **Architectural seam.** AGENTS.md states an invariant — `Core` (`src/core/`) must not
>    depend on UI. ESLint won't enforce "Core stays UI-independent" or "errors go through the
>    `core/errors` taxonomy." That's a *convention* a reviewer has to police.
> 2. **Authorization by convention.** `docs/test-plan.md` ranks an IDOR-style ownership risk
>    near the top: `StorageProvider.get(id)` carries no `userId`, and ownership is re-checked
>    at the route layer. Nothing mechanical stops the next route from forgetting.
> 3. **Risk-tied testing.** The test plan is risk-based, not coverage-percentage based — so
>    "is there a test?" is the wrong question. The right one is "does a *risky* path
>    (auth, persistence, parsing) have a test tied to a risk row?"

### Turn 2 — pushing for the failure modes, not virtues

> **Me:** Good. Don't give me virtues ("readable", "documented"). Give me the concrete
> failure modes you'd expect to see in a PR to *this* repo.

> **Agent:** Concrete failure modes, ranked by what the repo's own artifacts flag:
> - A handler reads a record by id and **forgets the ownership check** → IDOR. (test-plan top risk)
> - `Core` imports from `src/app/` or `src/components/` → **architecture inversion**. (AGENTS.md)
> - The judge/orchestrator path changes and **no test covers the new branch** → silent regression
>   in business logic. (`runCouncil.ts` is a don't-touch-lightly zone)
> - A change adds a **fourth way to format a model id** or another `switch` arm with a magic
>   string → the repo already has documented magic-string / dead-`case` debt.
> - Unvalidated request input reaches storage, or a **secret** lands in code/log.
> - Over-abstraction: an interface with one implementation, a factory for one product —
>   net-negative complexity.

### Turn 3 — collapsing to a scorable set

> **Me:** Collapse those into the smallest set of *scorable* dimensions. I want each PR scored
> 1–10 per dimension, and one binding verdict. No more than five — the M5L3 example uses five
> and I don't want a rubric nobody reads.

> **Agent:** Five dimensions, each mapping to a failure mode above:
>
> | Dimension | Folds in |
> | --- | --- |
> | **implementationCorrectness** | logic bugs, unhandled errors, the orchestrator-regression case |
> | **idiomaticity** | the Core/UI seam, error taxonomy, `no any`, reusing existing helpers |
> | **simplicity** | over-abstraction, duplicated logic, dead `case`s, magic strings |
> | **testRiskCoverage** | risky path shipped without a test tied to a test-plan row |
> | **securitySafety** | IDOR/authz-by-convention, unvalidated input, secrets, injection |
>
> `documentation` and `readability` were deliberately dropped — they don't map to a way this
> repo breaks, and folding them in would dilute the security signal.

### Turn 4 — the verdict rule and the false-positive trap

> **Me:** A reviewer that fails everything is as useless as one that passes everything. Define
> the gate, and tell me the most likely way this reviewer produces a *false* fail.

> **Agent:** Gate: **fail** if any dimension ≤ 3, OR `securitySafety ≤ 5`, OR there's a
> `blocker` finding; otherwise **pass**. Security is weighted lower-to-fail because the repo's
> own top risk is an authz seam — a change can be correct and idiomatic and still be a security
> fail.
>
> Most likely false positive: the reviewer sees `model: "openrouter/free"` (or a CI/config/
> dependency choice) and flags it as a "security" or "blocker" issue. **That is not a code
> vulnerability.** The rubric must explicitly scope `securitySafety` to *concrete code-level*
> issues evidenced in the diff, default it to 8–10 when none exist, and put model/provider/
> tooling/version choices **out of scope**. (This later proved real: free models in the
> promptfoo run produced exactly this confusion — see [eval-results.md](./eval-results.md).)

### Turn 5 — lock it in

> **Me:** Write it up as the Definition of Done, with a 9–10 vs 1–3 anchor per dimension and
> the scope carve-out for securitySafety. That becomes the agent's system prompt and the CI gate.

> **Agent:** Done → [criteria.md](./criteria.md). Each dimension has explicit high/low anchors,
> the verdict rule is stated as the mechanical gate, and the securitySafety scope note guards
> against the false-positive failure mode. The five map 1:1 to the schema in
> [schema.ts](./schema.ts) so the rubric and the structured-output contract can't drift.

---

## Outcome

The conversation produced the five dimensions, their anchors, the verdict rule, and — crucially
— the `securitySafety` scope carve-out, all grounded in this repo's documented risk surface
rather than a generic checklist. The result is committed as [criteria.md](./criteria.md) and
encoded as the Zod contract in [schema.ts](./schema.ts); both the v2 and v3 reviewers embed the
criteria in their system prompt and gate on the schema.

> **Validation note:** the carve-out from Turn 4 was vindicated empirically — when the promptfoo
> suite ran against free models, the model-selection false-positive showed up exactly as
> predicted, which is why CI defaults to a reliable paid-cheap model. See
> [eval-results.md](./eval-results.md).
