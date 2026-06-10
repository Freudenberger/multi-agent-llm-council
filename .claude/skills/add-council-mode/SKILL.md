---
name: add-council-mode
description: >-
  Add a new council mode to the Multi-Agent LLM Council. Use whenever the user
  wants a new deliberation mode (e.g. "add a brainstorming mode", "add a SWOT
  council", "add a debate mode"). A mode spans FIVE files that must stay in
  sync — this skill walks every touchpoint so the mode is never half-added
  (works in the API but missing from the UI, or vice versa). Also use when
  renaming or removing a mode, since the same five files are involved.
---

# Add a council mode

A council mode is defined across **five files**. Missing any one leaves a
silently broken mode: it may pass typecheck but 404 at the API, or run via CLI
but never appear in the UI. Do all five, in order, then test and document.

Each mode has 3–5 specialist agents **plus exactly one final judge** (the agent
template with `isFinalJudge: true`). Reuse existing agent templates where they
fit; only create new ones when no template matches (then also run
**add-agent-template** or the inline step below).

## The five touchpoints

Edit in this order so types flow correctly:

### 1. `src/core/types.ts` — add the ID to the union
Add the new mode id to the `CouncilModeId` union (around line 3). Use a
`camelCase` literal for multi-word ids (matches the existing `criticalReview`).
This is the source of truth; every other file is type-checked against it.

```ts
export type CouncilModeId =
  | "decision"
  | "idea"
  | "criticalReview"
  | "learning"
  | "technical"
  | "answer"
  | "<newMode>"; // ← add
```

### 2. `src/agents/defaultAgents.ts` — ensure the agent templates exist
For each agent the mode needs, confirm a matching entry exists in
`agentTemplates`. If not, add one with `id`, `name`, `role`, `perspective`
(the system prompt), and `isFinalJudge: true` on the single judge. Match the
existing tone: each `perspective` opens with "You are the …" and tells the
agent to keep depth proportional to the question. Group new templates under a
`// <Mode name> agents` comment, as the file already does.

### 3. `src/modes/index.ts` — register the mode
Add an entry to the `councilModes` record. The key **must** equal the
`CouncilModeId` literal. List agent ids via `buildAgents(...)`; `buildAgents`
throws at startup if an id is missing a template, so order this after step 2.

```ts
<newMode>: {
  id: "<newMode>",
  name: "<Display> Council",
  description: "<one sentence on what it analyzes and its perspectives>",
  agents: buildAgents("agent-id-1", "agent-id-2", /* … */ "final-judge-id"),
},
```

### 4. `src/app/api/council/route.ts` — add to the zod enum
Add the literal to the `mode: z.enum([...])` list (around line 29). **This is
the most-forgotten step** — without it the API rejects the new mode with a
validation error even though everything else works.

### 5. `src/app/page.tsx` — add to the `MODES` array
Add an entry to the `MODES` array (around line 28) so the mode appears as a
selectable card with its details panel. Shape:

```ts
{
  id: "<newMode>",
  name: "<Short label>",
  fullName: "<Display> Council",
  description: "<short card description>",
  agents: [ { name: "...", role: "..." }, /* … one per agent, judge last */ ],
  bestFor: [ "Example question 1", "Example scenario 2", "..." ],
}
```
The `agents` here are display-only (name + role) and must match the real agents
from step 3; `bestFor` powers the "Best for" section of the details panel.

## Verify (mandatory — invoke **test-feature**)

1. Extend `tests/core/modes.test.ts`:
   - Bump the count assertions ("should contain all N modes", `listModes()`
     length) and add the new id to the `toContain` / id-array checks.
   - Add a `specific mode structures` test asserting the new mode's expected
     agent names (mirror the existing `decision`/`learning`/`answer` blocks).
2. Run, cheapest first:
   - `npm test -- tests/core/modes.test.ts`
   - `npm run typecheck` — the `Record<CouncilModeId, CouncilMode>` type makes a
     missing step-3 entry a compile error; a stale zod enum will NOT be caught
     by types, so the API contract relies on the test below.
   - `npm test` (full suite) and `npm run lint`.
3. Optionally run the mode end-to-end under the mock provider:
   `npm run council -- --mode <newMode> "test question"`.

## Document (mandatory — invoke **document-feature**)

- Add the mode to **docs/features.md** if it's a user-facing capability.
- The "Adding a New Council Mode" checklist in **AGENTS.md** already documents
  these five steps — if you discover a sixth touchpoint, update that checklist.
- If the mode introduces a genuinely new analysis pattern, note it in
  **docs/decisions.md** and re-check **docs/test-plan.md** §10 (a new top-level
  capability is a refresh trigger — see the `refresh-test-plan` skill).

## Done checklist

- [ ] `CouncilModeId` union updated
- [ ] All agent templates exist (judge has `isFinalJudge: true`)
- [ ] `councilModes` entry added
- [ ] zod `mode` enum updated  ← easy to miss
- [ ] `MODES` array (UI) updated
- [ ] `modes.test.ts` extended and full suite + typecheck + lint green
- [ ] features.md / AGENTS.md updated
