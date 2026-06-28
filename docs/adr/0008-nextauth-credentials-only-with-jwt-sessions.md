# ADR-0008: NextAuth Credentials-Only Authentication with JWT Sessions

## Status

Accepted

## Date

2026-06-09

## Context

The application needs user authentication to support:

- **Ownership** — conversations and discussions belong to a user; other users must not access them.
- **Personalisation** — user-specific settings (API keys, preferred models) stored per account.
- **Rate limiting** — per-user quotas for council runs and conversation storage.

We must decide on an authentication mechanism that works for both self-hosted single-user deployments and multi-user hosted deployments.

Forces at play:

- The MVP does not need social login (Google, GitHub, etc.) — email/password is sufficient.
- Self-hosted users should not need to configure OAuth providers.
- The app is a Next.js monolith — NextAuth (Auth.js) is the idiomatic choice.
- Sessions must survive page refreshes but don't need to be shared across different domains.
- The app may run behind a reverse proxy (Render, Docker), so the auth system must trust forwarded headers.

## Decision

We will use **NextAuth v5 (Auth.js) with credentials-only authentication and JWT sessions**:

1. **Credentials provider only** — users register with email + password. Passwords are hashed with bcrypt. No OAuth/social providers in the MVP.
2. **JWT session strategy** — sessions are stored as signed JWTs in cookies, not in a server-side session store. This avoids the need for a shared session database and works with both local and Supabase storage.
3. **7-day session max age** — balances security (not infinite) with convenience (no frequent re-login).
4. **Dynamic `AUTH_SECRET` resolution** — when `AUTH_SECRET` is not set (zero-config demo), an ephemeral random secret is generated per process. Sessions won't survive restarts, but the app boots without configuration. A warning is logged.
5. **`trustHost: true`** — enables the app to work behind reverse proxies (Render, Docker) by trusting the `X-Forwarded-Host` header. Without this, Auth.js rejects the internal host as `UntrustedHost`.

## Consequences

### Positive

- Zero-config for demos: the app boots and authenticates without any environment variables.
- No OAuth provider setup required — self-hosted users don't need to create Google/GitHub OAuth apps.
- JWT sessions are stateless — no shared session store needed, works with both storage backends.
- `trustHost` makes deployment behind reverse proxies seamless.

### Negative

- Credentials-only means users must create yet another account. No "Sign in with Google" convenience.
- JWT sessions cannot be revoked server-side — if a token is compromised, it remains valid until expiry. No "logout everywhere" feature.
- The ephemeral `AUTH_SECRET` fallback means demo sessions are lost on restart — confusing if users don't read the logs.
- `trustHost: true` is a security trade-off: it trusts the proxy's `X-Forwarded-Host` header. Safe behind a trusted reverse proxy, but dangerous if the app is exposed directly to the internet without one.

### Neutral

- The auth layer is decoupled from storage via `userStorage` — the same credentials provider works with both local JSON and Supabase user stores.

## Alternatives Considered

### OAuth-only (no credentials)

Would eliminate password management, but requires every self-hosted user to register OAuth applications with Google/GitHub/etc. Violates the zero-config goal.

### Server-side sessions (database-backed)

Would enable session revocation and "logout everywhere", but requires a shared session store (Supabase or Redis). Adds complexity and a hard dependency on the database for auth. JWT is simpler for the MVP.

### Magic link / passwordless

Better UX (no passwords to remember), but requires email sending infrastructure. Not justified for the MVP.

## References

- [src/auth/config.ts](../../src/auth/config.ts) — NextAuth configuration
- [src/auth/userStorage.ts](../../src/auth/userStorage.ts) — user storage abstraction
- [src/app/api/council/route.ts](../../src/app/api/council/route.ts) — `auth()` call for session resolution
