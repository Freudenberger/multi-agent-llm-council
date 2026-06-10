---
name: refresh-test-plan
description: >-
  Refresh docs/test-plan.md when the system's risk surface changes in the
  Multi-Agent LLM Council repo. Use when a new top-level capability ships (new
  council mode, provider, or storage backend), a new piece of user-supplied
  input enters the system (new form field or API endpoint), a previously
  Low/Med risk actually fires, a major dependency jumps a major version, or an
  incident occurs that wasn't on the risk map. Keeps the risk-based test plan
  honest instead of letting it rot.
---

# Refresh the test plan

[docs/test-plan.md](../../../docs/test-plan.md) is a **risk-based** plan, not a
coverage report. Refreshing it means re-deriving the risk map from what the
system now does — not appending "file X has no test". Follow the plan's own
rules (§7 the Oracle Problem, the "Sygnał, nie diagnoza" framing): describe
risks as **user-facing failure scenarios**, rated impact × likelihood.

## When to refresh (the triggers — test-plan §10)

Run this skill when any of these happened:

- A new top-level capability landed: a new **council mode**, **LLM provider**,
  or **storage backend**.
- A new piece of **user-supplied data** entered the system: a new form field,
  request body field, or a new **API endpoint**.
- A risk previously rated **Low/Med actually fired** in production.
- An **incident occurred that wasn't on the map**.
- **Stack churn**: a major dependency (Next.js, NextAuth, Supabase, Zod, React)
  jumped a major version.

If none of these apply, the plan does not need a refresh — say so rather than
editing for the sake of it.

## Procedure

1. **Identify the trigger** and state which §10 bullet it matches. This anchors
   the edit.
2. **Read the current plan** end-to-end so new rows match its structure, rating
   scale (§4.1), and tone. Do not restyle existing rows.
3. **Update the risk map** (§4.2 functional, §4.3 security):
   - Add the new failure scenario as a row. Phrase it as *what the user feels*
     ("User runs the new mode and gets an empty report"), not "modes.ts changed".
   - Rate Impact and Likelihood on the §4.1 scale; derive Priority (P0–P2).
   - Add a **Source signal** column entry (recent churn, don't-touch zone, new
     feature, a fired incident).
   - **New user input is almost always a security row too** — add the matching
     §4.3 entry (e.g. injection via a new field, IDOR on a new endpoint) and a
     code anchor (`file:line`) for any guard that must be locked in by a test.
4. **Update the phases table (§5)** and **status summary (§11)** if the new risk
   warrants a test phase. Mark it 🟡 planned / ⬜ backlog honestly — do not mark
   work done that isn't.
5. **Update the existing-profile table (§3)** only if a new test file actually
   exists now.
6. **Re-check "Risks We Will NOT Cover" (§4.4 / §2.2)** — if the change makes a
   previously-deferred area now worth covering, move it; if a new area is
   explicitly out of scope, record *why* so a future agent doesn't quietly add
   tests there.
7. **For a fired incident or major-version bump**, add a row even if you don't
   yet have the fix — the map should reflect reality, and the phase can be
   backlog.

## Quality bar

- Every new risk row must trace to a defensible source (PRD, incident, a new
  endpoint, a don't-touch zone) — same oracle discipline as the tests (§7).
- Convert any dates to absolute ISO form.
- Verify every `file:line` anchor you cite still points at the right code.
- Do not invent coverage status; "planned" ≠ "done".

## Pairing

A refresh usually follows a feature change. When the trigger was a new mode or
endpoint, the actual test for the new risk is added via **test-feature**, and
the capability is described via **document-feature** — this skill only keeps the
*risk map* current. If a new risk has no owning test yet, leave it 🟡 planned and
say so in your report.
