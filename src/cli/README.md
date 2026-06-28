# Council CLI

A command-line interface to the Multi-Agent LLM Council. It runs the **same**
[Council Core](../core/runCouncil.ts) as the web app — no separate logic — so a
CLI run and a web run produce identical results for the same input.

## Quick start

```bash
# Demo mode — no API keys needed, uses the mock provider end-to-end
LLM_PROVIDER=mock npm run council -- "Should we migrate to a monorepo?"

# Real run (requires OPENROUTER_API_KEY in your env / .env.local)
npm run council -- --mode technical "Is event sourcing worth it for our app?"
```

> Everything after `--` is passed to the CLI. `npm run council` alone prints usage.

## Usage

```
npm run council -- "Your question or topic"
npm run council -- --mode <mode> "Your question or topic"
npm run council -- --list-modes
npm run council -- --help
```

## Options

| Option                | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `--mode <mode>`       | Council mode to run (default: `decision`). See modes below.             |
| `--peer-review`       | Add an anonymized peer-review/ranking phase before the final judge.     |
| `--input-file <path>` | Read the question/topic from a file (for prompts too large for an arg). |
| `--json`              | Output the full result object as JSON instead of a formatted report.    |
| `--list-modes`        | List all available council modes and their agents, then exit.           |
| `--help`              | Show usage and exit.                                                    |

If both a positional argument and `--input-file` are given, whichever appears
last on the command line wins. If neither yields text, the CLI exits with an
error.

## Modes

| Mode             | What it does                                               |
| ---------------- | ---------------------------------------------------------- |
| `decision`       | Analyze a decision from multiple perspectives.             |
| `idea`           | Evaluate an idea's potential and feasibility.              |
| `criticalReview` | Review text, arguments, or proposals.                      |
| `learning`       | Get educational explanations.                              |
| `technical`      | Evaluate technical topics and architecture.                |
| `answer`         | Answer a question by combining multiple perspectives.      |
| `swot`           | Strengths / weaknesses / opportunities / threats analysis. |

The live mode list is generated from the [mode registry](../modes/index.ts),
so it never drifts. From this repo, run:

```bash
npm run council -- --list-modes
```

## Examples

```bash
# Default decision council
npm run council -- "Should we hire a contractor or build in-house?"

# Idea evaluation with peer review, as JSON (pipe into jq, save, etc.)
npm run council -- --mode idea --peer-review --json "A subscription box for houseplants" > result.json

# Long prompt from a file
npm run council -- --mode criticalReview --input-file ./draft.md
```

## Output

By default the CLI prints a formatted report: the question, each agent's
response, an optional peer-review section, the final synthesis (summary, key
conclusions, agreements, disagreements, risks, recommendations), and a
confidence score out of 5. With `--json` you get the raw
[`CouncilResult`](../core/types.ts) for scripting.

## Configuration

On startup the CLI loads `.env.local` then `.env` (the same files Next.js loads
for the web app), so a key configured there works for the CLI too. Real
environment variables always win over `.env` files, and `.env.local` wins over
`.env`. It reads the same vars as the rest of the app (see
[docs/tech-stack.md](../../docs/tech-stack.md)). The most relevant:

- `LLM_PROVIDER` — `mock` for offline/demo runs, `openrouter` for real models.
- `OPENROUTER_API_KEY` — required when `LLM_PROVIDER=openrouter`.

## Tests

CLI behavior is covered in [tests/cli/cli.test.ts](../../tests/cli/cli.test.ts)
(argument parsing, env loading, and report formatting against a real mock-provider run):

```bash
npx vitest run tests/cli
```
