---
name: document-feature
description: >-
  Update project documentation whenever a feature is implemented, changed, or
  removed in the Multi-Agent LLM Council repo. Use this AFTER writing or
  modifying code that adds/alters user-facing behavior, a council mode, an
  agent template, an API endpoint, an env var, or an architectural seam — so
  the docs in docs/ and AGENTS.md never drift from the code. Trigger phrases:
  "implement feature", "add mode", "add agent", "change behavior", "update
  docs", or any code change that the feature list, env table, or architecture
  notes should reflect.
---

# Document a feature change

Keep the prose documentation in sync with the code. In this repo the source of
truth is the code; the docs explain *why* and *what the user gets*. After any
feature implementation or behavioral change, update the relevant doc(s) in the
**same change** — never leave docs for "later".

## When this applies

Run this skill when a change touches any of:

- User-facing behavior (UI, council output, export, auth flow)
- A council **mode** (`src/modes/`, `src/agents/defaultAgents.ts`)
- An **agent template** or prompt (`src/agents/`, `src/prompts/`)
- An **API endpoint** (`src/app/api/**`)
- An **environment variable** or config knob
- An **architectural** rule, module responsibility, or don't-touch zone

Pure internal refactors with no observable change need no doc update — say so
explicitly rather than inventing one.

## Where each fact lives

Pick the *narrowest* doc that owns the fact. Do not duplicate the same fact
across files.

| What changed | Update this |
| --- | --- |
| New/changed user-facing feature | [docs/features.md](../../../docs/features.md) — add a numbered entry under **Implemented** in the same voice as existing entries (what the user gets, grouped by API / Frontend / etc.) |
| New env var or default | [AGENTS.md](../../../AGENTS.md) Environment Variables table **and** [CLAUDE.md](../../../CLAUDE.md) if it appears there |
| New mode / agent / module / responsibility | [AGENTS.md](../../../AGENTS.md) Project Structure + Module Responsibilities, and the "Adding a New …" checklists |
| Architectural rule or seam | [docs/architecture.md](../../../docs/architecture.md) |
| Tech/stack rationale | [docs/tech-stack.md](../../../docs/tech-stack.md) |
| Shipped vs. planned / scope | [docs/roadmap.md](../../../docs/roadmap.md) |
| A non-obvious design choice | [docs/decisions.md](../../../docs/decisions.md) — one entry: decision + why + alternatives rejected |
| New risk / new user-supplied input / new endpoint | [docs/test-plan.md](../../../docs/test-plan.md) risk map (see §10 triggers) |

## Procedure

1. **Read before writing.** Open the target doc and match its existing
   structure, heading style, numbering, and table format exactly. Do not
   restyle the file.
2. **Edit the narrowest owner.** Add or amend the single entry that the change
   affects. Update env-var/structure tables in place; do not append duplicates.
3. **Cross-check the "Adding a …" checklists in AGENTS.md.** If a new mode or
   agent was added, confirm every step in that checklist is reflected in code
   *and* docs.
4. **Convert relative dates to absolute** (the repo uses ISO dates).
5. **Verify links.** Any path you reference must exist.
6. **Report** which docs you touched and why, and explicitly note any doc you
   deliberately left unchanged.

## Quality bar

- Document the *behavior and the why*, not a changelog of lines edited.
- No marketing fluff; match the terse, factual tone of `features.md`.
- If you cannot point to the code that backs a doc claim, do not write it.
- After editing, run `npm run lint` only if you touched code; docs alone need
  no gate, but mention if a `.md` lint rule applies (markdownlint is not
  configured here).
