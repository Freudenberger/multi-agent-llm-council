# ADR-0005: Anonymized Peer Review as Opt-In Phase

## Status

Accepted

## Date

2026-06-16

## Context

In the default two-phase council flow (specialists → judge), the judge sees which model produced each response. This creates a bias risk: the judge may weight responses from "better-known" models more heavily, regardless of content quality. The same bias can affect users reading the raw responses.

We want to add a peer-review mechanism where agents evaluate each other's responses, but we must decide:

1. Whether peer review should be a **separate council mode** (like "decision" or "SWOT") or a **run-level option** that works with any mode.
2. Whether to anonymize responses during review to prevent model-name bias.
3. Where in the pipeline the peer review sits.

Forces at play:

- Peer review adds latency and cost (N additional LLM calls, one per reviewer).
- Not every run needs peer review — simple queries may not justify the extra cost.
- Anonymization must be consistent: every reviewer sees the same labels ("Response A", "Response B", etc.) so rankings are comparable.
- The judge should receive peer rankings as additional signal, but the judge still sees de-anonymized names (it needs to attribute reasoning).

## Decision

We will implement peer review as a **run-level opt-in phase** (Phase 1.5), not a separate mode. When the user enables `peerReview: true` on a council run:

1. **Phase 1** runs as normal — specialists produce responses.
2. **Phase 1.5** — each specialist whose Phase-1 response succeeded re-enters as an impartial reviewer. Every reviewer sees the same set of responses **anonymized** as "Response A/B/C…" (authorship withheld to prevent bias). Reviewers evaluate and rank the responses.
3. **Phase 2** — the judge receives both the specialist responses (de-anonymized) and the peer reviews, and synthesises the final report.

Key design choices:

- **Fixed-order anonymization**: responses are labeled A, B, C… in a consistent order so every reviewer sees the same mapping. The mapping is logged for debugging but not exposed to the judge's prompt.
- **Run-level flag, not a mode**: `peerReview` is a boolean on `RunCouncilInput`, surfaced as the "Run with Peer Review" button in the UI and `--peer-review` in the CLI. It works with any council mode.
- **Graceful degradation**: if some reviewers fail, the remaining reviews are still passed to the judge.

## Consequences

### Positive

- Anonymization prevents model-name bias in peer evaluations — reviewers judge content, not reputation.
- Works with any mode — no need to create "decision-with-peer-review", "SWOT-with-peer-review", etc.
- Opt-in means users who don't need it don't pay the latency/cost penalty.
- Peer rankings give the judge an additional signal to weight responses, improving synthesis quality.

### Negative

- Adds N additional LLM calls per run (one per successful specialist), roughly doubling cost and latency.
- Anonymization is not foolproof — a model may recognise its own writing style.
- The mapping (Response A → model X) is ephemeral — not persisted to storage, only available in the API response and raw logs.

### Neutral

- The peer review prompt is strict about format ("FINAL RANKING:" header, numbered list) to enable reliable parsing of rankings.

## Alternatives Considered

### Peer review as a separate council mode

Would require duplicating every mode (decision-peer-review, SWOT-peer-review, etc.) or a combinatorial explosion. A run-level flag is simpler and more composable.

### No anonymization

Simpler implementation, but defeats the purpose — models would bias toward well-known models. The whole point of peer review is impartial evaluation.

### Peer review always on

Would double the cost and latency for every run. Many queries don't need the extra rigour. Opt-in respects the user's trade-off between cost and depth.

## References

- [src/core/runCouncil.ts](../../src/core/runCouncil.ts) — `runPeerReview()` function (Phase 1.5)
- [src/prompts/buildPrompts.ts](../../src/prompts/buildPrompts.ts) — `buildPeerReviewSystemPrompt`, `buildPeerReviewUserMessage`
- [src/app/api/council/route.ts](../../src/app/api/council/route.ts) — `peerReview` field in request schema
