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
