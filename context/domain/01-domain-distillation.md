# Domain Distillation — Multi-Agent LLM Council

**Artifact:** L5 (10xArchitect path), doc 1 of 3 · **Date:** 2026-06-15
**Method:** read [docs/PRD-base.md](../../docs/PRD-base.md) + [README.md](../../README.md) → extract terms → confirm in code → flag mismatches. Diagnostic only, no code changes.

> **Evidence legend:** `[E]` confirmed at file:line · `[doc]` from PRD/README · `[GAP]` declared in docs, absent/divergent in code · `[U]` unknown.

> **⚠️ Update — 2026-06-30 (post-analysis):** Dated **2026-06-15** snapshot. The **Peer Review / Ranking `[GAP]`** flagged below (MC-1) was **subsequently closed**: peer review is now an **optional Phase 1.5** (`runPeerReview` [runCouncil.ts:418](../../src/core/runCouncil.ts#L418); `buildPeerReview*` in [buildPrompts.ts](../../src/prompts/buildPrompts.ts); tested in [runCouncil.test.ts](../../tests/core/runCouncil.test.ts)). The `[GAP]` rows below reflect the 06-15 state.

---

## Project context

- **Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind 4, Zod 4, NextAuth 5, Supabase, Vitest, Playwright.
- **Sources of truth read:** [docs/PRD-base.md](../../docs/PRD-base.md), [README.md](../../README.md), [src/core/types.ts](../../src/core/types.ts), [src/modes/index.ts](../../src/modes/index.ts), [src/agents/defaultAgents.ts](../../src/agents/defaultAgents.ts).
- **Domain in one line:** route a user's question through several perspective-specialised LLM agents, then synthesise their independent answers into one structured report.

---

## Ubiquitous language

| Term | Definition | Doc source | In code |
| ---- | ---------- | ---------- | ------- |
| **Council** | The whole multi-agent body that deliberates on one input | PRD §1 `[doc]` | Implicit — a `CouncilMode` + its run; no `Council` entity `[E: types.ts:25]` |
| **Mode** | A pre-set council configuration (which agents, what framing) | PRD §6 `[doc]` | `CouncilMode` / `CouncilModeId` `[E: types.ts:3,25]`; 7 registered `[E: modes/index.ts:18]` |
| **Agent** | One participant with a name, role, and system prompt | PRD §5 `[doc]` | `CouncilAgent` `[E: types.ts:12]` |
| **Specialist** | A non-judge agent giving an independent perspective | PRD `[doc]` | `getSpecialists()` = agents where `!isFinalJudge` `[E: types.ts:35]` |
| **(Final) Judge** | The agent that synthesises specialists into the report | PRD `[doc]` | `isFinalJudge` flag; `getFinalJudge()` `[E: types.ts:42]` |
| **Council Run** | One execution: input + mode → responses + report | PRD `[doc]` | `RunCouncilResult` `[E: types.ts:137]`; no persistent run identity beyond an id string |
| **Final Report** | The structured synthesis (summary, conclusions, agreements, disagreements, risks, recommendations, confidence) | PRD §6 `[doc]` | `FinalReport` `[E: types.ts:53]` |
| **Conversation** | A stored council run owned by a user | PRD (history) `[doc]` | `StoredConversation = RunCouncilResult & {title, userId}` `[E: storage/types.ts:6]` |
| **Confidence** | A 1–5 trust score on a response/report | PRD / README `[doc]` | **`[GAP]`** hardcoded `4/1/3`, never computed `[E: runCouncil.ts:336,375; supabaseStorage.ts:122]` |
| **Peer Review / Ranking** | Agents evaluate each other's answers anonymously before judgment | **README:23-25 `[doc]`** | ~~**`[GAP]` absent**~~ → **[Closed 2026-06-30]** now implemented as optional Phase 1.5 `[E: runCouncil.ts:418]` |
| **Deliberation** | The collective reasoning process across stages | PRD framing `[doc]` | Partial — parallel independent answers + 1 judge; agents never interact `[E: buildPrompts.ts:36]` |
| **Fallback Report** | A degraded report built from raw specialist text when the judge can't run | (not in docs) | Code-only concept `[E: runCouncil.ts:567]` — a term the **code** has that the docs don't |

---

## Subdomain classification

Scored through a **product lens**, not code elegance:

| Area | Class | Justification |
| ---- | ----- | ------------- |
| **Council orchestration + synthesis** (modes, agents, judge, report) | **Core** | This *is* the product's differentiator — multi-perspective deliberation into one report. All design effort belongs here. |
| **Prompt contracts** (`buildPrompts`) | **Core** | The quality of the deliberation lives in the prompts; it is the product, expressed as text. |
| **LLM access** (providers, model selection) | **Supporting** | Necessary, not differentiating — any capable model behind a stable port would do. Candidate for an ACL (doc 3). |
| **Conversation persistence / history** | **Supporting** | Needed for a multi-user app, but standard CRUD; not where the product wins. |
| **Authentication / user accounts** | **Generic** | Commodity — provided by NextAuth/Supabase; buy, don't build. |

---

## Aggregate candidates

| Candidate aggregate | Business rule it would own | Enforcement today |
| ------------------- | -------------------------- | ----------------- |
| **CouncilRun** | A run yields a judge report **iff** a judge exists and ≥2 specialists succeed; else a fallback report; exactly one judge | **Enforced procedurally** in `runJudge`/`normalizeJudges` `[E: runCouncil.ts:448,65]` — correct, but the rules live in orchestration code, not a domain object |
| **UserConversations** | A user sees only their own conversations; a user holds ≤ `MAX_CONVERSATIONS_PER_USER` (oldest evicted) | **Split:** the count cap is enforced in `save` `[E: localStorage.ts:76]`; **ownership is enforced only at the route**, not the contract `[E: storage/types.ts:30]` — see L4 / doc 2 |

---

## Model vs code (the gaps that matter)

| # | Doc says | Code does | Impact |
| - | -------- | --------- | ------ |
| **MC-1** _(closed 2026-06-30)_ | "Stage 2: Peer Review & Ranking — agents evaluate each other (anonymized)" `[doc: README:23-25]` | **As of 06-15:** no peer-review stage existed. **Now:** implemented as optional Phase 1.5 `[E: runCouncil.ts:418]`. Was the highest-impact gap; since resolved. |
| **MC-2** _(resolved 2026-06-30)_ | Judge weighs *anonymized* responses | **Clarified:** anonymization is the **peer-review** phase (Phase 1.5); the **judge** intentionally reads **named** specialists (role context aids synthesis). The stale README "judge reads A/B/C" claim and the misleading code comment are both gone — docs and code now agree. |
| **MC-3** _(acknowledged 2026-06-30)_ | "Confidence" is a meaningful trust score `[doc]` | The **report** confidence **is** judge-computed (1–5 with justification, [buildPrompts.ts](../../src/prompts/buildPrompts.ts)). Only the **per-specialist** `confidence` is a fixed UI placeholder `[E: runCouncil.ts:320,361]`, not over-claimed in user docs. Intentional placeholder, not a hidden bug. |
| **MC-4** _(✅ shipped 2026-06-30)_ | A "Conversation" belongs to a user | **Now in the contract:** `getOwned(id, userId)` `[E: storage/types.ts:40]`; raw `get()` internal-only. Was a convention; now a guarantee. See [../changes/refactor-opportunities/plan.md](../changes/refactor-opportunities/plan.md). |
| **MC-5** _(closed 2026-06-30)_ | The model promises a `swot` analysis mode parity | **Fixed:** `swot` now has a SWOT-specific `MODE_DESCRIPTIONS` entry `[E: buildPrompts.ts:16]` — no longer the generic fallback. |

---

## Ranking for refactor (which invariant/aggregate first)

Scored on **(a) core**, **(b) routed/spread**, **(c) weak/silent**:

1. **UserConversations ownership (MC-4)** — (a) core to multi-user, (b) spread to every `get` caller, (c) **silent breach if forgotten**. → **highest risk-of-silence.** This was the L4 refactor — **✅ now shipped** ([../changes/refactor-opportunities/plan.md](../changes/refactor-opportunities/plan.md)).
2. **CouncilRun validity (judge/specialist/report rules)** — core and routed, but **already enforced** procedurally and tested; modelling it as an aggregate (doc 2) is *clarity*, not bug-fixing.
3. **Peer-review / deliberation gap (MC-1)** — highest *product* impact, but it's a **build-or-document decision**, not an invariant to enforce. Routed to roadmap.

**Hand-off:** doc 2 designs the **CouncilRun** aggregate (the core domain object); doc 3 designs the **Anti-Corruption Layer** for the LLM-provider boundary. The ownership invariant is executed as the L4 refactor.
