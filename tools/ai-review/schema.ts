import { z } from "zod";

/**
 * Structured output contract for the AI code-review agent (10xChampion, M5L2/L3).
 *
 * The agent MUST return exactly this shape. The schema is the mechanical gate:
 * a response that doesn't parse is treated as a failed review, never as "pass".
 * Five scored dimensions (1–10) + a binding verdict + a short Markdown summary,
 * matching the rubric in `criteria.md`.
 */
export const reviewVerdictSchema = z.object({
  /** Does the change do what the diff claims, correctly? */
  implementationCorrectness: z.number().int().min(1).max(10),
  /** Does it match the conventions of this codebase (TS strict, modular core)? */
  idiomaticity: z.number().int().min(1).max(10),
  /** Is it as simple as it can be? Lower score = needless complexity. */
  simplicity: z.number().int().min(1).max(10),
  /** Are the risky paths covered by tests / is a risk addressed? */
  testRiskCoverage: z.number().int().min(1).max(10),
  /** Authz, input validation, secrets, injection, abuse. */
  securitySafety: z.number().int().min(1).max(10),
  /** Binding gate. */
  verdict: z.enum(["pass", "fail"]),
  /** 2–3 sentence actionable summary (Markdown). */
  summary: z.string().min(1),
  /** Optional specific, file-anchored findings. */
  findings: z
    .array(
      z.object({
        severity: z.enum(["blocker", "major", "minor", "nit"]),
        file: z.string().optional(),
        note: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export type ReviewVerdict = z.infer<typeof reviewVerdictSchema>;

/** The five scored dimensions, in display order. */
export const REVIEW_DIMENSIONS = [
  "implementationCorrectness",
  "idiomaticity",
  "simplicity",
  "testRiskCoverage",
  "securitySafety",
] as const;
