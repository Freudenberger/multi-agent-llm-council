import { OpenRouter } from "@openrouter/sdk";
import * as z from "zod";
import { reviewVerdictSchema, type ReviewVerdict } from "../schema";

/**
 * AI code-review agent — **v2**, built on the official **OpenRouter TypeScript SDK**
 * (`@openrouter/sdk`, the "OpenRouter Agent SDK") via its `callModel` entrypoint.
 *
 * Why v2 exists (vs the in-house v1 in ../reviewAgent.ts):
 *  - Uses a *named SDK as an independent package* (10xDevs M5L2 requirement).
 *  - **Native structured output** via `text.format = json_schema` derived from the
 *    same Zod contract — no prompt-and-parse, no repair hack, no free-model JSON drift.
 *  - Captures **usage/cost metrics** from the SDK response (M5L2 "costs, metrics").
 *
 * v1 is left completely untouched; this is an additive, parallel implementation.
 */

const SYSTEM_INSTRUCTIONS = `You are a senior code reviewer for a Next.js 16 + TypeScript (strict) modular-monolith project.
Review the supplied unified git diff against EXACTLY these five dimensions, each scored 1-10:
1. implementationCorrectness — does it do what the diff claims, with edge/error paths handled?
2. idiomaticity — does it match repo conventions (Core stays UI-independent, errors via the core error taxonomy, no any)?
3. simplicity — smallest change that solves it; penalise needless abstraction, dead branches, magic strings.
4. testRiskCoverage — are new/changed risky paths covered by a test?
5. securitySafety — authz at the right seam, input validated, no secrets, no injection/IDOR/abuse opening.
Verdict rule: "fail" if ANY dimension <= 3, OR securitySafety <= 5, OR there is a blocker finding; otherwise "pass".
Return your review using the provided JSON schema.`;

// Native structured-output schema derived from the SAME Zod contract v1 validates against.
// Strip the `$schema` meta key — providers want a bare JSON Schema object.
const OUTPUT_JSON_SCHEMA: Record<string, unknown> = {
  ...(z.toJSONSchema(reviewVerdictSchema) as Record<string, unknown>),
};
delete OUTPUT_JSON_SCHEMA.$schema;

export type ReviewV2Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
};

export type ReviewV2Result = {
  verdict: ReviewVerdict;
  degraded: boolean;
  model: string;
  usage?: ReviewV2Usage;
};

export type ReviewV2Options = {
  onEvent?: (message: string) => void;
  timeoutMs?: number;
  model?: string;
};

export const DEFAULT_TIMEOUT_MS = 60_000;
// A structured-output-capable default; override via --model / OPENROUTER_MODEL.
export const DEFAULT_MODEL = "openai/gpt-4o-mini";

/** Deterministic DoD verdict (same rule as v1) — never trust the model's self-reported verdict. */
export function enforceVerdictRule(v: ReviewVerdict): { verdict: ReviewVerdict; overridden: boolean } {
  const dims = [
    v.implementationCorrectness,
    v.idiomaticity,
    v.simplicity,
    v.testRiskCoverage,
    v.securitySafety,
  ];
  const hasBlocker = (v.findings ?? []).some((f) => f.severity === "blocker");
  const computed: ReviewVerdict["verdict"] =
    dims.some((d) => d <= 3) || v.securitySafety <= 5 || hasBlocker ? "fail" : "pass";
  return { verdict: { ...v, verdict: computed }, overridden: computed !== v.verdict };
}

function failClosed(model: string, reason: string): ReviewV2Result {
  return {
    degraded: true,
    model,
    verdict: {
      implementationCorrectness: 1,
      idiomaticity: 1,
      simplicity: 1,
      testRiskCoverage: 1,
      securitySafety: 1,
      verdict: "fail",
      summary: `Reviewer (v2/OpenRouter SDK) could not complete: ${reason}. Failing closed — a human must review.`,
      findings: [{ severity: "blocker", note: reason }],
    },
  };
}

/** Surface the real cause of an SDK error — OpenRouterError carries statusCode + raw body. */
export function describeError(e: unknown): string {
  const err = e as { message?: string; statusCode?: number; body?: string };
  const parts: string[] = [err?.message || String(e)];
  if (err?.statusCode) parts.push(`HTTP ${err.statusCode}`);
  if (err?.body) {
    let detail: unknown = err.body;
    try {
      const j = JSON.parse(err.body) as { error?: { message?: string } | string };
      detail = (typeof j.error === "object" ? j.error?.message : j.error) ?? err.body;
    } catch {
      /* body wasn't JSON */
    }
    parts.push(String(detail).slice(0, 300));
  }
  return parts.join(" — ");
}

/** Best-effort usage extraction — the OpenResponses result shape varies by model. */
export function extractUsage(resp: unknown): ReviewV2Usage | undefined {
  const u = (resp as { usage?: Record<string, number> } | undefined)?.usage;
  if (!u) return undefined;
  return {
    inputTokens: u.inputTokens ?? u.input_tokens ?? u.promptTokens ?? u.prompt_tokens,
    outputTokens: u.outputTokens ?? u.output_tokens ?? u.completionTokens ?? u.completion_tokens,
    totalTokens: u.totalTokens ?? u.total_tokens,
    costUsd: u.cost ?? u.totalCost ?? u.total_cost,
  };
}

export async function reviewDiffV2(
  diff: string,
  opts: ReviewV2Options = {},
): Promise<ReviewV2Result> {
  const emit = opts.onEvent ?? (() => {});
  const model = opts.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!diff.trim()) {
    return {
      degraded: false,
      model: "n/a",
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
    // v2 is a real-SDK path; there is no mock. Fail loudly rather than silently degrade.
    throw new Error(
      "v2 reviewer requires OPENROUTER_API_KEY (the OpenRouter SDK has no mock mode). Use v1 (npm run review) for keyless demos.",
    );
  }

  const client = new OpenRouter({ apiKey });
  emit(
    `v2: OpenRouter SDK callModel (model=${model}, native json_schema, timeout ${timeoutMs}ms)…`,
  );

  let text: string;
  let usage: ReviewV2Usage | undefined;
  try {
    const result = client.callModel(
      {
        model,
        instructions: SYSTEM_INSTRUCTIONS,
        input: `Review this unified diff:\n\n${diff}`,
        temperature: 0.2,
        maxOutputTokens: 1500,
        text: {
          format: {
            type: "json_schema",
            name: "code_review_verdict",
            schema: OUTPUT_JSON_SCHEMA,
            strict: false,
          },
        },
      },
      { timeoutMs },
    );
    text = await result.getText();
    try {
      usage = extractUsage(await result.getResponse());
    } catch {
      /* usage is best-effort */
    }
  } catch (e) {
    const msg = describeError(e);
    emit(`v2: provider error — ${msg}`);
    return failClosed(model, msg);
  }

  emit(
    `v2: received ${text.length} chars${
      usage ? ` (tokens in/out: ${usage.inputTokens ?? "?"}/${usage.outputTokens ?? "?"}${usage.costUsd != null ? `, $${usage.costUsd}` : ""})` : ""
    }`,
  );

  const parsed = reviewVerdictSchema.safeParse(JSON.parse(safeJson(text)));
  if (!parsed.success) {
    return failClosed(model, `output failed schema validation: ${parsed.error.issues[0]?.message}`);
  }

  const { verdict, overridden } = enforceVerdictRule(parsed.data);
  if (overridden) emit(`v2: DoD rule overrode model verdict → "${verdict.verdict}"`);
  emit(`v2: verdict=${verdict.verdict}`);
  return { verdict, degraded: false, model, usage };
}

/** Native json_schema should yield clean JSON; still strip any stray code fence defensively. */
export function safeJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;
}
