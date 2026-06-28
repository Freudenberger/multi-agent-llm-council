# ADR-0009: Live Roundtable Discussion as a Separate Feature

## Status

Accepted

## Date

2026-06-17

## Context

The council feature (ADR-0001) produces a one-shot analysis: specialists respond in parallel, then a judge synthesises. This is effective for structured evaluation, but it lacks the back-and-forth dynamics of a real discussion — agents can't challenge each other's points, build on ideas, or converge toward consensus through dialogue.

We need to decide whether to:

1. Extend the existing council flow with a "discussion mode" that adds rounds of back-and-forth.
2. Build a separate feature with its own orchestration, API endpoint, and UI.

Forces at play:

- A discussion is fundamentally different from a council run: it's turn-based (sequential rounds), not parallel; it runs for N rounds, not a fixed two phases; and it produces a conversation transcript, not a structured report.
- The council's `runCouncil` function is already complex (specialists → optional peer review → judge with retry). Adding discussion logic would make it harder to maintain.
- Discussions are long-running (2–4 agents × N rounds × LLM latency per turn = potentially minutes). They need their own progress tracking and cancellation.
- Users may want to save and revisit discussion transcripts, just like council conversations.

## Decision

We will implement the roundtable discussion as a **separate feature** with its own orchestration, API endpoint, storage, and UI:

1. **`src/core/runDiscussion.ts`** — separate orchestration function. Takes `RunDiscussionInput` (agent IDs, number of rounds, topic), runs N rounds of turn-based discussion (2–4 agents, each responding to the previous turns), then produces a closing summary.
2. **`POST /api/discuss`** — separate API endpoint that streams NDJSON progress events (same pattern as ADR-0004). Returns the full discussion transcript.
3. **`/discuss` page** — separate UI page (currently unlinked from main navigation — hidden feature). Shows live progress, collapsible turns, and model tracking.
4. **Discussion storage** — separate `StorageProvider` methods for discussions (`listDiscussions`, `getOwnedDiscussion`, `saveDiscussion`, `deleteDiscussion`). Same dual-backend pattern as conversations (local JSON + Supabase).
5. **Degenerate response detection** — models sometimes emit moderation labels or trivially short replies instead of substantive discussion turns. The `isDegenerateResponse()` function detects these and retries (up to `MAX_TURN_RETRIES = 2`).

Key design choices:

- **Sequential turns within a round** — each agent sees all previous turns in the round before responding. This creates genuine back-and-forth, unlike the council's parallel specialist phase.
- **Lower temperature for discussions** (0.8 vs. council's default) — encourages more focused, less random responses in a conversational setting.
- **Summary agent** — after all rounds, a dedicated summarisation call produces a closing synthesis at lower temperature (0.5) with more tokens (2048).

## Consequences

### Positive

- Clean separation: council and discussion are independent features that don't share orchestration logic. Changes to one don't risk breaking the other.
- The discussion feature can evolve independently (e.g., add voting, moderation, or human-in-the-loop turns) without affecting the council.
- Reuses existing infrastructure: same `LLMProvider` interface, same `StorageProvider` pattern, same NDJSON streaming, same `AbortSignal` cancellation.
- Degenerate response detection prevents wasted rounds from models that refuse to participate properly.

### Negative

- Code duplication: both `runCouncil` and `runDiscussion` have similar patterns (provider creation, progress events, raw transcript logging, abort handling). A shared abstraction could reduce this, but the control flows are different enough that premature abstraction would be worse.
- The `/discuss` page is unlinked — users can't discover it from the main UI. This is intentional for now (experimental feature) but limits adoption.
- Sequential turns mean discussions are slower than councils (N × rounds × latency vs. 1 × latency for parallel specialists).

### Neutral

- The discussion feature shares the same agent templates as the council. A new agent template is automatically available in both features.

## Alternatives Considered

### Extend runCouncil with a "discussion mode"

Would avoid code duplication, but the control flow is fundamentally different (sequential rounds vs. parallel specialists → judge). Forcing both into one function would create a complex branching structure that's harder to test and maintain.

### WebSocket-based live discussion

Would enable real-time streaming of each agent's response as it's generated (token by token). More interactive, but significantly more complex (WebSocket server, connection management, reconnection). NDJSON streaming over POST is simpler and sufficient for the MVP.

### No discussion feature

The council already provides multi-agent analysis. But the lack of back-and-forth is a real limitation — users want to see agents engage with each other's arguments, not just produce isolated perspectives.

## References

- [src/core/runDiscussion.ts](../../src/core/runDiscussion.ts) — discussion orchestration
- [src/app/api/discuss/route.ts](../../src/app/api/discuss/route.ts) — NDJSON streaming endpoint
- [src/app/discuss/page.tsx](../../src/app/discuss/page.tsx) — discussion UI
- [src/storage/types.ts](../../src/storage/types.ts) — discussion storage types
