# ADR-0006: Bring-Your-Own-Key Provider Override

## Status

Accepted

## Date

2026-06-20

## Context

The application supports two deployment scenarios:

1. **Hosted** — the server operator provides the `OPENROUTER_API_KEY` env var, and all users share that key and its quota.
2. **Self-hosted / demo** — the server runs with `LLM_PROVIDER=mock` and no real API keys, providing a keyless demo experience.

Neither scenario serves users who want to use their own OpenRouter API key for personal quota and model access. This is especially important for:

- Users on the hosted instance who have their own OpenRouter accounts and don't want to share the server's quota.
- Users who want access to paid models that the server's key may not cover.
- Users who want their usage billed to their own account for cost tracking.

We need a way for authenticated users to supply their own API key that overrides the server's default provider for their council runs.

## Decision

We will implement a **bring-your-own-key (BYOK)** mechanism:

1. **User settings storage** — authenticated users can save a provider API key via the Settings page (`/settings`). The key is stored in the user's storage record (local or Supabase) under `providerSettings`.
2. **Provider override resolution** — when a council run starts, the API route checks the authenticated user's `providerSettings`. If a key is present, it constructs a `ProviderOverride` (`{ providerId: "openrouter", apiKey }`) and passes it to `runCouncil`.
3. **Provider factory integration** — `createProvider()` accepts an optional `ProviderOverride`. When present, it builds the specified provider with the user's key, overriding the `LLM_PROVIDER` env var. This means a user with a saved key gets real LLM responses even on a server running `LLM_PROVIDER=mock`.
4. **Key validation** — the Settings page validates the key by calling `POST /api/validate-key` before saving, so users get immediate feedback if the key is invalid.

The `ProviderOverride` type is defined in `src/providers/types.ts` and is part of the provider abstraction, not the core council logic. Adding a new provider to the registry automatically enables BYOK for it.

## Consequences

### Positive

- Users can run real LLM councils on a demo/mock server by supplying their own key.
- The server operator doesn't need to provision API keys for every user.
- Per-user billing: each user's usage is charged to their own OpenRouter account.
- The mechanism is provider-agnostic — adding a new provider to the registry automatically enables BYOK for it.

### Negative

- API keys are stored in the user storage layer (local JSON or Supabase). In the local storage case, keys are stored in plaintext on disk. Supabase storage should use encryption at rest.
- The key is transmitted from browser → API route on every council run (resolved server-side, not passed from the client per-request). This is secure over HTTPS but adds a storage read per request.
- Users must manage their own key rotation and revocation.

### Neutral

- BYOK only applies to authenticated users. Anonymous users always use the server's default provider.
- The `providerId` in `ProviderOverride` must match a key in the provider registry — there's no dynamic provider loading.

## Alternatives Considered

### Pass API key from client on every request

The client sends the key in the request body or a header. Simpler server-side (no storage), but the key is exposed in browser dev tools and request logs. Storing it in user settings is more secure and more convenient (set once, use always).

### Environment-variable-only approach

Users set `OPENROUTER_API_KEY` in their environment. Only works for self-hosted deployments — doesn't help users on a shared hosted instance.

### Per-user rate limiting instead of BYOK

Would limit abuse on a shared key but doesn't solve the fundamental problem: users want to use their own accounts and access models the server key doesn't cover.

## References

- [src/providers/types.ts](../../src/providers/types.ts) — `ProviderOverride` type
- [src/providers/index.ts](../../src/providers/index.ts) — `createProvider()` factory with override support
- [src/auth/providerOverride.ts](../../src/auth/providerOverride.ts) — `resolveProviderOverride()`
- [src/app/api/council/route.ts](../../src/app/api/council/route.ts) — BYOK resolution in the API route
