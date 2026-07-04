# Architectural Report — Module 4 (10xArchitect)

**Author:** Krzysiek · **Date:** 2026-07-04 · **Project:** Multi-Agent LLM Council
**Backing artifacts (all from the same repo):**
[repo-map.md](map/repo-map.md) (L2) ·
[council-pipeline-analysis/research.md](changes/council-pipeline-analysis/research.md) (L3) ·
[refactor-opportunities/research.md](changes/refactor-opportunities/research.md) + [plan.md](changes/refactor-opportunities/plan.md) (L4) ·
[domain/01](domain/01-domain-distillation.md)–[02](domain/02-invariant-aggregate-refactor.md)–[03](domain/03-anti-corruption-layer.md) (L5)

---

## 1. Projects described

All four Module-4 analyses were run on **one repository**, so there is no cross-project split to reconcile.

- **Multi-Agent LLM Council** — a Next.js 16 / React 19 / TypeScript-strict **modular monolith** that runs a user's question through several perspective-specialised LLM "specialist" agents in parallel, then has a "judge" agent synthesise one structured report. `Core` is UI-independent and reused by both the HTTP API route and a CLI.
- **Scale (as of today):** ~8,500 LoC of TS/TSX; **107 commits** over ~1 month (2026-06-08 → 07-04), one dominant author. The orchestrator [runCouncil.ts](../src/core/runCouncil.ts) is 847 lines; the UI hub [page.tsx](../src/app/page.tsx) is 1,025.
- **Where each artifact landed:** L2 map of the whole repo · L3 research on the *council-run* pipeline · L4 plan for the storage authorization seam · L5 domain notes (distillation, invariant/aggregate, anti-corruption layer).

> **Honest framing:** this is a *young* repo, not legacy. History-derived signals (churn, co-change, "whom to ask") are directional over weeks, not years — flagged wherever it matters rather than dressed up as archaeology.

## 2. Project map (L2)

- **Hub & sink:** [runCouncil.ts](../src/core/runCouncil.ts) is the orchestrator everything funnels through; [core/types.ts](../src/core/types.ts) is the most depended-upon module (widest blast radius). **0 circular dependencies** (madge-verified), and **`core/*` imports no `app/*`** — the "Core must not depend on UI" rule holds at the import level, not just by convention.
- **Hot front/back seams** (co-change, `[git]`): `api/council ↔ page.tsx` and `api/user/settings ↔ settings/page.tsx` move together — the NDJSON/HTTP contracts are convention-coupled across the boundary.
- **Factory seams** (`providers`, `storage`, `auth`) each fan out cleanly to a mock/local + real backend; `createProvider()` is called exactly **2×** (ast-grep).
- **The coupling no import-graph would catch:** the run-result type is reused verbatim as the persisted shape — `StoredConversation = RunCouncilResult & {title, userId}` ([storage/types.ts:6](../src/storage/types.ts#L6)) — so changing the result type silently changes what's stored.
- **Top unknowns / risk zones:** the documentation-vs-code divergence (the advertised "Stage 2 peer review"), the storage **authorization seam**, and the prompt **prose↔regex** judge contract — the three seams that "hurt", vs. the many that don't.

## 3. Feature analysis (L3) — the council run

I drilled into the single most central flow the map flagged: **what happens when a user runs a council.**

**Flow (not files):** POST → Zod validate (`mode` ∈ 7 enum values) → optional `auth()` (gates *persistence*, not *execution* — anonymous users still get full runs) → NDJSON stream opens (client disconnect aborts via `AbortController`) → orchestrate: merge custom agents → normalize judges → assign fallback models → **Phase 1 specialists in parallel** (each told not to see the others) → **Phase 2 judge** (skipped unless ≥2 specialists succeed; 2× retry w/ backoff, else a **fallback report** from raw text) → persist if signed in (evict beyond `MAX_CONVERSATIONS_PER_USER = 5`) → final `{kind:"result"}` line.

**Technical debt, verified (≥1 confirmed structurally):**
- **D2 — authorization by convention (the sharpest).** `StorageProvider.get(id)` took **no `userId`** ([research L3](changes/council-pipeline-analysis/research.md)); ownership was re-checked at **2 route sites with two different guard shapes** — a silent IDOR waiting for a third caller. *(verified: rg — 2 call-sites)* **This is the one I refactored (§4); it is now closed.**
- **D3 — the judge contract is a prose↔regex handshake.** Headings are defined in the prompt and parsed back by regex ([runCouncil.ts:188-251](../src/core/runCouncil.ts#L188)); rename one side → silently empty report sections.
- **D-string — failure is a string, not a type.** A failed agent returns content prefixed `"[Error: ...]"`, re-derived by `.startsWith("[Error:")` at **8 sites** in `runCouncil.ts` *(verified: ast-grep `$A.startsWith("[Error:")` → 8)* plus a 9th in the client — coupled across the API boundary with no shared type.
- **Cheaper debt:** a hardcoded `confidence` (never computed — 3 assignment sites, *rg*), a dead `case "critical-review"` that can't match the id `"criticalReview"`, and a half-wired `swot` mode.
- **D1 — doc-vs-code "Stage 2 peer review".** At analysis time the README advertised an anonymized peer-ranking stage the code never implemented (grep returned only de-anonymization comments). **Since closed:** peer review now runs as an optional **Phase 1.5** — `runPeerReview()` ([runCouncil.ts:427](../src/core/runCouncil.ts#L427)) — kept out of the L4 refactor because it was a *product* decision, not a code-shape change.

## 4. Refactoring plan (L4)

**What's refactored:** move conversation ownership **into the storage contract** — a new `getOwned(id, userId): Promise<StoredConversation | null>` that returns `null` for both *not-found* and *not-owned* (closing the enumeration side-channel), so route handlers translate `null → 404` in one consistent place. Delivered via **Branch by Abstraction**. I ranked debts **by risk-of-silence, not surface ugliness**: this overturned the obvious pick — the 748-line regex-heavy judge contract (D3) *looks* worst but degrades safely into a fallback, whereas the quiet authorization seam (D2) ranked #1 because a forgotten check is a *silent* breach.

**What we deliberately do NOT do:** not build Stage 2 (product fork, → roadmap), not touch the judge prose↔regex contract (D3, deferred), not build the provider ACL (that's L5), no rate-limiting, no change to the persisted shape or `MAX_CONVERSATIONS_PER_USER`, no behavioural change for legitimate users.

**Phases (each lands green; [idor.spec.ts](../tests/e2e/tests/idor.spec.ts) is the pre-existing regression oracle):**
1. Characterize current semantics at unit level — *auto:* `npm test` + typecheck + lint; tests only.
2. Add `getOwned` beside `get`, no callers switched — *auto:* new unit tests on both backends, suite green.
3. Migrate the 2 route sites, unify the divergent guards to `null → 404` — *auto:* `idor.spec.ts` green **unchanged** (proof the relocation preserved behaviour).
4. Retire raw `get()` from route paths (internal/test-only) — *auto:* rg shows 0 unguarded callers; *manual:* confirm no public path reaches the raw accessor.

**Status:** the plan was **executed** — `getOwned` is on the contract ([storage/types.ts:40](../src/storage/types.ts#L40)), used by both `[id]` route sites and the stats route (3 sites, verified rg), raw `get()` is internal/test-only, and `idor.spec.ts` stayed green throughout. Identified → planned → shipped under a green oracle.

## 5. Domain notes — DDD (L5)

- **Ubiquitous language (key gaps, model-vs-code):** `Confidence`, `Peer Review`, and `Deliberation` lived in the docs but were absent or divergent in code; `Fallback Report` lives in code but not the docs. Subdomains: orchestration + prompts = **Core**; LLM access + persistence = **Supporting**; auth = **Generic** (buy, don't build).
- **Invariant #1 & its aggregate — `CouncilRun`:** the run-validity rule *(judge + ≥2 specialists ⇒ judge report, else fallback)* is correct but re-derived in **3 places** and rides on the `"[Error:"` magic string used at **10 sites** *(rg)*. Modelled as an aggregate with a single `canSynthesise()` guard and a typed `SpecialistOutcome` that retires the magic string — clarity work, not a bug-fix.
- **Anti-Corruption Layer — which dependency leaks, through how many layers:** the `OpenRouterProvider` *class* is already well-isolated (1 import site, the factory), **but the model-identifier string leaks across 18 files / 192 occurrences** *(rg)* — core types even carry an "OpenRouter" comment. Proposed a `ModelRef` value object + `ModelCatalogue` port so only an adapter knows the vendor; the success criterion is a checkable `rg` returning **zero vendor matches outside the adapter**.

## 6. Decisions that are mine

- **I reframed the project honestly as young, not legacy.** The lesson is legacy-shaped; rather than fake multi-year archaeology, I scoped every history claim to the real window and said so. Integrity of the map beat performing the ritual.
- **I ranked D2 above D3 against first instinct.** Both my eye and the tooling gravitated to the giant orchestrator/regex (D3). I overrode that: a *silent* security regression outranks a *loud-ish* parsing nuisance. Risk-of-silence drove the call — and it's the one I actually shipped.
- **I refused to let the "Stage 2" gap become a refactor.** It was the most eye-catching finding, but building a feature vs. correcting docs is a *product* fork, not a code-shape change — so it went to the roadmap, not the L4 plan. (It was later built as Phase 1.5, on its own track.)
- **I gave the provider boundary credit before criticising it.** The lazy move was "everything leaks." The truth is finer: the *class* is contained, the *vocabulary* leaks — so the ACL targets the real seam, not a strawman, with a grep-checkable success test.

---

## Appendix — reproduce the evidence

```bash
# Dependency graph + cycles (madge 8.0.0)
npx madge --extensions ts,tsx --circular src        # → 0 cycles
npx madge --extensions ts,tsx --json     src        # → the graph behind the map

# Structural counts (ast-grep 0.43.0)
sg -p '$A.startsWith("[Error:")' src --lang ts       # → 8 detector sites in runCouncil.ts
sg -p 'createProvider($$$)'      src --lang ts       # → 2 call-sites

# The doc-vs-code centrepiece (as-of-analysis): peer review had zero implementation
rg -n 'peer|ranking|stage 2|evaluate each' src/      # → since closed: runPeerReview (Phase 1.5)

# The shipped refactor: ownership is now on the contract
rg -n 'getOwned' src/                                # → contract + 3 route call-sites
```
