# Tech Stack — Multi-Agent LLM Council

> **Module 1 artefact.** Documents the chosen stack, why it is agent-friendly, and the operational defaults agents and humans share when working on this repo.

## 1. At a Glance

| Layer                   | Choice                          | Version          |
| ----------------------- | ------------------------------- | ---------------- |
| Meta-framework + API    | **Next.js (App Router)**        | 16.2             |
| UI library              | **React**                       | 19.2             |
| Language / type system  | **TypeScript** (strict)         | 5.x              |
| Styling                 | **Tailwind CSS**                | 4.x              |
| Validation              | **Zod**                         | 4.x              |
| Authentication          | **NextAuth (Auth.js)**          | 5.0 beta         |
| Password hashing        | **bcryptjs**                    | 3.x              |
| Database / persistence  | **Supabase (Postgres)** or local JSON | `@supabase/supabase-js` 2.x |
| LLM provider            | **OpenRouter** (with mock for demo) | n/a          |
| Unit / integration test | **Vitest**                      | 4.x              |
| E2E test                | **Playwright**                  | latest           |
| Lint                    | **ESLint** (`eslint-config-next`) | 9.x            |
| Runtime                 | **Node.js**                     | 18+              |
| Deployment target       | **Render Web Service**          | — (`render.yaml`)|

## 2. Why This Stack is Agent-Friendly

The 10xDevs course defines four signals of an "agent-friendly" stack: **typed, convention-based, popular in training data, well-documented**. This stack scores on all four.

| Signal                 | How this stack delivers                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Typed**              | TypeScript strict everywhere; Zod runtime validation at every system boundary; all public APIs have explicit return types. |
| **Convention-based**   | Next.js App Router (file-based routing, `route.ts`, `page.tsx`); next-auth conventions; Tailwind utility classes.    |
| **Popular**            | Next 16, React 19, Tailwind 4, Vitest 4 — all currently top-of-page in LLM training data and community Q&A.          |
| **Well-documented**    | Each layer has first-party docs; agents can be pointed at `nextjs.org`, `react.dev`, `tailwindcss.com`, `supabase.com`, `next-auth.js.org`. |

## 3. Layer-by-Layer

### 3.1 Application Layer — Next.js 16 (App Router)

- **Why:** Co-locates UI, API routes, and server components in one project. Removes the "frontend vs backend service" split — consistent with the modular-monolith decision in `architecture.md`.
- **Routing:** File-based under [src/app/](../src/app/).
- **API routes:** [src/app/api/](../src/app/api/) — `route.ts` files exporting `GET`/`POST`/`DELETE`.
- **Components:** Server components by default; `"use client"` directive only where state/effects are needed.

### 3.2 UI Layer — React 19 + Tailwind CSS 4

- **React 19** for interactive islands (input form, mode picker, agent customizer, history sidebar).
- **Tailwind 4** for styling — utility classes only, no inline styles. Dark theme by default (`#0a0a0a` background, `#ededed` foreground).
- **No CSS-in-JS, no external component library** — keeps the bundle small and the structural context one file away from the visual context (LLM-friendly).

### 3.3 Type System — TypeScript (strict)

- `tsconfig.json` runs in strict mode; `any` is forbidden, `unknown` is preferred for error handling.
- `type` for data shapes, `interface` for component props (convention from [AGENTS.md](../AGENTS.md)).
- Shared types live in [src/core/types.ts](../src/core/types.ts).

### 3.4 Validation — Zod 4

- Every external boundary validates with Zod:
  - `/api/council` request body ([src/app/api/council/route.ts](../src/app/api/council/route.ts))
  - Credentials at login ([src/auth/config.ts](../src/auth/config.ts))
  - User settings API
- Zod errors are mapped to structured HTTP error responses (`{ error, message, type }`).

### 3.5 Authentication — NextAuth 5 (Credentials)

- Credentials provider with bcrypt-hashed passwords.
- JWT session strategy, 7-day max age.
- Sign-in page at `/login`, registration at `/register`.
- Sessions are checked inside API routes via `await auth()` before any user-scoped action.

### 3.6 Persistence — Storage Abstraction

- `StorageProvider` interface ([src/storage/types.ts](../src/storage/types.ts)) — provider-agnostic.
- Two implementations:
  - **Local JSON files** — [src/storage/localStorage.ts](../src/storage/localStorage.ts) under `./data/conversations/` (default; great for local dev and demo).
  - **Supabase Postgres** — [src/storage/supabaseStorage.ts](../src/storage/supabaseStorage.ts) for hosted deployment.
- Switch with `DB_PROVIDER=local|supabase`.
- Hard cap: max 5 conversations per user (oldest auto-deleted) — keeps MVP scope tight.

### 3.7 LLM Provider — OpenRouter + Mock

- `LLMProvider` interface ([src/providers/types.ts](../src/providers/types.ts)).
- **OpenRouter** — single provider implementation reaching ~100+ models; per-agent model override.
- **Mock provider** — used when `LLM_PROVIDER=mock`; required for the demo / no-key reviewer path and for all tests. It simulates a real LLM rather than returning fixed strings: it detects the request shape (specialist / report judge / answer judge / peer review / discussion turn / discussion summary / code review), extracts the actual question or topic from the prompt, and composes a contextual, role-flavoured reply. Output is **deterministic** (seeded by the request, no `Math.random`) so it is snapshot-safe, yet varies across questions and roles. For tests needing full control, `setMockResponder` (script/force-fail/defer per call), `setMockLatency`, and `resetMockProvider` are exported from [src/providers](../src/providers/index.ts).
- **Provider registry.** `createProvider` ([src/providers/index.ts](../src/providers/index.ts)) resolves providers from a table (`PROVIDER_REGISTRY`) keyed by `LLM_PROVIDER`. Adding a provider = implement `LLMProvider` + add one registry entry; nothing else in the factory is provider-specific.
- **Per-user key override (BYOK).** A signed-in user can save their own key for a provider (Settings → `providerSettings[providerId].apiKey`). The council/discuss routes build a `ProviderOverride` (`{ providerId, apiKey }`) via `resolveProviderOverride` and pass it into `createProvider`, which **builds that specific provider with the user's key, even when `LLM_PROVIDER=mock`**. The key is routed by `providerId` (not hardcoded to OpenRouter), so BYOK works for any registered provider. A demo instance thus runs on mock by default while each user can bring their own key for live LLMs; no key → the env-configured provider, as before.
- Retry with exponential backoff (configurable via `LLM_MAX_RETRIES`, `LLM_RETRY_BASE_DELAY`).
- AbortController timeout (configurable via `LLM_REQUEST_TIMEOUT`).
- Errors are normalized to `ProviderRetryError` / `ProviderTimeoutError` so the API route can map them to 503 / 504.

### 3.8 CLI — `tsx`

- [src/cli/index.ts](../src/cli/index.ts) consumes the same `runCouncil()` as the web API.
- Run with `npm run council -- --mode decision "Your question"`.
- Supports `--list-modes`, `--json`, `--help`.

### 3.9 Testing

- **Vitest** for unit + integration ([tests/](../tests/)). All tests use the mock provider, never hit a real LLM.
- **Playwright** for E2E ([tests/e2e/](../tests/e2e/)). Local dev server expected on `http://localhost:3000`.

### 3.10 Deployment — Render

- [render.yaml](../render.yaml) defines a single Web Service.
- Build: `npm install && npm run build`.
- Start: `npm start`.
- Health check: Render polls `/api/health` (dependency-free liveness route) for zero-downtime deploys.
- `AUTH_SECRET` auto-generated by Render (`generateValue: true`); `OPENROUTER_API_KEY` injected from the dashboard (`sync: false`).
- `LLM_PROVIDER=mock` + `DB_PROVIDER=local` are the safe defaults — the app deploys and runs end-to-end without an API key.

**CI deploy:** [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) triggers a Render deploy via the Render API (needs repo secrets `RENDER_SERVICE_ID` and `RENDER_API_KEY`). [build-test-deploy.yml](../.github/workflows/build-test-deploy.yml) chains the full build/test/e2e gate before deploying — run it manually from the Actions tab.

## 4. Repository Conventions

These are extracted from [AGENTS.md](../AGENTS.md) and should be honoured by both humans and AI agents.

- **Module boundaries:** UI ↔ API route ↔ Council Core ↔ Provider. Core never imports from UI.
- **Don't-touch zones:** [src/core/runCouncil.ts](../src/core/runCouncil.ts), [src/providers/openRouterProvider.ts](../src/providers/openRouterProvider.ts), [src/core/errors.ts](../src/core/errors.ts) — edit with extreme care.
- **Error taxonomy:** `ValidationError`, `ModeNotFoundError`, `ProviderRetryError`, `ProviderTimeoutError`. Each maps to a specific HTTP status.
- **Logging:** `logger.debug/info/error`. `LOG_LEVEL` env var controls verbosity. For full raw prompt/response capture (debugging/auditing), enable `COUNCIL_RAW_LOG` — see `src/core/rawTranscript.ts`.

## 5. Environment Variables

| Variable                 | Default                  | Purpose                                       |
| ------------------------ | ------------------------ | --------------------------------------------- |
| `LLM_PROVIDER`           | `mock`                   | `mock` or `openrouter`                        |
| `OPENROUTER_API_KEY`     | —                        | Required when `LLM_PROVIDER=openrouter`       |
| `OPENROUTER_MODEL`       | `openrouter/free`        | Default model when none specified per-agent   |
| `LOG_LEVEL`              | `info`                   | `debug`, `info`, `error`                      |
| `COUNCIL_RAW_LOG`        | `false`                  | When truthy, write full raw prompt/response per model call to disk |
| `COUNCIL_RAW_LOG_DIR`    | `./logs/council`         | Directory for raw transcript files            |
| `COUNCIL_RAW_LOG_FORMAT` | `jsonl`                  | `jsonl` (one JSON per line) or `text`         |
| `LLM_MAX_RETRIES`        | `3`                      | Max retry attempts                            |
| `LLM_RETRY_BASE_DELAY`   | `1000`                   | Base backoff delay (ms)                       |
| `LLM_REQUEST_TIMEOUT`    | `60000`                  | Per-request timeout (ms)                      |
| `NEXT_PUBLIC_APP_URL`    | `http://localhost:3000`  | OpenRouter referer header                     |
| `AUTH_SECRET`            | —                        | NextAuth JWT signing secret (required)        |
| `DB_PROVIDER`            | `local`                  | `local` (JSON files) or `supabase`            |
| `SUPABASE_URL`           | —                        | Required when `DB_PROVIDER=supabase`          |
| `SUPABASE_SERVICE_ROLE_KEY` | —                     | Required when `DB_PROVIDER=supabase`          |

## 6. Stack Decisions That Were Not Made

Documented to prevent re-litigation:

- **No separate backend service.** Single deployable. See `architecture.md` §2.
- **No public SDK in the MVP.** CLI is the alternative interface. See `architecture.md` §9.
- **No PostgreSQL ORM (Prisma / Drizzle).** Supabase JS SDK is sufficient at this scale; storage is hidden behind `StorageProvider`.
- **No state-management library (Redux, Zustand).** State lives in `page.tsx` and the AuthProvider context.
- **No CSS-in-JS.** Tailwind only.
- **No icon library.** Inline SVGs as needed.

## 7. Constraints For Future Changes

- A new LLM provider must implement `LLMProvider` (`src/providers/types.ts`) and register in `src/providers/index.ts`. No direct provider use from `runCouncil.ts`.
- A new council mode must register in [src/modes/index.ts](../src/modes/index.ts), in the `CouncilModeId` union, and in the Zod schema of `/api/council`. See [AGENTS.md](../AGENTS.md) §"Adding a New Council Mode".
- A new storage backend must implement `StorageProvider` and register in [src/storage/index.ts](../src/storage/index.ts).
- No new top-level directory without updating [AGENTS.md](../AGENTS.md).
