# AI Code Review — 10xChampion (Path A: CI/CD review pipeline)

An SDK-backed code-review agent that scores a `git diff` against a 5-dimension
Definition of Done and returns a **schema-validated** verdict, wired into CI so it
**comments on every PR**. This is the 10xChampion deliverable for Module 5 (M5L2 + M5L3).

## What's here

| File | Role | Lesson |
| ---- | ---- | ------ |
| [schema.ts](./schema.ts) | Zod structured-output contract (5 scores + verdict + summary) | M5L3 — schema as the gate |
| [criteria.md](./criteria.md) | The 5 Definition-of-Done dimensions + verdict rule | M5L3 Task 1 |
| [reviewAgent.ts](./reviewAgent.ts) | `reviewDiff(diff)` → validated verdict; reuses the project's provider seam; fails closed | M5L2 — the agent |
| [cli.ts](./cli.ts) | `npm run review` — diff in (file/git/stdin), JSON or Markdown out, exit-code gate | M5L2 |
| [promptfooconfig.yaml](./promptfooconfig.yaml) + [prompt.txt](./prompt.txt) | Model comparison + verdict regression eval | M5L3 Task 3 |
| [fixtures/](./fixtures/) | Sample diffs (one unsafe, one clean) | test cases |
| [../../.github/workflows/ai-review.yml](../../.github/workflows/ai-review.yml) | CI: run on PR, post the verdict as a comment | M5L3 — pipeline |

**Design note:** the agent calls `createProvider()` ([src/providers](../../src/providers)), the
same seam the council uses — so it runs **keyless** under `LLM_PROVIDER=mock` (deterministic
heuristic verdict) and against **OpenRouter** in CI. The schema is fail-closed: an unparseable
response becomes a hard `fail`, never a silent pass.

## Run it locally (keyless)

```bash
# Unsafe diff → FAIL (exit 1)
npm run review -- --diff tools/ai-review/fixtures/sql-injection.diff

# Clean, tested diff → PASS (exit 0)
npm run review -- --diff tools/ai-review/fixtures/clean-feature.diff

# Review your own working changes against a ref
npm run review -- --git origin/main

# JSON only (for piping)
npm run review -- --diff tools/ai-review/fixtures/sql-injection.diff --json
```

For a **real LLM** review locally: `OPENROUTER_API_KEY=sk-... LLM_PROVIDER=openrouter npm run review -- --git origin/main`.

## Run the model-comparison eval (M5L3 Task 3)

```bash
export OPENROUTER_API_KEY=sk-...
npm run review:eval        # compares 3 models on the fixtures, asserts verdicts
npx promptfoo@latest view  # opens the results matrix (cost + latency per model)
```

The results matrix (pass/fail per model with cost + time) is the M5L3 model-comparison evidence.

---

## Capturing the 3 badge screenshots (the only step I can't do for you)

The 10xChampion badge wants **proof of a real run**. Everything above is built; these
three screenshots are produced by running it on a real PR under your GitHub account
(a standalone PoC repo is fine — no company code needed).

1. **Push this repo to GitHub** and add a repo secret `OPENROUTER_API_KEY`
   (*Settings → Secrets and variables → Actions → New repository secret*).
   Without the secret the workflow still runs in mock mode and posts a comment — enough
   for screenshots 1 & 3, but a real key makes the review genuine.

2. **Open a PR** that contains a reviewable change. Easiest: branch, copy
   `tools/ai-review/fixtures/sql-injection.diff`'s change into a real file (or just edit
   any file), and open the PR. The `AI Code Review` workflow triggers automatically.

3. **Capture:**
   - **Screenshot 1 — pipeline + job:** the *Actions* tab → the **AI Code Review** run → the **review** job visible.
   - **Screenshot 2 — job logs:** open the **Run AI reviewer on the PR diff** step; the JSON verdict is printed there.
   - **Screenshot 3 — PR comment:** the agent's **comment on the PR** (the rendered scorecard).

> Tip: to force a `fail` verdict for a striking screenshot, put an unsafe pattern
> (string-built SQL, `eval(`) in the PR; to show a `pass`, include a matching test.

That's the complete Path A evidence set (workflow+job, job logs, PR comment) called for in M5L3.
