# ADR-0007: Dual Storage Strategy — Local JSON and Supabase

## Status

Accepted

## Date

2026-06-09

## Context

The application needs to persist user data: conversations (council run results), discussions (roundtable history), user accounts, and user settings (API keys, preferred models). We must decide on a storage backend that works for both self-hosted single-user deployments and multi-user hosted deployments.

Forces at play:

- **Self-hosted / demo users** want zero infrastructure — no database to provision, no external services to configure. The app should work out of the box with `npm run dev`.
- **Hosted / multi-user deployments** need concurrent access, durability, and proper multi-tenancy (user isolation, ownership checks).
- The MVP must support both scenarios without maintaining two separate codebases.
- Data schema is simple (conversations, users, discussions) and unlikely to require complex queries in the near term.

## Decision

We will implement a **dual storage strategy** with a `StorageProvider` interface and two implementations:

1. **`localStorage`** (default) — stores each conversation as a separate JSON file in `data/conversations/`. Zero infrastructure; works out of the box. Selected when `DB_PROVIDER=local` (or unset).
2. **`supabaseStorage`** — stores data in PostgreSQL via Supabase client. Supports concurrent access, proper ACID guarantees, and row-level security for multi-tenancy. Selected when `DB_PROVIDER=supabase`.

A factory function (`createStorage()`) selects the implementation based on the `DB_PROVIDER` environment variable. The rest of the application (API routes, auth) depends only on the `StorageProvider` interface — never on a concrete implementation.

The same pattern applies to user storage (`userStorage`) and discussion storage, both of which delegate to the active `StorageProvider`.

Ownership enforcement is built into the interface: `getOwned(id, userId)` returns data only if the user owns it, collapsing "not found" and "not authorized" to prevent enumeration attacks. A hard cap (`MAX_CONVERSATIONS_PER_USER = 5`) prevents unbounded storage growth on shared instances.

## Consequences

### Positive

- Zero-config for self-hosted: `npm run dev` works immediately with local JSON files.
- Production-ready for hosted: Supabase provides PostgreSQL durability, concurrent access, and row-level security.
- The `StorageProvider` interface makes it straightforward to add new backends (e.g., SQLite, PlanetScale) without changing business logic.
- Ownership checks in the interface prevent IDOR vulnerabilities by design.

### Negative

- Two implementations to maintain and test — every storage feature must work in both backends.
- Local JSON storage has no concurrency control — simultaneous writes can corrupt data. Acceptable for single-user self-hosted, but must never be used in multi-user production.
- The `MAX_CONVERSATIONS_PER_USER` cap is a blunt instrument — it deletes the oldest conversation when the limit is hit, which may surprise users.

### Neutral

- Supabase was chosen over raw PostgreSQL because it provides auth, storage, and client libraries out of the box, reducing boilerplate. The trade-off is a dependency on Supabase's client SDK and service model.

## Alternatives Considered

### SQLite only

Single-file database, zero config, concurrent reads. Would work for both scenarios, but SQLite doesn't scale well for multi-user hosted deployments and lacks built-in row-level security. Adding Supabase later would still require the abstraction layer.

### Supabase only

Simpler codebase (one implementation), but forces every self-hosted user to provision a Supabase project. Violates the zero-config goal for demos and local development.

### Prisma ORM with multiple database drivers

Would provide type-safe queries and migrations, but adds a heavy build step (schema generation) and runtime overhead. The current data model is simple enough that raw SQL (via Supabase client) and JSON files are sufficient.

## References

- [src/storage/index.ts](../../src/storage/index.ts) — `createStorage()` factory
- [src/storage/types.ts](../../src/storage/types.ts) — `StorageProvider` interface
- [src/storage/localStorage.ts](../../src/storage/localStorage.ts) — local JSON implementation
- [src/storage/supabaseStorage.ts](../../src/storage/supabaseStorage.ts) — Supabase implementation
- [src/config.ts](../../src/config.ts) — `MAX_CONVERSATIONS_PER_USER`
