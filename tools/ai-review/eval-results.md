# promptfoo eval — model comparison matrix (10xChampion · M5L3 Task 3)

**Generated:** 2026-06-19 · **Eval ID:** `eval-0bz-2026-06-19T20:29:07`
**Command:** `npm run review:eval` (`promptfoo eval -c tools/ai-review/promptfooconfig.yaml`)
**Suite:** 2 prepared diffs × 3 models = 6 runs. The SQL-injection diff must yield `verdict:"fail"`; the clean feature diff must yield `verdict:"pass"`. Every response must also parse as JSON matching the 5-dimension contract ([schema.ts](schema.ts)).

This matrix **is** the M5L3 "model comparison" deliverable. It is deliberately a **free-tier** comparison, and the result is the point: a strict JSON contract is a poor fit for free models. See the regenerate-with-a-reliable-model note at the bottom.

## Results matrix

| Model (`openrouter:…`)            | SQL-injection diff → must `fail` | Clean-feature diff → must `pass` | Time (s)\*    | Cost   |
| --------------------------------- | -------------------------------- | -------------------------------- | ------------- | ------ |
| `nvidia/nemotron-3-ultra…:free`   | ❌ ERROR — HTTP 504 (provider)   | ❌ ERROR — HTTP 504 (provider)   | 300.6 / 300.5 | $0.00  |
| `poolside/laguna-m.1:free`        | ❌ FAIL — leaked `Thinking:` prose, not JSON | ❌ FAIL — non-JSON, `Unexpected token 'T'` | 46.6 / 58.6   | $0.00  |
| `openrouter/owl-alpha`            | ❌ FAIL — Codex SDK parse error  | ✅ **PASS**                      | 21.1 / 6.5    | $0.00  |

\*Time shown as `sql-injection / clean-feature` per-call latency. nemotron's 300 s is the promptfoo request timeout — the provider never returned.

**Totals:** 1 passed · 3 failed · 2 errored (6 runs, 5 m 2 s wall-clock). Token usage: 4,845 total (2,536 prompt / 2,309 completion, incl. 1,252 reasoning). All free → $0.00.

## What this matrix demonstrates

1. **The eval harness works** — it renders the review prompt against each fixture, runs all three models, applies the `is-json` + verdict + per-dimension assertions, and produces a pass/fail/cost/time matrix. That harness is the M5L3 T3 task.
2. **Free tiers are unfit for a strict structured-output contract** — concrete, reproduced failure modes:
   - `nemotron` times out at the provider (504) and returns nothing.
   - `laguna` emits chain-of-thought (`Thinking: …`) instead of bare JSON, so `is-json` fails.
   - even `owl-alpha`, which passes the clean case, fails the security case with a provider-side parse error.

   This is exactly the warning baked into the agent itself ([reviewAgentV2.ts:48-51](v2/reviewAgentV2.ts#L48-L51)) and the workflow ([ai-review-v2.yml](../../.github/workflows/ai-review-v2.yml)): **do not run the gate on a free model.**

## Regenerate against a reliable model (recommended for a real CI gate)

The free-tier flakiness above is a config choice, not a harness limitation. To produce a clean all-green matrix, override the providers with paid-but-cheap structured-output models:

```bash
OPENROUTER_API_KEY=… npm run review:eval -- \
  --providers openrouter:openai/gpt-4o-mini openrouter:anthropic/claude-3.5-haiku openrouter:google/gemini-2.0-flash-001
```

Raw machine-readable output for this run: [eval-results.json](eval-results.json) · [eval-results.csv](eval-results.csv).
View interactively with `npx promptfoo view`.
