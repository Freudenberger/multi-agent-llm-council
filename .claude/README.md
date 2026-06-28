# Shared AI Registry

> 10xDevs **M5L4** — the team-distributable AI configuration for this repo. Everything an
> agent (Claude Code, Cursor, or a CI reviewer) needs to work here the way the team works,
> versioned in-repo so it ships with a `git clone` instead of living in someone's head.

This directory **is** the registry. Clone the repo and your agent inherits the rules, skills,
and review pipeline below — no separate install, no copy-paste between machines.

## What's registered

### Rules (always-on context)

| Artifact | Scope | Purpose |
| -------- | ----- | ------- |
| [`AGENTS.md`](../AGENTS.md) | repo root | Full house rules — module map, conventions, don't-touch zones, how to add modes/agents. The single source of truth. |
| [`CLAUDE.md`](../CLAUDE.md) | repo root | Canonical-filename pointer so Claude Code finds the rules; defers to `AGENTS.md` verbatim. |

### Skills (invokable capabilities)

Each skill is a versioned, repo-specific procedure. Invoke with `/<name>` in Claude Code.

| Skill | When it fires | Why it exists |
| ----- | ------------- | ------------- |
| [`add-council-mode`](skills/add-council-mode/SKILL.md) | Adding/renaming/removing a deliberation mode | A mode spans **five** files that must stay in sync; the skill walks every touchpoint so a mode is never half-added (works in the API but missing from the UI). |
| [`document-feature`](skills/document-feature/SKILL.md) | After any user-facing code change | Keeps `docs/` + `AGENTS.md` from drifting away from the code. |
| [`test-feature`](skills/test-feature/SKILL.md) | As part of any feature/bugfix | Enforces "at least one test + green suite + typecheck/lint" before done. |
| [`refresh-test-plan`](skills/refresh-test-plan/SKILL.md) | When the risk surface changes | Keeps `docs/test-plan.md` honest instead of letting it rot. |
| [`mvp-check`](skills/mvp-check/mvp-check.md) | 10xDevs MVP analysis pass | Scores the project against certification criteria. |

### CI-side agents (run remotely, on every PR)

| Agent | Trigger | Output |
| ----- | ------- | ------ |
| [AI Code Review v2](../.github/workflows/ai-review-v2.yml) | every PR | Schema-validated verdict comment + JUnit check run (see [`tools/ai-review`](../tools/ai-review/README.md)) |
| [Review eval gate](../.github/workflows/review-eval.yml) | PRs touching `tools/ai-review/**` | Regression-guards the reviewer's own prompt/schema |

## How a teammate adopts it

1. `git clone` the repo — the rules and skills come with it.
2. Open in Claude Code (or any agent that reads `AGENTS.md`/`CLAUDE.md`). House rules load automatically.
3. Type `/` to list the skills above; invoke the one that matches the task.
4. Open a PR — the CI review agent comments automatically (keyless mock fallback if no `OPENROUTER_API_KEY`).

## How to extend the registry

- **New rule** → edit [`AGENTS.md`](../AGENTS.md) (the one source; `CLAUDE.md` just points at it).
- **New skill** → add `skills/<name>/SKILL.md` with `name` + `description` frontmatter, then list it in the table above.
- **New CI agent** → add a workflow under [`.github/workflows/`](../.github/workflows/) and register it in the CI-side table.

Keeping this README's tables current **is** the distribution mechanism — the registry is only
shared if it's discoverable.
