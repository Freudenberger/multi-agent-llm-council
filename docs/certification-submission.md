# Certification submission index — 10xArchitect & 10xChampion

**Repo:** `llm-council` · **Last updated:** 2026-06-30

One page that points a grader at exactly the evidence for each badge, says which file is
the official submission artifact, and how to verify it. Detailed readiness analysis lives
in [../req-check.md](../req-check.md); this is just the map.

---

## 10xArchitect (Module 4)

**Submit this:** [../context/architect-report.md](../context/architect-report.md) — the ~2-page
combined report. It synthesizes the four backing artifacts below and stands alone.

| Lesson | Artifact                                                                  | File                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L2     | Repo map (territory · couplings · risk zones · entry points)              | [../context/map/repo-map.md](../context/map/repo-map.md)                                                                                                                                                      |
| L3     | Feature research — the council-run pipeline + technical debt              | [../context/changes/council-pipeline-analysis/research.md](../context/changes/council-pipeline-analysis/research.md)                                                                                          |
| L4     | Refactor opportunities (ranked) + the chosen plan                         | [../context/changes/refactor-opportunities/research.md](../context/changes/refactor-opportunities/research.md) · [plan.md](../context/changes/refactor-opportunities/plan.md)                                 |
| L5     | Domain notes — distillation · invariant/aggregate · anti-corruption layer | [../context/domain/01-domain-distillation.md](../context/domain/01-domain-distillation.md) · [02](../context/domain/02-invariant-aggregate-refactor.md) · [03](../context/domain/03-anti-corruption-layer.md) |

**What makes it defensible:**

- Evidence is tool-verified, not eyeballed — dependency graph via **madge**, structural counts via **ast-grep**, history via `git log` (reproduce steps in the report appendix).
- The L4 plan was **executed, not just written**: the IDOR/authorization refactor (`getOwned(id, userId)`) is shipped, used by both route sites, and covered by [../tests/e2e/tests/idor.spec.ts](../tests/e2e/tests/idor.spec.ts) + storage unit tests. The report reads "identified → planned → shipped, green oracle."
- A code spot-check finds **zero stale claims**: the original snapshot's gaps (peer review, ownership contract, swot framing, judge-anonymization wording) are each marked closed/shipped with a dated note next to the original finding.

---

## 10xChampion (Module 5) — Path A: AI code-review pipeline

**Official implementation:** **v3** — an agentic tool-loop reviewer on the **Vercel AI SDK**
(the model reads repo files via a sandboxed `read_repo_file` tool before scoring). v1/v2 are
the MVP lineage / keyless-mock paths. See [../tools/ai-review/README.md](../tools/ai-review/README.md).

| Requirement                                | Evidence                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent on a named SDK                       | [../tools/ai-review/v3/reviewAgentV3.ts](../tools/ai-review/v3/reviewAgentV3.ts) (Vercel AI SDK + `@openrouter/ai-sdk-provider`) · [cli](../tools/ai-review/v3/cli.ts) |
| 5 acceptance criteria (Definition of Done) | [../tools/ai-review/criteria.md](../tools/ai-review/criteria.md)                                                                                                       |
| Criteria derived via agent conversation    | [../tools/ai-review/criteria-derivation.md](../tools/ai-review/criteria-derivation.md)                                                                                 |
| Structured output enforced by schema       | [../tools/ai-review/schema.ts](../tools/ai-review/schema.ts) (Zod; fails closed)                                                                                       |
| Model evaluation (promptfoo)               | [../tools/ai-review/promptfooconfig.yaml](../tools/ai-review/promptfooconfig.yaml) · [eval-results.md](../tools/ai-review/eval-results.md) (+ `.json`/`.csv`)          |
| PR workflow that runs the reviewer         | [../.github/workflows/ai-review-v2.yml](../.github/workflows/ai-review-v2.yml) — comments on every PR + JUnit check run                                                |
| Regression gate for the reviewer itself    | [../.github/workflows/review-eval.yml](../.github/workflows/review-eval.yml) — gates on `openai/gpt-4o-mini` (beyond minimum)                                          |
| Screenshot evidence of a real run          | [../docs/ai-review-run-screens/](../docs/ai-review-run-screens/) — `ai-review-1..3.png` (workflow · job logs · PR comment) + `ai-review-4-fixed.png` (fail→fix→pass)   |

**Run it keyless (mock provider, no API key)** — this exercises the v1 deterministic path; the
official **v3** agent (`npm run review:v3`) needs `OPENROUTER_API_KEY` since it makes real tool-loop calls:

```bash
npm run review -- --diff tools/ai-review/fixtures/sql-injection.diff   # v1/mock → FAIL (exit 1)
npm run review -- --diff tools/ai-review/fixtures/clean-feature.diff   # v1/mock → PASS (exit 0)

# the official submission agent (needs a key):
OPENROUTER_API_KEY=sk-... npm run review:v3 -- --diff tools/ai-review/fixtures/sql-injection.diff
```

> ⚠️ **Known caveat (owner action):** the committed screenshots were captured on
> `openrouter/free`, which [eval-results.md](../tools/ai-review/eval-results.md) shows is unfit
> for the strict JSON gate. CI defaults to `openai/gpt-4o-mini`; re-capturing the screenshots on
> that model is the one item between "passes" and "bulletproof".

---

## Verification (anyone can run)

```bash
npm test          # 299 tests, mock provider, no keys
npm run typecheck # tsc --noEmit, strict
npm run lint      # 0 errors
npm run build     # production build
```
