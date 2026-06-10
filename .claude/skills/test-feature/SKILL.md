---
name: test-feature
description: >-
  Add at least one test and run the test suite whenever a feature is
  implemented or changed in the Multi-Agent LLM Council repo. Use this AS PART
  OF any feature work — after writing the code and before declaring it done —
  to ensure new/changed behavior is covered by a Vitest (or Playwright E2E)
  test and that the full suite plus typecheck/lint pass. Trigger phrases:
  "implement feature", "add mode", "add agent", "fix bug", "change behavior",
  "add a test", "run tests".
---

# Add a test and run the suite

Every feature implementation or behavioral change in this repo ships with **at
least one test** that would fail without the change, plus a green suite. Tests
always run against the **mock provider** — never a real LLM (no keys, no cost,
deterministic).

## Non-negotiables

- At least **one new or updated test** per feature/behavior change.
- The test must be a real **oracle**: it asserts against an independent
  expectation (PRD, ticket, documented contract), not "whatever the code
  returns today" (test-plan §7). If it would pass even with the feature
  reverted, it is decoration — rewrite it.
- `LLM_PROVIDER=mock` for everything. Use `MockProvider`
  (`src/providers/mockProvider.ts`); extend it before relying on specific LLM
  behavior.

## Where the test goes

| Layer changed | Test location | Reference |
| --- | --- | --- |
| Core / orchestration | `tests/core/<thing>.test.ts` | `tests/core/runCouncil.test.ts` |
| Prompt builders | `tests/prompts/<thing>.test.ts` | `tests/prompts/buildPrompts.test.ts` |
| Provider layer | `tests/providers/<thing>.test.ts` | `tests/providers/openRouterProvider.test.ts` |
| Storage | `tests/storage/<thing>.test.ts` | `tests/storage/localStorage.test.ts` |
| Modes / agents | `tests/core/modes.test.ts` (extend) | `tests/core/modes.test.ts` |
| User flow / API contract / authz | `tests/e2e/tests/<feature>.spec.ts` | `tests/e2e/tests/smoke.spec.ts` |

Out-of-scope areas (do NOT add tests here without a stated reason): static
`Markdown.tsx` rendering, CLI arg parsing, mock-provider internals, third-party
libs, visual/snapshot diffs. See test-plan §2.2.

## Conventions

- Vitest: `describe("<unit>", () => { it("does X when Y", …) })`. Use the `@/`
  path alias (e.g. `import { getMode } from "@/modes"`).
- Mock at the **seam** (provider, storage) — never mock the unit under test.
- E2E: dev server must run with `LLM_PROVIDER=mock`; run from `tests/e2e/`.
- New user-supplied input or new endpoint → also add/extend a security/authz
  test (test-plan §4.3) and update the risk map.

## Procedure

1. Write the focused test first (or alongside the code). Make it assert the
   *specified* behavior.
2. Run just that file fast:
   `npm test -- tests/<layer>/<thing>.test.ts`
3. **Confirm it's a real test:** if practical, mentally (or actually) revert the
   feature and confirm the test would fail. Never betonate the current bug.
4. Run the gates, cheapest first:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test` (full Vitest suite)
   - E2E only if you added/changed a flow: `npm run test:e2e`
5. If any gate fails, fix the root cause — do not skip gates or weaken the test
   to make it pass.
6. **Report** the test you added, the command output (pass/fail counts), and
   any gate you skipped *with the reason*.

## Pairing

Whenever this skill runs for a feature, also run **document-feature** so the
docs reflect the same change. Code + test + docs land together.
