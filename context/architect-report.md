# 10xArchitect Report — Multi-Agent LLM Council

**Author:** Krzysiek · **Date:** 2026-06-15 · **For:** 10xArchitect badge (Module 4)
**Backing artifacts:** [repo-map.md](map/repo-map.md) (L2) · [council-pipeline-analysis/research.md](changes/council-pipeline-analysis/research.md) (L3) · [refactor-opportunities/research.md](changes/refactor-opportunities/research.md) + [plan.md](changes/refactor-opportunities/plan.md) (L4) · [domain/01-03](domain/) (L5)

> Every structural claim below is cited to a source artifact and a `file:line`. The dependency graph is generated with **madge 8.0.0**, structural counts verified with **ast-grep 0.43.0**, and history with `git log` — tool output, not hand-waving.

---

## 1. Project described

**Multi-Agent LLM Council** — a Next.js 16 / React 19 / TypeScript-strict modular monolith that runs a user's question through several perspective-specialised LLM agents in parallel and synthesises one structured report via a judge agent. ~8,500 LoC, **37 commits over ~1 week** (2026-06-08→15), one dominant author. `Core` is UI-independent and reused by both the API route and a CLI. I ran all four Module-4 analyses on this single repo; it is small in history but rich enough in structure (a 748-line orchestrator, dual storage/auth backends, 7 modes, a streaming API) to support real architectural work.

> **Honest framing (stated, not hidden):** this is a *young* repo, not legacy. History-derived signals (churn, co-change, "whom to ask") are directional over days, not years — I flag this everywhere it matters rather than dressing a week-old repo as an archaeological dig.

## 2. Map highlights (L2)

- **Hub:** `core/runCouncil.ts` is the orchestrator everything funnels through; `core/types.ts` is the most depended-upon module (widest blast radius). **0 circular dependencies** (madge-verified), and **`core/*` imports no `app/*`** — the "Core must not depend on UI" rule holds at the import level.
- **Hot front/back seams** from co-change: `api/council ↔ page.tsx` and `api/user/settings ↔ settings/page.tsx` move together — the NDJSON/HTTP contracts are convention-coupled across the boundary.
- **Six risk zones**, the sharpest being a **documentation-vs-code divergence** (below) and the **storage authorization seam**.
- A coupling no import-graph would catch: the run-result type is reused verbatim as the persisted shape (`StoredConversation = RunCouncilResult & {…}`, [storage/types.ts:6](../src/storage/types.ts#L6)) — changing the result type silently changes what's stored.

## 3. Feature analysis (L3) — the council run

**Flow (not files):** POST → Zod validate → optional `auth()` (gates *persistence*, not *execution*) → NDJSON stream opens → orchestrate (merge custom agents → normalize judges → assign fallback models → **Phase 1 specialists in parallel** → **Phase 2 judge** with 2× retry, else fallback report) → persist if signed in (evict beyond `MAX_CONVERSATIONS_PER_USER = 5`) → final result line.

**Top debts, verified:**
- **D1 — the advertised "Stage 2: Peer Review & Ranking" does not exist.** README:23-25 promises anonymized peer evaluation you can "inspect"; the code has **2 phases, no peer-review prompt**. A grep for `peer|ranking|stage 2` across `src/` returns **only de-anonymization comments — zero implementation** *(rg)*. Even the judge isn't anonymized: comments at [runCouncil.ts:481](../src/core/runCouncil.ts#L481) claim "Response A/B/C", but [buildPrompts.ts:157](../src/prompts/buildPrompts.ts#L157) labels specialists by **real name**.
- **D2 — authorization by convention.** `StorageProvider.get(id)` takes no `userId` ([storage/types.ts:30](../src/storage/types.ts#L30)); ownership is re-checked at **2 route sites with two different guard shapes** ([route.ts:30](../src/app/api/conversations/[id]/route.ts#L30) vs [:61](../src/app/api/conversations/[id]/route.ts#L61)) — a silent IDOR waiting for a third caller.
- **D3 — the judge contract is a prose↔regex handshake** (headings defined in the prompt, parsed by regex; rename one side → silently empty report).
- Plus cheap debt: a dead `case "critical-review"` that can't match the id `"criticalReview"`, a half-wired `swot` mode, and a hardcoded `confidence` (only **3 assignment sites**, never computed — *rg*).

## 4. Refactoring plan (L4)

I enumerated all six debts, classified them (refactor vs guard vs product-decision vs L5), and **ranked by risk-of-silence, not surface ugliness**. The ranking **overturned the obvious pick**: the 748-line regex-heavy judge contract (D3) *looks* worst but degrades safely into a fallback; the quiet **authorization seam (D2)** ranked #1 because a forgotten check is a silent breach.

**Chosen:** move ownership into the storage contract — `getOwned(id, userId)` via **Branch by Abstraction**.
**Why it's safe:** the characterization test **already exists** ([idor.spec.ts](../tests/e2e/tests/idor.spec.ts)) — the L4 "test before you touch" rule is satisfied up front; the refactor proceeds under a green oracle.
**Phases (each lands green):** (1) characterize at unit level; (2) add `getOwned` beside `get`, no callers switched; (3) migrate the 2 route sites, unify the divergent guards; (4) retire the raw accessor — enforcement as a separate lever. Explicit non-goals: not building Stage 2, not touching the judge contract, not the provider ACL.

## 5. Domain notes (L5)

- **Ubiquitous-language gaps:** `Confidence`, `Peer Review`, and `Deliberation` exist in the docs but are absent or divergent in code; `Fallback Report` exists in code but not the docs.
- **Subdomains:** orchestration + prompts = **Core**; LLM access + persistence = **Supporting**; auth = **Generic** (buy).
- **Aggregate (`CouncilRun`):** the run-validity invariant (judge + ≥2 specialists ⇒ judge report, else fallback) is correct but re-derived in 3 places and rides on a `"[Error:"` magic string used at **10 sites** *(rg)*. Modelled as an aggregate with a single `canSynthesise()` guard and a typed `SpecialistOutcome` (retiring the magic string) — clarity work, not a bug-fix.
- **Anti-Corruption Layer:** the `OpenRouterProvider` *class* is already isolated (1 import site, the factory), but the **model-identifier string leaks across 18 files / 192 occurrences** *(rg)* — core types even comment "OpenRouter". Proposed a `ModelRef` value object + `ModelCatalogue` port so only an adapter knows the vendor; success criterion is a checkable `rg` returning zero vendor matches outside the adapter.

## 6. Decisions that are mine (not the agent's)

- **I reframed the project honestly as young, not legacy.** The lesson is legacy-shaped; rather than fake multi-year archaeology, I scoped every history claim to a 1-week window and said so. The integrity of the map mattered more than performing the legacy ritual.
- **I ranked D2 above D3 against first instinct.** The tooling and my eye both gravitated to the giant orchestrator/regex (D3). I overrode that: a *silent* security regression outranks a *loud-ish* parsing nuisance. Risk-of-silence drove the call.
- **I refused to let the "Stage 2" gap become a refactor.** It's the most eye-catching finding, but it's a product fork (build the feature vs. fix the docs), not a code-shape change — so it went to the roadmap, not the plan. Keeping scope honest beat scoring an easy headline.
- **I gave the provider boundary credit before criticising it.** The easy move was "everything leaks." The truth is finer: the class is contained, the *vocabulary* leaks. The ACL targets the real seam, not a strawman.

---

## Appendix — reproduce the evidence

```bash
# Dependency graph + cycles (madge 8.0.0)
npx madge --extensions ts,tsx --circular src      # → 0 cycles
npx madge --extensions ts,tsx --json src          # → the graph behind the Mermaid map

# Structural counts (ast-grep 0.43.0, via `sg`)
sg -p '$A.startsWith("[Error:")' src --lang ts     # → 8 detector sites in runCouncil.ts
sg -p 'createProvider($$$)'        src --lang ts     # → 2 call-sites

# The doc-vs-code centrepiece (any of grep/rg/sg): peer-review has zero implementation
rg -n 'peer|ranking|stage 2|evaluate each' src/    # → only de-anonymization comments
```
- **I insisted on tool-proven evidence over eyeballing.** Where the first pass relied on a hand-drawn graph and ripgrep, I installed and ran **madge** (0 cycles, the real dependency graph) and **ast-grep** (structural counts: `startsWith("[Error:")` → 8, `createProvider` → 2) so the map's claims are reproducible, not asserted — and I name the exact tool/version next to each number.
