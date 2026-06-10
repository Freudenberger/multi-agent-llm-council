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
