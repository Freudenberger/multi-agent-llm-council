import { generateText, tool, stepCountIs, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import * as z from "zod";
import { reviewVerdictSchema, type ReviewVerdict } from "../schema";
import { enforceVerdictRule } from "../v2/reviewAgentV2";

/**
 * AI code-review agent — **v3**, built on the **Vercel AI SDK** (`ai`) with the
 * `@openrouter/ai-sdk-provider`.
 *
 * The difference from v2 (single `callModel` scorer): v3 is a real **agentic
 * tool loop**. The model is given a `read_repo_file` tool and may take several
 * steps — pull the surrounding source for a changed function, confirm a guard
 * actually exists, check a sibling test — *before* committing to a verdict. The
 * SDK runs the tool-call loop (`stopWhen: stepCountIs`) and returns a final
 * structured object (`Output.object` from the same Zod contract).
 *
 * This closes the "it's not an agent, just a scorer" critique against v2 while
 * keeping the same deterministic DoD gate and fail-closed behaviour.
 */

const SYSTEM_INSTRUCTIONS = `You are a senior code reviewer for a Next.js 16 + TypeScript (strict) modular-monolith project.
You are reviewing a unified git diff. You MAY call read_repo_file to pull surrounding
context (the rest of a changed function, a guard you want to confirm, a sibling test)
before you score — use it when the diff alone is not enough to judge a finding, but do
not wander: a handful of targeted reads is plenty.

Score these five dimensions, each 1-10:
1. implementationCorrectness — does it do what the diff claims, with edge/error paths handled?
2. idiomaticity — does it match repo conventions (Core stays UI-independent, errors via the core error taxonomy, no any)?
3. simplicity — smallest change that solves it; penalise needless abstraction, dead branches, magic strings.
4. testRiskCoverage — are new/changed risky paths covered by a test?
5. securitySafety — does the CODE in the diff introduce a concrete vulnerability: missing authorization at the right seam, unvalidated/untrusted input, a leaked secret/credential, or an injection/IDOR/abuse opening?

Scoring rules (read carefully):
- Score ONLY issues evidenced by the code in this diff (context reads inform judgement but do not become new findings about untouched code). Do NOT invent risks.
- securitySafety defaults to 8-10 when the diff contains no concrete code-level vulnerability. Reserve <=5 for a real, demonstrable vulnerability.
- The choice of LLM model/provider (including free tiers), CI/tooling/config values, and dependency/version choices are OUT OF SCOPE for securitySafety.
- A "blocker" finding is only for a genuine, code-level security or correctness defect — not stylistic, tooling, or model-selection opinions.
- findings describe PROBLEMS ONLY. NEVER emit a finding to praise, approve, or describe a change. If the code is good, say so in "summary" and emit NO finding. "severity" ranks a DEFECT's seriousness; never attach any severity to a positive/neutral note. A security IMPROVEMENT (adding an authorization/ownership check, validating input) is NOT a finding and NOT a blocker — it RAISES securitySafety.
- Only emit a finding when the diff itself shows the issue, in the file it shows it (context reads inform judgement but do not become findings about untouched code).
- Documentation (.md), config/permission files, lockfiles, and CI YAML are data/permissions, not source — do NOT apply code conventions to them.

Verdict rule: "fail" if ANY dimension <= 3, OR securitySafety <= 5, OR there is a blocker finding; otherwise "pass".`;

const MAX_OUTPUT_TOKENS = 7000;
const MAX_STEPS = 6; // diff read + up to ~5 tool-assisted reasoning steps
const MAX_FILE_BYTES = 60_000; // cap a single context read so a huge file can't blow the budget
export const DEFAULT_TIMEOUT_MS = 60_000; // tool loops take longer than a single call
export const DEFAULT_MODEL = "openrouter/free";

export type ReviewV3Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
};

export type ReviewV3Result = {
  verdict: ReviewVerdict;
  degraded: boolean;
  model: string;
  usage?: ReviewV3Usage;
  /** Repo files the agent chose to read for context (evidence of the tool loop). */
  filesRead: string[];
  /** Number of model steps the SDK ran (1 = no tool use). */
  steps: number;
};

export type ReviewV3Options = {
  onEvent?: (message: string) => void;
  timeoutMs?: number;
  model?: string;
};

/**
 * Resolve a model-supplied relative path against the repo root, returning the
 * absolute path only if it stays inside the root. Returns null on traversal
 * (`../`, absolute paths, symlink-style escapes) — the LLM controls this input,
 * so it is a trust boundary and must be validated.
 */
export function resolveRepoPath(root: string, rel: string): string | null {
  const abs = resolve(root, rel);
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  return abs === root || abs.startsWith(rootWithSep) ? abs : null;
}

function failClosed(model: string, reason: string): ReviewV3Result {
  return {
    degraded: true,
    model,
    filesRead: [],
    steps: 0,
    verdict: {
      implementationCorrectness: 1,
      idiomaticity: 1,
      simplicity: 1,
      testRiskCoverage: 1,
      securitySafety: 1,
      verdict: "fail",
      summary: `Reviewer (v3/Vercel AI SDK) could not complete: ${reason}. Failing closed — a human must review.`,
      findings: [{ severity: "blocker", note: reason }],
    },
  };
}

export async function reviewDiffV3(
  diff: string,
  opts: ReviewV3Options = {},
): Promise<ReviewV3Result> {
  const emit = opts.onEvent ?? (() => {});
  const model = opts.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!diff.trim()) {
    return {
      degraded: false,
      model: "n/a",
      filesRead: [],
      steps: 0,
      verdict: {
        implementationCorrectness: 5,
        idiomaticity: 5,
        simplicity: 5,
        testRiskCoverage: 5,
        securitySafety: 5,
        verdict: "pass",
        summary: "Empty diff — nothing to review.",
        findings: [],
      },
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "v3 reviewer requires OPENROUTER_API_KEY (real SDK, no mock mode). Use v1 (npm run review) for keyless demos.",
    );
  }

  const root = process.cwd();
  const filesRead: string[] = [];

  const readRepoFile = tool({
    description:
      "Read a UTF-8 text file from the repository to get context the diff omits. Path is relative to the repo root; traversal outside the repo is rejected.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Repo-relative file path, e.g. src/core/runCouncil.ts"),
    }),
    execute: async ({ path }: { path: string }) => {
      const abs = resolveRepoPath(root, path);
      if (!abs) return `Refused: "${path}" is outside the repository.`;
      try {
        const content = readFileSync(abs, "utf8");
        filesRead.push(path);
        emit(`v3: read ${path} (${content.length} chars)`);
        return content.length > MAX_FILE_BYTES
          ? content.slice(0, MAX_FILE_BYTES) + "\n…(truncated)"
          : content;
      } catch {
        return `Could not read "${path}" (missing or not a text file).`;
      }
    },
  });

  const openrouter = createOpenRouter({ apiKey });

  try {
    const result = await generateText({
      model: openrouter.chat(model),
      system: SYSTEM_INSTRUCTIONS,
      prompt: `Review this unified diff. Read context files only as needed, then return the structured verdict:\n\n${diff}`,
      tools: { read_repo_file: readRepoFile },
      stopWhen: stepCountIs(MAX_STEPS),
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(timeoutMs),
      output: Output.object({ schema: reviewVerdictSchema }),
    });

    const parsed = reviewVerdictSchema.safeParse(result.output);
    if (!parsed.success) {
      return failClosed(
        model,
        `output failed schema validation: ${parsed.error.issues[0]?.message}`,
      );
    }

    const usage: ReviewV3Usage = {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: result.usage?.totalTokens,
      costUsd: extractCost(result.providerMetadata),
    };

    const { verdict, overridden } = enforceVerdictRule(parsed.data);
    if (overridden)
      emit(`v3: DoD rule overrode model verdict → "${verdict.verdict}"`);
    emit(
      `v3: verdict=${verdict.verdict} after ${result.steps.length} step(s), ${filesRead.length} file(s) read`,
    );
    return {
      verdict,
      degraded: false,
      model,
      usage,
      filesRead,
      steps: result.steps.length,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    emit(`v3: failed — ${reason}`);
    return failClosed(model, reason);
  }
}

/** OpenRouter reports spend under providerMetadata.openrouter.usage.cost (best-effort). */
export function extractCost(meta: unknown): number | undefined {
  const cost = (
    meta as
      | { openrouter?: { usage?: { cost?: number } } }
      | undefined
  )?.openrouter?.usage?.cost;
  return typeof cost === "number" ? cost : undefined;
}
