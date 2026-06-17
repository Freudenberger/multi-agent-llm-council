# AGENTS.md — Project Rules for AI Agents

## Project Overview

**Multi-Agent LLM Council** — a deliberation system where multiple AI agents collaborate to answer questions from different perspectives, then synthesize insights into a balanced response.

Tech stack: **Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Vitest**

## Project Structure

```
src/
├── agents/defaultAgents.ts    # Agent templates (perspectives, roles)
├── app/
│   ├── api/
│   │   ├── council/route.ts   # POST /api/council — main analysis endpoint
│   │   ├── discuss/route.ts   # POST /api/discuss — live roundtable discussion (NDJSON)
│   │   └── models/route.ts    # GET /api/models — fetch free OpenRouter models
│   ├── components/
│   │   ├── AgentCustomizer.tsx # Agent customization UI
│   │   └── Markdown.tsx        # Zero-dependency markdown renderer
│   ├── agentData.ts            # Mode→agent mapping, template dedup
│   ├── discuss/page.tsx        # Hidden /discuss page — live agent roundtable (unlinked)
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main page (all UI state + orchestration)
├── cli/index.ts                # CLI entry point
├── core/
│   ├── errors.ts               # Custom error types
│   ├── index.ts                # Public exports
│   ├── logger.ts               # Structured logger (debug/info/error)
│   ├── runCouncil.ts           # Main orchestration (Phase 1 → Phase 2)
│   ├── types.ts                # Core types (CouncilAgent, CustomAgent, etc.)
│   └── types.ts                # RetryConfig, TimeoutConfig
├── modes/index.ts              # Council mode definitions (6 modes)
├── prompts/buildPrompts.ts     # Prompt builders for agents and judge
└── providers/
    ├── index.ts                # createProvider() factory
    ├── mockProvider.ts         # Mock provider for testing
    ├── openRouterProvider.ts   # OpenRouter provider with retry + timeout
    └── types.ts                # LLMProvider interface, GenerateInput/Output
```

## Module Responsibilities

| Module                   | Responsibility                             | Who uses it     |
| ------------------------ | ------------------------------------------ | --------------- |
| `src/core/runCouncil.ts` | Orchestrates the full council workflow     | API route, CLI  |
| `src/core/runDiscussion.ts` | Orchestrates the live turn-based roundtable (2-4 agents, N rounds) | `/api/discuss` |
| `src/core/types.ts`      | All shared TypeScript types                | Everything      |
| `src/providers/`         | LLM provider abstraction + retry/timeout   | `runCouncil.ts` |
| `src/modes/`             | Council mode definitions (agents per mode) | `runCouncil.ts` |
| `src/agents/`            | Agent templates (name, role, perspective)  | `agentData.ts`  |
| `src/prompts/`           | Prompt building functions                  | `runCouncil.ts` |
| `src/app/page.tsx`       | All UI state management + API calls        | Frontend        |
| `src/app/api/`           | HTTP endpoints                             | Frontend fetch  |

## Coding Conventions

### TypeScript

- **Strict mode enabled** — no `any`, no implicit `any`
- Use `type` over `interface` for data shapes
- Use `interface` for component props
- Prefer `unknown` over `any` for error handling
- All functions must have explicit return types in public APIs

### React / Next.js

- `"use client"` directive only on components using state/effects
- Server components by default (layout, page shells)
- Use `useCallback` for functions passed as props
- Use `useRef` for mutable values that shouldn't trigger re-renders

### Styling

- **Tailwind CSS 4** utility classes only — no inline styles
- Dark theme: background `#0a0a0a`, foreground `#ededed`
- Use `markdown-content` class for rendered markdown containers
- Color conventions: blue (primary), amber (validation/warning), red (error), green (success), purple (model badge)

### Error Handling

- Custom error classes in `src/core/errors.ts`: `ValidationError`, `ModeNotFoundError`, `ProviderRetryError`, `ProviderTimeoutError`
- API routes return structured JSON: `{ error, message, type, retryable }`
- Frontend displays color-coded banners per error type

### Logging

- Use `logger.debug()` for detailed tracing
- Use `logger.info()` for step completion
- Use `logger.error()` for failures
- Controlled via `LOG_LEVEL` env var (debug | info | error)

## Test Conventions

- **Vitest** for all tests
- Test files: `tests/**/*.test.ts`
- Mock provider used for all tests (no real API calls)
- Run: `npm test`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`

## Don't-Touch Zones

These files contain critical orchestration logic — modify with extreme care:

- `src/core/runCouncil.ts` — the main workflow (Phase 1: specialists → optional Phase 1.5: peer review/ranking → Phase 2: judge with retry)
- `src/providers/openRouterProvider.ts` — retry logic with exponential backoff + AbortController timeout
- `src/core/errors.ts` — error type hierarchy

## Environment Variables

| Variable               | Default                 | Purpose                  |
| ---------------------- | ----------------------- | ------------------------ |
| `LLM_PROVIDER`         | `mock`                  | `mock` or `openrouter`   |
| `OPENROUTER_API_KEY`   | —                       | Required for OpenRouter  |
| `OPENROUTER_MODEL`     | `openrouter/free`       | Default model            |
| `LOG_LEVEL`            | `info`                  | debug, info, error       |
| `COUNCIL_RAW_LOG`      | `false`                 | Write full raw prompt/response per model call to disk |
| `COUNCIL_RAW_LOG_DIR`  | `./logs/council`        | Raw transcript directory |
| `COUNCIL_RAW_LOG_FORMAT` | `jsonl`               | `jsonl` or `text`        |
| `LLM_MAX_RETRIES`      | `3`                     | Max retry attempts       |
| `LLM_RETRY_BASE_DELAY` | `1000`                  | Base backoff delay (ms)  |
| `LLM_REQUEST_TIMEOUT`  | `60000`                 | Per-request timeout (ms) |
| `NEXT_PUBLIC_APP_URL`  | `http://localhost:3000` | OpenRouter referer       |

## Key Architectural Decisions

1. **Modular monolith** — single deployable app, not separate frontend/backend services
2. **Shared core** — `src/core/` and `src/providers/` used by both web API and CLI
3. **Per-agent model selection** — each agent can use a different OpenRouter model. A user-level allow-list (`User.preferredModels`, passed to `runCouncil` as `fallbackModels`) randomly assigns a model to any agent without an explicit one; explicit per-agent models always take precedence.
4. **Judge retry** — final judge retries up to 2 times on empty/error responses
5. **Graceful degradation** — if agents fail, fallback report generated from successful responses
6. **Optional peer-review phase** — a per-run flag (`RunCouncilInput.peerReview`, surfaced as the "Run with Peer Review" button / CLI `--peer-review`) inserts Phase 1.5 between specialists and judge: each specialist evaluates and ranks the other responses, anonymized as "Response A/B/C" to prevent bias, and the rankings are handed to the judge. It is a run-level analysis option, **not** a mode — it works with any mode. When off, the run is the default two-phase flow.
7. **Streaming + cancellation** — `POST /api/council` streams NDJSON progress events; `runCouncil` takes `onProgress` (live per-agent status) and an `AbortSignal` (threaded into provider `fetch`) so a run can be cancelled and actually stops in-flight. Cancellation surfaces as `CouncilAbortedError` (never retried).

## Adding a New Council Mode

1. Add agent templates in `src/agents/defaultAgents.ts`
2. Add mode definition in `src/modes/index.ts` with `buildAgents(...)`
3. Add mode to `CouncilModeId` union in `src/core/types.ts`
4. Add mode to `MODES` array in `src/app/page.tsx` with agents + bestFor
5. Add zod validation in `src/app/api/council/route.ts` mode enum

## Adding a New Agent Template

1. Add entry to `agentTemplates` in `src/agents/defaultAgents.ts`
2. Include `id`, `name`, `role`, `perspective` (system prompt), optional `isFinalJudge`
3. Reference by ID in mode definitions

## Workflow for Agent Changes

When modifying agent behavior:

1. Update the agent template in `src/agents/defaultAgents.ts`
2. Update the prompt builder in `src/prompts/buildPrompts.ts` if needed
3. Run `npm test` to verify no regressions
4. Run `npm run typecheck` to verify types
