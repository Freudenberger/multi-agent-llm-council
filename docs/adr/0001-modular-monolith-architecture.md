# ADR-0001: Modular Monolith Architecture

## Status

Accepted

## Date

2026-06-08

## Context

The Multi-Agent LLM Council needs a deployment and code-organization strategy. The system has two client surfaces (web UI and CLI) that must share the same business logic. We need to decide between:

- A separate frontend + backend (microservices-style)
- A single deployable with internal module boundaries (modular monolith)
- A monolith with no internal separation

Forces at play:

- The MVP must be simple to run and deploy
- Core council logic must be reusable by both the web API and the CLI
- We want clear module boundaries for testability and future extraction
- No public SDK is needed in the MVP scope

## Decision

We will implement the project as a **modular monolith** — a single Next.js deployable with internal modules that have separate responsibilities:

- `src/core/` — shared council logic (UI-independent)
- `src/providers/` — LLM provider abstraction
- `src/app/api/` — thin HTTP routes that validate, call core, and return
- `src/app/components/` — React UI
- `src/cli/` — command-line interface calling core directly

Both the web API and the CLI converge on the same Council Core, which talks only to the provider interface.

## Consequences

### Positive

- Single deployable simplifies hosting and CI/CD
- Core logic is written once and reused by both clients
- Clear module boundaries make future extraction possible if needed
- Easy local development — one `npm run dev` starts everything

### Negative

- All modules share the same deployment cycle
- Cannot independently scale API vs. UI
- Next.js coupling means the CLI depends on the same `node_modules`

### Neutral

- No public SDK in MVP; internal API routes serve as the contract

## Alternatives Considered

### Separate frontend + backend services

Would allow independent scaling and deployment, but adds operational complexity (two processes, CORS, shared types package) that isn't justified for the MVP.

### Monolith with no internal separation

Simpler initially, but would make it hard to test core logic independently and would lead to tight coupling between UI and business logic.

## References

- [docs/architecture.md](../architecture.md) — full architecture description
- [docs/PRD-base.md](../PRD-base.md) — product requirements
