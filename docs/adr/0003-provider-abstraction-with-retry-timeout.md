# ADR-0003: Provider Abstraction with Retry and Timeout

## Status

Accepted

## Date

2026-06-08

## Context

LLM API calls are inherently unreliable — network timeouts, rate limits (429), server errors (5xx), and empty or truncated responses are common. The council fans out multiple parallel calls per run (one per specialist agent, plus the judge), so the probability of at least one failure per run is high.

We need a strategy for handling transient failures in LLM calls that:

- Does not silently swallow errors.
- Does not crash the entire council run when a single agent fails.
- Retries transient failures with appropriate backoff.
- Enforces a per-request timeout so a hung connection cannot block a run indefinitely.
- Keeps the retry/timeout logic decoupled from the core council orchestration.

## Decision

We will implement a **provider abstraction layer** (`src/providers/`) with built-in retry with exponential backoff and per-request timeout via `AbortController`:

1. **`LLMProvider` interface** — a single `generate(input)` method. The core never touches HTTP directly.
2. **`OpenRouterProvider`** — implements the interface with:
   - Configurable retry: `maxRetries` (default 3), `baseDelayMs` (default 1000ms), exponential backoff (`baseDelay × 2^attempt`).
   - Configurable timeout: `requestTimeoutMs` (default 60 000ms), enforced via `AbortController.signal`.
   - All parameters overridable via env vars (`LLM_MAX_RETRIES`, `LLM_RETRY_BASE_DELAY`, `LLM_REQUEST_TIMEOUT`).
3. **`MockProvider`** — deterministic, context-aware mock for tests and demo mode. No network calls.
4. **`createProvider()` factory** — selects the concrete provider based on `LLM_PROVIDER` env var.

At the council level, **graceful degradation** applies: if an individual agent's `generate()` call fails after all retries, the agent returns an error response but the run continues with the remaining agents. Only if the judge fails does the system produce a fallback report from specialist responses.

Custom error types (`ProviderRetryError`, `ProviderTimeoutError`, `CouncilAbortedError`) give the API route enough information to return the correct HTTP status code (503, 504, or 499-equivalent).

## Consequences

### Positive

- Transient failures are handled automatically — users rarely see provider errors.
- Per-request timeout prevents hung connections from blocking a run.
- Graceful degradation means a 5-agent council with 1 failure still produces a useful result.
- The `LLMProvider` interface makes it trivial to add new providers (e.g., direct OpenAI, local Ollama) without touching core logic.
- Mock provider enables full test coverage without API keys or network access.

### Negative

- Retry with backoff adds latency on failure (up to ~7s for 3 retries with 1s base).
- The `AbortController` timeout is a hard cutoff — a response that would have arrived 1 second after the timeout is lost.
- Graceful degradation can mask recurring provider issues if users don't notice the `[Error: …]` responses.

### Neutral

- The retry/timeout config is per-provider, not per-agent. An agent that needs more retries must be handled at the council level (e.g., the judge has its own `withRetry` loop with `MAX_JUDGE_RETRIES = 2`).

## Alternatives Considered

### No retry — fail fast

Simpler code, but LLM APIs are flaky enough that a non-trivial percentage of runs would fail. The user experience would be poor.

### Retry at the API route level

Would require the route to understand provider semantics. Violates the separation between transport (HTTP) and domain (council orchestration).

### Circuit breaker pattern

Would add complexity (tracking failure rates, half-open state) that isn't justified for the current scale. Revisit if we see sustained provider outages.

## References

- [src/providers/openRouterProvider.ts](../../src/providers/openRouterProvider.ts) — retry + timeout implementation
- [src/providers/types.ts](../../src/providers/types.ts) — `LLMProvider`, `RetryConfig`, `TimeoutConfig`
- [src/providers/mockProvider.ts](../../src/providers/mockProvider.ts) — mock provider
- [src/core/errors.ts](../../src/core/errors.ts) — `ProviderRetryError`, `ProviderTimeoutError`, `CouncilAbortedError`
- [src/core/runCouncil.ts](../../src/core/runCouncil.ts) — `withRetry` helper, judge retry loop
