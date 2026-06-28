# ADR-0002: OpenRouter as Sole LLM Gateway

## Status

Accepted

## Date

2026-06-08

## Context

The Multi-Agent LLM Council needs to call multiple LLM models from different vendors (OpenAI, Anthropic, Google, Meta, etc.) to provide diverse perspectives. We must decide how to route requests to these models.

Options on the table:

1. **Direct vendor SDKs** — import `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, etc., and manage each integration separately.
2. **OpenRouter as a unified gateway** — a single API endpoint that proxies to 100+ models with a consistent chat-completions interface.
3. **LiteLLM or similar proxy** — self-hosted proxy that normalises vendor APIs.

Forces at play:

- The MVP must support multiple models from day one (the core value proposition is multi-model deliberation).
- Each vendor SDK has different auth, error handling, streaming, and rate-limit semantics.
- We want to avoid vendor lock-in but also avoid the maintenance burden of N integrations.
- Users may not have API keys for every provider they want to use.
- Cost matters — free models lower the barrier to entry.

## Decision

We will use **OpenRouter as the sole LLM gateway**. All model calls go through `https://openrouter.ai/api/v1/chat/completions`, which exposes an OpenAI-compatible chat-completions interface for every model it carries.

The provider abstraction (`src/providers/`) wraps a single HTTP client, not N vendor SDKs. The `OPENROUTER_API_KEY` env var is the only key required. The default model is `openrouter/free`, which routes to free-tier models at no cost.

## Consequences

### Positive

- One API key, one HTTP client, one error-handling path — dramatically simpler than N vendor SDKs.
- Access to 100+ models immediately, including free-tier options for zero-cost demos.
- OpenAI-compatible interface means we could swap to direct OpenAI calls or another compatible proxy with minimal code changes.
- `LLM_PROVIDER=mock` mode works without any API key, enabling full end-to-end testing.

### Negative

- Dependency on a single third-party service — if OpenRouter goes down, all model calls fail.
- Latency overhead from the proxy hop (typically <100ms).
- OpenRouter's model catalogue may lag behind vendor releases.
- Rate limits are governed by OpenRouter's policies, not the underlying provider's.

### Neutral

- The `LLMProvider` interface in `src/providers/types.ts` still abstracts away the concrete provider, so a future direct-vendor integration would not require changes to `src/core/`.

## Alternatives Considered

### Direct vendor SDKs

Full control and no proxy dependency, but each vendor has different auth, streaming, and error semantics. Maintaining N integrations is unjustified for the MVP when a unified gateway exists.

### LiteLLM self-hosted proxy

Removes the third-party dependency, but adds operational burden (deploy, monitor, update the proxy). Not justified for the MVP; revisit if OpenRouter reliability becomes an issue.

## References

- [src/providers/openRouterProvider.ts](../../src/providers/openRouterProvider.ts) — OpenRouter HTTP client with retry/timeout
- [src/providers/types.ts](../../src/providers/types.ts) — `LLMProvider` interface
- [src/providers/mockProvider.ts](../../src/providers/mockProvider.ts) — mock provider for testing
- [OpenRouter API docs](https://openrouter.ai/docs)
