# Features

## Implemented

### 1. Loading State in the UI

While the council is running, a dedicated loading indicator is displayed between the input section and the results area. It includes:

- A spinning border animation for visual feedback
- A "Council in Session" heading with a descriptive subtitle ("Specialist agents are analyzing your input...")
- Animated bouncing dots to indicate ongoing activity
- The submit button also shows a compact spinner and "Analyzing..." text while disabled

This gives users clear visual feedback that their request is being processed, rather than leaving them wondering if the app is responding.

### 2. Better Error Handling and User Feedback

Improved error handling across the API and frontend with structured error responses, categorized error types, and actionable user feedback.

**API layer:**

- Structured JSON error responses with `title`, `message`, `type`, and `retryable` fields
- Proper HTTP status codes per error type (400 validation, 404 not found, 504 timeout, 503 provider unavailable, 500 server error)
- Graceful handling of malformed JSON bodies
- Human-readable validation error summaries from zod schema errors

**Frontend layer:**

- Inline input validation (empty, too short, too long) with amber border + message below the textarea
- Categorized error display with color-coded banners (amber for validation, orange for timeout, red for server errors)
- Retry button shown for retryable errors (timeout, network, server)
- Network detection with specific "Connection error" message
- Input error clears automatically when user starts typing

### 3. Council Mode Details

Each council mode card now includes an expandable details panel that shows agent roles and best-use cases before the user selects a mode.

**Mode cards:**

- Clean card layout with mode name and short description
- Expandable "Show agents & use cases" toggle with rotating arrow indicator
- **Agents section** — lists each agent's name and role in the council
- **Best for** — example questions or scenarios suited to that mode
- Selected mode highlighted with blue border/ring; unselected modes have hover state

### 4. Customizable Council Agents

Users can customize the agents in any council mode before running an analysis. Each agent slot can be edited individually or replaced with a predefined agent from the available templates.

**Agent customizer panel:**

- Expandable panel below the mode selector showing all agents in the current mode
- Each agent displays its name, role, and a "Custom" badge if modified
- **Edit mode** — click "Edit" on any agent to modify its name, role, and system prompt inline
- **Template picker** — "Pick from predefined agents" lets you replace an agent slot with any other predefined agent in one click
- **Per-agent reset** — revert a single agent to its default definition
- **Reset all** — clear all customizations at once
- Customized agent count shown in the panel header
- Custom agent definitions are sent to the API and merged into the council at runtime, overriding only the specified fields while preserving the mode's structure

### 5. Per-Agent Model Selection

Each agent can be assigned a different LLM model from the list of free OpenRouter models.

**Model picker:**
- Fetches free models from OpenRouter API (`GET /api/v1/models`) with 5-minute client-side cache
- Dedicated `/api/models` endpoint with error handling and fallback
- Model dropdown in each agent's edit form showing all available free models
- Purple model badge shown in the agent row when a custom model is assigned
- Falls back to text input if models fail to load
- Per-agent model override: each agent gets its own provider instance with the selected model
- Unspecified agents use the default `openrouter/free` model

### 6. Save, Load, and Export Council Sessions

Logged-in users can save, revisit, and export their council analyses. Unauthenticated users get no persistence — nothing is stored.

**Save:**
- Conversations are automatically saved to storage after each council run (only when authenticated)
- Each conversation stores: user input, selected mode, all agent responses, judge response, final report, and timestamps
- Maximum 3 sessions per user; oldest is automatically deleted when a new one is saved

**Load:**
- History button in the header shows saved sessions count
- Expandable sidebar panel lists all saved sessions with title, mode, and timestamp
- Click to expand and preview input, agents, and summary
- "Load Session" button restores the full conversation into the main view (input, mode, and results)

**Export:**
- JSON export — full structured data including all responses and metadata
- Markdown export — human-readable report with input, all agent responses, and the final synthesis
- Delete button per session with hover-reveal UX

**Storage:**
- Backend-agnostic via `StorageProvider` interface: local JSON files (default) or Supabase PostgreSQL
- Switch via `DB_PROVIDER` environment variable
- All storage operations require authentication; unauthenticated requests are never persisted

### 7. SWOT Council Mode

A strategic-analysis council mode that evaluates a subject across the four classic SWOT quadrants, then synthesizes them into an actionable strategy.

- **Strengths Analyst** — internal strengths and advantages
- **Weaknesses Analyst** — internal weaknesses and limitations
- **Opportunities Analyst** — external opportunities and favorable trends
- **Threats Analyst** — external threats and risks
- **SWOT Strategist** (final judge) — cross-links the quadrants (strengths→opportunities, weaknesses↔threats) into a recommendation, trade-offs, and next steps

Best for evaluating a business, product, project, or plan strategically and mapping competitive position before committing.

### 8. User Preferred Models

Logged-in users can choose, once in Settings, which OpenRouter models their council should use — instead of setting a model per agent in every mode. The selection is an allow-list with no forced default.

**Settings → Preferred Models tab:**
- Multi-select picker over the free OpenRouter model list (with search) backed by `GET /api/models`
- No "default" concept — the order doesn't matter; selecting one model runs everything on it, selecting several spreads agents across them
- Selections persist on the user via `PUT /api/user/settings` (`preferredModels` field) and are returned by `GET /api/user/settings`

**Effect on a council run:**
- The council route loads the signed-in user and passes `preferredModels` into `runCouncil` as `fallbackModels`; `applyFallbackModels` assigns each agent without its own model a model picked **at random** from the list (independently per agent, per run) — explicit per-agent overrides always win
- The Customize Agents per-agent dropdown is restricted to the user's preferred set when non-empty
- Anonymous runs and users with no preferred models are unaffected (fall back to `OPENROUTER_MODEL` / `openrouter/free`)

This lets a user constrain which models run without customizing each agent in each mode: one model to run everything on it, or a curated set to vary across.

### 9. Live Council Status & Cancellation

The council run streams its progress to the UI in real time, and the user can cancel a run while it is in flight.

**Streaming API:**
- `POST /api/council` returns an NDJSON stream (`application/x-ndjson`) instead of a single JSON blob. Each line is one tagged object: `{ kind: "progress", event }`, `{ kind: "result", result }`, or `{ kind: "error", error }`
- `runCouncil` accepts an `onProgress` callback and emits `run_started` (the planned roster), `phase_started` (`specialists` → `judge`), `agent_started`, and `agent_completed` (with `durationMs` and `ok`) events
- The final `result` payload is identical to the previous JSON response; conversations are still auto-saved for authenticated users before the result line is sent

**Live status UI:**
- Replaces the generic spinner with a per-agent panel: each agent shows pending → running → done/failed, grouped into Phase 1 · Specialists and Phase 2 · Synthesis, with elapsed time per finished agent
- A header summary tracks "N/total done" and switches to "Synthesizing…" during the judge phase

**Cancellation:**
- A **Cancel** button aborts the in-flight request via an `AbortController`
- `runCouncil` accepts an `AbortSignal`; the abort is threaded into the provider's `fetch` (combined with the timeout signal), so in-flight model calls are actually stopped — not just abandoned client-side
- The server stops at the next phase boundary and throws `CouncilAbortedError` (never retried, not surfaced as an error); the UI shows a "session cancelled" notice
- Cancellation works in demo mode too (the mock provider's simulated delay is abortable)

Because the run state lives in `CouncilProvider` (feature: state survives navigation), a run keeps streaming and can still be cancelled after navigating to Settings and back.

### 10. Peer Review Analysis (optional three-phase pipeline)

A per-run analysis option that inserts an anonymized peer-review/ranking phase between the specialists and the judge. It is **not** a council mode — it works with whichever mode is selected.

**Pipeline:**
- **Phase 1 — Specialists** (unchanged): the mode's specialists respond in parallel.
- **Phase 1.5 — Peer review & ranking** (new, opt-in): each specialist whose Phase-1 response succeeded re-enters as an impartial reviewer. Every reviewer sees the same set of responses anonymized as "Response A/B/C…" (authorship withheld to prevent bias) and ranks them.
- **Phase 2 — Judge** (unchanged orchestration): the peer evaluations are appended to the judge's prompt so the synthesis can weight the peer-preferred responses while preserving valuable minority points.

**How to trigger it:**
- **Web:** a second **🔍 Run with Peer Review** button next to **Run Council Analysis**.
- **CLI:** `npm run council -- --mode decision --peer-review "…"`.
- **API:** `POST /api/council` with `{ "peerReview": true }` (validated by the request schema).
- **Core:** `runCouncil({ …, peerReview: true })` (`RunCouncilInput.peerReview`).

**Surfacing & safeguards:**
- The result gains an optional `peerReviews: AgentResponse[]` field (omitted entirely for standard runs). The UI renders a "Peer Review & Ranking" section; the CLI prints a "PEER REVIEW & RANKING" block; the raw transcript logs a `peer_reviews_completed` event.
- A new `phase_started` event with `phase: "peer-review"` streams to the UI, which shows a dedicated "Phase 2 · Peer Review" row and renumbers synthesis to "Phase 3 · Synthesis".
- Peer review is skipped (and `peerReviews` stays undefined) when fewer than two specialists succeed — there is nothing to rank.

### 11. Agent Roundtable (hidden live discussion page)

A hidden, unlinked page at `/discuss` where a small panel of agents debate a topic back-and-forth, live — a different orchestration from the council (which answers in parallel then synthesizes). There is no judge; the agents simply converse as peers.

**How it works:**
- The user enters a topic, picks **2–4 agents** (any non-judge persona from the existing templates), and a **round limit (1–6)** — the loop bound that caps how many times each agent speaks.
- Turns run **sequentially in round-robin order**: within each round every agent speaks once, in selection order, seeing the full transcript so far and reacting to it. Total turns = agents × rounds.
- Each completed turn streams to the page as it finishes, so the conversation appears to unfold in real time. A "… is thinking" indicator shows the agent whose turn is in flight.
- **Optional summarizer:** the user can pick a final-judge/synthesizer persona (via `getSummarizerPersonas()`) to distill the whole transcript into one user-facing summary after the rounds finish — or choose "No summary". Surfaced as `RunDiscussionResult.summary` (a `DiscussionSummary`, omitted when none was selected) and `summary_started` / `summary_completed` progress events, rendered in its own panel below the conversation.
- **Degenerate-reply retry:** turns (and the summary) whose model reply is empty, trivially short, or a bare label/classification line (e.g. `User Safety: safe`) are detected by `isDegenerateResponse` and re-generated up to twice with a nudging reminder; a persistently unusable reply is recorded as an `ok: false` placeholder rather than polluting the transcript.

**Touchpoints:**
- **Page:** `src/app/discuss/page.tsx` — self-contained client component, **not linked from any nav** (reachable only by URL).
- **Core:** `runDiscussion(input)` in `src/core/runDiscussion.ts`; types `RunDiscussionInput` / `RunDiscussionResult` / `DiscussionTurn` / `DiscussionProgressEvent` and the bounds `DISCUSSION_MIN/MAX_AGENTS` (2/4) and `DISCUSSION_MIN/MAX_ROUNDS` (1/6) in `src/core/types.ts`.
- **API:** `POST /api/discuss` returns the same NDJSON stream shape as the council (`{ kind: "progress" | "result" | "error" }`); progress events are `discussion_started`, `round_started`, `turn_started`, `turn_completed`. Cancellable via client disconnect (`CouncilAbortedError`).
- **Prompts:** `buildDiscussionSystemPrompt` / `buildDiscussionUserMessage` wrap each persona with conversational rules and feed it the running transcript.
- **Personas:** `getDiscussionPersonas()` in `src/agents/defaultAgents.ts` lists the selectable (non-judge) agents; `resolveAgent(id)` turns a template id into a runnable agent.
- A failed turn records a short placeholder (`ok: false`) and the discussion continues with the remaining agents rather than aborting the whole run.
