# Research — Refactor Opportunities (ranking)

**Artifact:** L4, exploration stage (10xArchitect path) · **Change-id:** `refactor-opportunities` · **Date:** 2026-06-15
**Prior:** [council-pipeline-analysis/research.md](../council-pipeline-analysis/research.md) (debt D1–D6 taken as proven) + [repo-map.md](../../map/repo-map.md).

> **Intent:** Decide *which* of the debt items are worth fixing with a structural refactor, in what order. **Exploration only — no code changes, no decision.** Output is a ranking with trade-offs for a human to choose from. A separate session ([plan.md](./plan.md)) plans and implements the winner.
>
> **Evidence legend:** `[E]` file:line · `[I]` inference · `[U]` unknown. Counts marked *(rg)* verified with ripgrep.

---

## 1. Candidate enumeration & classification

Every problem from L3, classified: **CANDIDATE** = needs a structural code change · **NON-CANDIDATE** = guard/test/docs/data fill (an *input* to feasibility, not a refactor) · **ROUTE** = belongs to a different track.

| ID | Problem (from L3) | Class | Why |
| -- | ----------------- | ----- | --- |
| D1 | Advertised "Stage 2 peer review" doesn't exist | **ROUTE → product decision** | Not a refactor: either build a feature or fix docs. Belongs in `/10x-roadmap`, not here. |
| D2 | Authorization by convention (`get(id)` has no `userId`) | **CANDIDATE** | Structural: the ownership invariant must move into the contract. |
| D3 | Judge report is a prose↔regex handshake | **CANDIDATE** | Structural: introduce a parsing/contract seam. |
| D4 | Dead `case "critical-review"` | NON-CANDIDATE | One-line fix + test. Guard, not refactor. |
| D5 | `swot` mode half-wired (no description/judge prompt) | NON-CANDIDATE | Data fill in `MODE_DESCRIPTIONS`. Not structural. |
| D6 | `confidence` hardcoded (`4/1/3`) | NON-CANDIDATE → product decision | Remove or compute — a 1-line/contract choice, not a refactor. |
| D7 | Provider `model` string (OpenRouter-ism) leaks into core types | **ROUTE → L5 (ACL)** | Anti-Corruption Layer is the L5 domain artifact; analysed there. |

Two genuine refactor candidates remain: **D2** and **D3**.

---

## 2. Per-candidate analysis (shape · history · feasibility)

### Candidate D2 — Authorization contract

- **Current shape** `[E]`: `StorageProvider.get(id: string)` ([storage/types.ts:30](../../../src/storage/types.ts#L30)) returns *any* `StoredConversation`. Both implementations honour that — `localStorage.get` and `supabaseStorage.get` look up purely by id. Ownership is checked **outside** storage, at exactly **2 call-sites** *(rg)*, with **two different guard shapes**: GET `if (conversation.userId !== session.user.id) → 403` ([route.ts:30](../../../src/app/api/conversations/[id]/route.ts#L30)); DELETE `if (conversation && conversation.userId !== ...) ` ([route.ts:61](../../../src/app/api/conversations/[id]/route.ts#L61)).
- **History & intentionality** `[I]`: auth/storage are recent (commit `feat(auth): Supabase storage`, 2026-06-15, newest in the repo). The `get(id)`-only contract predates multi-user concerns and was **not** a deliberate decision to centralise authz in the route — it is **accidental complexity** from adding auth on top of a single-user storage shape. No ADR or commit message defends a route-only authz design `[U: no ADR present]`.
- **Migration feasibility** `[E]`: a ready-made safety net **already exists** — [tests/e2e/tests/idor.spec.ts](../../../tests/e2e/tests/idor.spec.ts) asserts user A gets 403 on B's conversation, B absent from A's list, owner 200, anon 401. That is a characterization test for the *current* guarantee, so a refactor can proceed under a green net. Strategy: **Branch by Abstraction** — add an ownership-aware method, migrate the 2 sites, retire the raw accessor. First prerequisite: confirm the IDOR e2e is green on `main`.

### Candidate D3 — Judge report contract

- **Current shape** `[E]`: prompt defines headings ([buildPrompts.ts:103-145](../../../src/prompts/buildPrompts.ts#L103)); `parseJudgeReport` regex-extracts them ([runCouncil.ts:188-251](../../../src/core/runCouncil.ts#L188)) and a truncation heuristic downgrades confidence on abrupt endings.
- **History & intentionality** `[I]`: parsing free-text Markdown from an LLM is a **semi-deliberate** choice — at build time there was no structured-output contract, and "ask for headings, parse headings" is the pragmatic default. It is closer to *deliberate-but-dated* than accidental: it works for the happy path and degrades to a fallback report rather than crashing ([runCouncil.ts:531-545](../../../src/core/runCouncil.ts#L531)).
- **Migration feasibility** `[E]`: heavier than D2. Existing unit tests ([tests/core/runCouncil.test.ts](../../../tests/core/runCouncil.test.ts)) cover judge retry/fallback but not heading↔parser alignment per mode. A refactor (structured output / JSON contract) would touch the prompt, the parser, the `FinalReport` type, and every mode. No single existing test pins the heading contract, so a characterization suite must be *written first*.

---

## 3. Ranking (top candidates)

Scored on the three axes the lesson prescribes: **(a) core to product**, **(b) pain now**, **(c) weak enforcement / risk of silence**.

| Rank | Candidate | (a) Core | (b) Pain now | (c) Weak enforcement | Verdict |
| :--: | --------- | :------: | :----------: | :------------------: | ------- |
| **#1** | **D2 — Authorization contract** | High — multi-user privacy is the reason auth exists | Medium — guarded today, but two divergent guards invite the next mistake | **High — a forgotten check is a silent IDOR breach** | **Refactor now.** Best risk-adjusted payoff; safety net already exists. |
| #2 | D3 — Judge report contract | High — the report is the product's output | Low–Medium — degrades gracefully, no crash | Medium — silent empty sections, but a fallback catches the worst case | Defer. Higher cost, needs a new characterization suite first; no active breach. |

**The ranking overturns the obvious pick.** D3 *looks* worse (748-line orchestrator, gnarly regex) but it fails *loudly-ish* into a fallback and is core-but-not-dangerous. **D2 is the quiet one**: it works, it's tested at two points, and it is exactly the shape that produces a silent security regression on the third call-site. Risk-of-silence, not surface ugliness, puts D2 first.

---

## 4. Candidates considered and rejected (with why)

- **D1 (Stage 2 peer review)** — *Not a refactor.* This is a product fork: build the deliberation stage (feature work for the roadmap) **or** correct the README/PRD (docs work). Either way it's a decision, not a structural code-shape change. Routed to `/10x-roadmap`.
- **D3 (judge contract)** — real, ranked #2, **deferred**: higher blast radius (prompt + parser + type + all modes), no existing characterization net, and it currently degrades safely. Right-sizing says fix the silent-breach candidate first.
- **D4 (dead case), D5 (swot), D6 (confidence)** — **guards/fills, not refactors.** D4 → delete the dead case + add a type-level mode-id test. D5 → add the `swot` `MODE_DESCRIPTIONS` entry. D6 → product decision to remove or compute `confidence`. None warrant a structural plan; batch them as small PRs.
- **D7 (provider `model` leak)** — **conscious-ish boundary issue**, analysed as the **Anti-Corruption Layer** in L5 ([context/domain/03-anti-corruption-layer.md](../../domain/03-anti-corruption-layer.md)), not here.

**Decision handed to the human:** proceed to plan **D2 (authorization contract)** — see [plan.md](./plan.md).
