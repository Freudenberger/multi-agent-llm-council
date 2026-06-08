# 🏛️ Multi-Agent LLM Council

A deliberation system where multiple AI agents collaborate to answer your questions — each bringing a unique perspective, then synthesizing their insights into a single, balanced response.

![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)

## How It Works

```
Your Question
    ↓
┌─────────────────────────────────────────┐
│  Stage 1: Specialist Agents Respond     │
│  Each agent provides independent        │
│  analysis from its unique perspective   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Stage 2: Peer Review & Ranking         │
│  Agents evaluate each other's responses │
│  (anonymized to prevent bias)           │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Stage 3: Final Synthesis               │
│  A judge agent produces the final answer│
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
- **Customizable agents** — edit names, roles, prompts, or swap in agents from other modes
- **Enable/disable agents** — run with fewer agents for faster results
- **Transparent process** — inspect every agent's raw response and peer evaluation
- **Structured reports** — summary, conclusions, agreements, disagreements, risks, recommendations
- **CLI support** — run councils from the terminal with the same core engine
- **Graceful degradation** — continues working even if some agents fail

## Quick Start

### Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai) API key

### Installation

```bash
git clone https://github.com/your-org/llm-council.git
cd llm-council
npm install
cp .env.example .env.local   # add your OPENROUTER_API_KEY
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

## Architecture

The project is a **modular monolith** — a single deployable Next.js application with clear internal boundaries:

```
src/
├── agents/          # Agent templates and definitions
├── app/             # Next.js web UI (pages, API routes, components)
├── cli/             # Command-line interface
├── core/            # Shared council engine (mode-agnostic)
│   ├── runCouncil.ts   # Orchestrator: stages 1 → 2 → 3
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
│   ├── prompts/         # Stage 1/2/3 prompt builders
│   └── providers/       # OpenRouter provider + mock for tests
└── tests/               # Vitest test suite
```
