# 🏛️ Multi-Agent LLM Council

A deliberation system where multiple AI agents collaborate to answer your questions — each bringing a unique perspective, then synthesizing their insights into a single, balanced response.

![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)

## How It Works

Every council mode runs the same engine. By default it's a **two-phase** flow. Optionally — via the **🔍 Run with Peer Review** button — it adds a middle peer-review/ranking phase, making it **three phases**. Peer review is a per-run analysis option, not a separate mode: it works with whichever mode you pick.

### Standard analysis (two phases)

```
Your Question
    ↓
┌─────────────────────────────────────────┐
│  Phase 1: Specialist Agents Respond     │
│  Each agent provides independent        │
│  analysis from its unique perspective,  │
│  running in parallel                    │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Phase 2: Judge Synthesis               │
│  A judge agent reads the specialists'   │
│  responses (anonymized as Response      │
│  A/B/C to prevent bias) and produces    │
│  the final report                       │
└─────────────────────────────────────────┘
    ↓
Final Report
```

### Peer Review analysis (three phases)

```
Your Question
    ↓
┌─────────────────────────────────────────┐
│  Phase 1: Specialist Agents Respond     │
│  Each agent provides independent        │
│  analysis from its unique perspective,  │
│  running in parallel                    │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Phase 2: Peer Review & Ranking         │
│  Each specialist evaluates and ranks    │
│  the other responses, shown anonymized  │
│  as Response A/B/C to prevent bias      │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Phase 3: Judge Synthesis               │
│  The judge weighs the peer rankings     │
│  while synthesizing the final report    │
└─────────────────────────────────────────┘
    ↓
Final Report
```

## Council Modes

| Mode                  | Best For                             |
| --------------------- | ------------------------------------ |
| **Decision Council**  | Weighing options, making choices     |
| **Idea Council**      | Evaluating ideas and concepts        |
| **Critical Review**   | Reviewing text, arguments, proposals |
| **Learning Council**  | Understanding new concepts           |
| **Technical Council** | Architecture and code decisions      |
| **Answer Council**    | Direct well-reasoned answers         |

## Key Features

- **6 council modes** with purpose-built agent configurations
- **Optional peer review** — a one-click analysis that adds an anonymized peer-review/ranking phase before the judge, available for any mode
- **Customizable agents** — edit names, roles, prompts, or swap in agents from other modes
- **Enable/disable agents** — run with fewer agents for faster results
- **Transparent process** — inspect every specialist's raw response and the judge's synthesis
- **Structured reports** — summary, conclusions, agreements, disagreements, risks, recommendations
- **CLI support** — run councils from the terminal with the same core engine
- **Graceful degradation** — continues working even if some agents fail

## Reviewer Quick Start

Want to evaluate the project in five minutes, without an API key? This path works on a fresh clone:

```bash
git clone https://github.com/Freudenberger/multi-agent-llm-council.git
cd multi-agent-llm-council
npm install
cp .env.example .env.local      # LLM_PROVIDER=mock is the default — no key required
npm run dev                     # open http://localhost:3000
```

In the UI: type a question → pick a mode → click **Run Council Analysis**. The mock provider returns deterministic responses so the full Phase 1 → Phase 2 flow (parallel specialists → judge synthesis) runs end-to-end. No external calls are made.

You can also exercise the same engine from the terminal:

```bash
npm run council -- --mode decision "Should I learn Rust or Go?"
```

To run the test suites:

```bash
npm test                                  # Vitest (unit + integration)
cd tests/e2e && npm install && npx playwright test   # Playwright E2E (one-time install)
```

## Quick Start (with real LLM)

### Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai) API key

### Installation

```bash
git clone https://github.com/Freudenberger/multi-agent-llm-council.git
cd multi-agent-llm-council
npm install
cp .env.example .env.local
# Edit .env.local:
#   LLM_PROVIDER=openrouter
#   OPENROUTER_API_KEY=sk-or-...
```

### Run the Web App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run from CLI

```bash
npm run council -- --mode decision "Should I learn Rust or Go?"
```

### Run Tests

```bash
npm test
```

## Docker

The app ships as a self-contained image built from the multi-stage [Dockerfile](Dockerfile) (Next.js `standalone` output, runs non-root). Run it locally:

```bash
docker build -t llm-council .
docker run --rm -p 3000:3000 \
  -e LLM_PROVIDER=mock \
  -e DB_PROVIDER=local \
  -e AUTH_SECRET=please-change-me \
  llm-council
# health check:
curl http://localhost:3000/api/health   # → {"status":"ok",...}
```

`/api/health` is a dependency-free liveness probe (no DB / LLM / auth) used by the container `HEALTHCHECK` and the CI smoke tests.

Two **manually-triggered** (`workflow_dispatch`) GitHub Actions back the image:

- **[Docker Build & Push](.github/workflows/docker-build.yml)** — builds the image, smoke-tests it (runs the container + curls `/api/health`), and **only pushes to Docker Hub if the test passes**.
- **[Docker Image Smoke Test](.github/workflows/docker-smoke.yml)** — pulls the published image back from Docker Hub, runs it, and curls `/api/health` to verify the artifact that actually shipped.

Required repo secrets (Settings → Secrets and variables → Actions): `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`.

### Versioning & releasing

`package.json` is the single source of truth for the image version. Each build is tagged three ways:

| Tag                       | Meaning                                  |
| ------------------------- | ---------------------------------------- |
| `latest`                  | newest build of the default branch       |
| `<version>` (e.g. `0.1.0`)| the `package.json` version               |
| `sha-<short>`             | the exact commit (always immutable)      |

Releases are driven by **Conventional Commits** via [`commit-and-tag-version`](https://github.com/absolute-version/commit-and-tag-version). The bump level is derived from commit history — no manual choosing:

| Commit type             | Bump  |
| ----------------------- | ----- |
| `fix: …`                | patch |
| `feat: …`               | minor |
| `feat!:` / `BREAKING CHANGE:` | major |

> **One-time:** `feat → minor` only applies once the project is `≥ 1.0.0`. Below that, the preset treats every `feat` as a patch. Bootstrap to a stable major once, then it's fully automatic:
>
> ```bash
> npm run release -- --release-as major   # 0.1.0 → 1.0.0 (do this once, after committing pending work)
> ```

To cut a release after that:

```bash
npm run release            # reads commits, bumps package.json + package-lock, writes CHANGELOG.md, tags v<version>
npm run release:dry        # preview the bump + changelog without writing anything
git push --follow-tags
# then run the "Docker Build & Push" workflow → publishes llm-council:<version> + latest
```

`npm run release` makes the commit + tag for you, so cut a release for each meaningful change — that keeps the `<version>` image tag immutable per release (a manual build without a release overwrites the existing `<version>` tag with current `main`; the `sha-<short>` tag is always unique regardless).

## Architecture

The project is a **modular monolith** — a single deployable Next.js application with clear internal boundaries:

```
src/
├── agents/          # Agent templates and definitions
├── app/             # Next.js web UI (pages, API routes, components)
├── cli/             # Command-line interface
├── core/            # Shared council engine (mode-agnostic)
│   ├── runCouncil.ts   # Orchestrator: phase 1 (specialists) → phase 2 (judge)
│   ├── types.ts        # Core type definitions
│   ├── errors.ts       # Error taxonomy
│   └── logger.ts       # Structured logging
├── modes/           # Council mode configurations
├── prompts/         # Prompt builders for each stage
└── providers/       # LLM provider abstraction (OpenRouter)
```

The **core module** (`src/core/`) contains all deliberation logic and is fully independent from the UI. Both the web app and CLI consume it through the same `runCouncil()` function.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4
- **Language:** TypeScript 5 (strict)
- **Validation:** Zod 4
- **Testing:** Vitest
- **LLM Provider:** OpenRouter (access to 100+ models)

## Project Structure

```
llm-council/
├── council-core/        # Published npm package (core engine)
├── docs/                # Architecture decisions, PRD, feature docs
├── src/
│   ├── agents/          # Agent template definitions
│   ├── app/
│   │   ├── api/council/ # POST /api/council — main API route
│   │   ├── components/  # React components (Markdown, AgentCustomizer)
│   │   └── page.tsx     # Main page
│   ├── cli/             # CLI entry point
│   ├── core/            # Council engine (types, orchestrator, errors)
│   ├── modes/           # Mode definitions (decision, idea, etc.)
│   ├── prompts/         # Specialist + judge prompt builders
│   └── providers/       # OpenRouter provider + mock for tests
└── tests/               # Vitest test suite
```
