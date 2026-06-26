import { OpenRouter } from "@openrouter/sdk";
import * as z from "zod";
import { reviewVerdictSchema, type ReviewVerdict } from "../schema";

/**
 * AI code-review agent — **v2**, built on the official **OpenRouter TypeScript SDK**
 * (`@openrouter/sdk`) via its `callModel` entrypoint.
 *
 *  - This is OpenRouter's general-purpose **API SDK**, NOT the separate
 *    "OpenRouter Agent SDK" (openrouter.ai/docs/agent-sdk) that ships an
 *    agentic tool-loop with a `maxCost` stop primitive. We use `callModel` as a
 *    single-shot **scorer** — one model call, structured output, no tool loop.
 *  - The M5L2 lesson explicitly blesses the single-step scorer as a deliberate
 *    MVP ("diff in → verdict out, zero tools"), so this is a valid, defensible
 *    integration — just don't mislabel it as an agent tool-loop SDK.
 *
 * Why v2 exists (vs the in-house v1 in ../reviewAgent.ts):
 *  - Integrates a *named SDK as an independent package* (`@openrouter/sdk`).
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
5. securitySafety — does the CODE in the diff introduce a concrete vulnerability: missing authorization at the right seam, unvalidated/untrusted input, a leaked secret/credential, or an injection/IDOR/abuse opening?

Scoring rules (read carefully):
- Score ONLY issues evidenced by the code in this diff. Do NOT invent risks or speculate beyond what the diff shows.
- securitySafety defaults to 8-10 when the diff contains no concrete code-level vulnerability. Reserve <=5 for a real, demonstrable vulnerability.
- The choice of LLM model/provider (including free tiers such as "openrouter/free"), CI/tooling/config values, and dependency/version choices are OUT OF SCOPE for securitySafety. Never lower securitySafety or raise a "blocker" because of which model, provider, or free tier is configured — that is not a code vulnerability.
- A "blocker" finding is only for a genuine, code-level security or correctness defect — not for stylistic, tooling, or model-selection opinions.
- findings describe PROBLEMS ONLY. NEVER emit a finding to praise, approve, or merely describe a change. If the code is good, say so in "summary" and emit NO finding for it. "severity" ranks a DEFECT's seriousness; never attach blocker/major/minor/nit to a positive or neutral observation. A security IMPROVEMENT (e.g. adding an ownership/authorization check, validating input) is NOT a finding and NOT a blocker — it RAISES securitySafety, it never lowers it.
- Only emit a finding when the diff itself shows the issue, in the file it shows it. Do NOT attribute a change to a file whose diff does not contain it.
- Some diff entries are NOT application code: documentation (.md), config/permission files (e.g. .claude/settings.local.json), lockfiles, and CI YAML. Their contents are data/permissions, not source — do NOT apply code conventions (Core/UI independence, error taxonomy, "no any") to them or raise code-convention findings about them.

Verdict rule: "fail" if ANY dimension <= 3, OR securitySafety <= 5, OR there is a blocker finding; otherwise "pass".
Return your review using the provided JSON schema.`;

const MAX_OUTPUT_TOKENS = 7000;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 800;
// A reliable structured-output model by default — free tiers (e.g. "openrouter/free")
// stall and truncate JSON, which is fatal for the json_schema contract. Override with
// OPENROUTER_MODEL or --model when needed.
export const DEFAULT_MODEL = "openai/gpt-4o-mini";

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
  /** Total attempts before failing closed (default 3). Retries cover transient
   *  provider errors, truncated JSON, and schema-validation misses. */
  maxAttempts?: number;
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Hard wall-clock deadline around an async op. The SDK's own `timeoutMs` only
 * bounds the HTTP request, not the `getText()` consumption of a streaming
 * OpenResponses result — so a stalled stream can hang forever. This guarantees
 * we stop waiting after `ms` and invokes `onTimeout()` to abort the request.
 */
function withDeadline<T>(
  run: () => Promise<T>,
  ms: number,
  onTimeout: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`timed out after ${ms}ms`));
    }, ms);
    if (typeof timer.unref === "function") timer.unref();
    run().then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Provider errors worth retrying: rate limits, 5xx, and transient/network/timeout
 *  failures (no status code). 4xx like 400/401/403 won't fix on retry. */
function isRetryableProviderError(e: unknown): boolean {
  const status = (e as { statusCode?: number })?.statusCode;
  if (typeof status === "number") return status === 429 || status >= 500;
  return true; // no HTTP status → network/timeout/generic → retry
}

/** Deterministic DoD verdict (same rule as v1) — never trust the model's self-reported verdict. */
export function enforceVerdictRule(v: ReviewVerdict): {
  verdict: ReviewVerdict;
  overridden: boolean;
} {
  const dims = [
    v.implementationCorrectness,
    v.idiomaticity,
    v.simplicity,
    v.testRiskCoverage,
    v.securitySafety,
  ];
  const hasBlocker = (v.findings ?? []).some((f) => f.severity === "blocker");
  const computed: ReviewVerdict["verdict"] =
    dims.some((d) => d <= 3) || v.securitySafety <= 5 || hasBlocker
      ? "fail"
      : "pass";
  return {
    verdict: { ...v, verdict: computed },
    overridden: computed !== v.verdict,
  };
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
      const j = JSON.parse(err.body) as {
        error?: { message?: string } | string;
      };
      detail =
        (typeof j.error === "object" ? j.error?.message : j.error) ?? err.body;
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
    inputTokens:
      u.inputTokens ?? u.input_tokens ?? u.promptTokens ?? u.prompt_tokens,
    outputTokens:
      u.outputTokens ??
      u.output_tokens ??
      u.completionTokens ??
      u.completion_tokens,
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
  const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  let lastReason = "unknown error";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const lastTry = attempt === maxAttempts;
    emit(
      `v2: attempt ${attempt}/${maxAttempts} — callModel (model=${model}, json_schema, timeout ${timeoutMs}ms)…`,
    );

    // 1) Call the provider. Retry transient errors (429/5xx/network/timeout).
    let text: string;
    let usage: ReviewV2Usage | undefined;
    const controller = new AbortController();
    try {
      const out = await withDeadline(
        async () => {
          const result = client.callModel(
            {
              model,
              instructions: SYSTEM_INSTRUCTIONS,
              input: `Review this unified diff:\n\n${diff}`,
              temperature: 0.2,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
              text: {
                format: {
                  type: "json_schema",
                  name: "code_review_verdict",
                  schema: OUTPUT_JSON_SCHEMA,
                  strict: false,
                },
              },
            },
            { timeoutMs, signal: controller.signal },
          );
          const t = await result.getText();
          let u: ReviewV2Usage | undefined;
          try {
            u = extractUsage(await result.getResponse());
          } catch {
            /* usage is best-effort */
          }
          return { t, u };
        },
        timeoutMs,
        () => controller.abort(),
      );
      text = out.t;
      usage = out.u;
    } catch (e) {
      lastReason = describeError(e);
      const retryable = isRetryableProviderError(e);
      emit(
        `v2: attempt ${attempt} provider error — ${lastReason}${retryable && !lastTry ? " (retrying)" : ""}`,
      );
      if (retryable && !lastTry) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      return failClosed(model, lastReason);
    }

    emit(
      `v2: attempt ${attempt} received ${text.length} chars${
        usage
          ? ` (tokens in/out: ${usage.inputTokens ?? "?"}/${usage.outputTokens ?? "?"}${usage.costUsd != null ? `, $${usage.costUsd}` : ""})`
          : ""
      }`,
    );

    // 2) Parse. Truncated/invalid JSON is retryable (next attempt may complete).
    let data: unknown;
    try {
      data = JSON.parse(safeJson(text));
    } catch (e) {
      lastReason = `invalid or truncated JSON (${e instanceof Error ? e.message : String(e)})`;
      emit(
        `v2: attempt ${attempt} ${lastReason}${!lastTry ? " (retrying)" : ""}`,
      );
      if (!lastTry) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      return failClosed(
        model,
        `${lastReason} — try a model with a larger output budget`,
      );
    }

    // 3) Validate against the contract. A schema miss is retryable too.
    const parsed = reviewVerdictSchema.safeParse(data);
    if (!parsed.success) {
      lastReason = `output failed schema validation: ${parsed.error.issues[0]?.message}`;
      emit(
        `v2: attempt ${attempt} ${lastReason}${!lastTry ? " (retrying)" : ""}`,
      );
      if (!lastTry) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      return failClosed(model, lastReason);
    }

    // 4) Success — apply the deterministic DoD gate.
    const { verdict, overridden } = enforceVerdictRule(parsed.data);
    if (overridden)
      emit(`v2: DoD rule overrode model verdict → "${verdict.verdict}"`);
    emit(`v2: verdict=${verdict.verdict} (attempt ${attempt})`);
    return { verdict, degraded: false, model, usage };
  }

  return failClosed(model, lastReason); // exhausted retries
}

/** Native json_schema should yield clean JSON; still strip any stray code fence defensively. */
export function safeJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;
}
