import { createProvider } from "@/providers";
import { logger } from "@/core/logger";
import { reviewVerdictSchema, type ReviewVerdict } from "./schema";

/**
 * AI code-review agent (10xChampion path, M5L2/M5L3).
 *
 * Takes a unified `git diff`, asks an LLM to score it against the five
 * Definition-of-Done dimensions in `criteria.md`, and returns a Zod-validated
 * {@link ReviewVerdict}. Reuses the project's own provider seam (`createProvider`),
 * so it runs keyless under `LLM_PROVIDER=mock` and against OpenRouter in CI.
 *
 * The schema is the gate: if the model's output can't be parsed into the
 * contract after a retry, the review is reported as a hard `fail` — never
 * silently "pass".
 */

const MAX_ATTEMPTS = 3;
const MAX_TOKENS = 7000; // max tokens for the model's response (prompt is counted separately)
const SENTINEL = "10X-CODE-REVIEW"; // lets the mock provider recognise a review request
export const DEFAULT_TIMEOUT_MS = 30_000;

const JSON_SHAPE = `{
  "implementationCorrectness": <1-10>,
  "idiomaticity": <1-10>,
  "simplicity": <1-10>,
  "testRiskCoverage": <1-10>,
  "securitySafety": <1-10>,
  "verdict": "pass" | "fail",
  "summary": "<2-3 sentence Markdown summary>",
  "findings": [{ "severity": "blocker"|"major"|"minor"|"nit", "file": "<path>", "note": "<text>" }]
}`;

const SYSTEM_PROMPT = `${SENTINEL}
You are a senior code reviewer for a Next.js 16 + TypeScript (strict) modular-monolith project.
Review the supplied unified git diff against EXACTLY these five dimensions, each scored 1-10:

1. implementationCorrectness — does it do what the diff claims, with edge/error paths handled?
2. idiomaticity — does it match repo conventions (Core stays UI-independent, errors via the core error taxonomy, no \`any\`)?
3. simplicity — smallest change that solves it; penalise needless abstraction, dead branches, magic strings.
4. testRiskCoverage — are new/changed risky paths covered by a test?
5. securitySafety — authz at the right seam, input validated, no secrets, no injection/IDOR/abuse opening.

Verdict rule: "fail" if ANY dimension <= 3, OR securitySafety <= 5, OR there is a blocker finding; otherwise "pass".

Respond with ONLY a single JSON object, no prose, no code fences, matching:
${JSON_SHAPE}`;

/** Pull the first balanced top-level JSON object out of an LLM response. */
function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse + validate, returning the reason on failure (for verbose diagnostics). */
function parseVerdict(
  content: string,
): { verdict: ReviewVerdict } | { error: string } {
  const json = extractJson(content);
  if (!json) return { error: "no JSON object found in response" };
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    return {
      error: `JSON.parse failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const result = reviewVerdictSchema.safeParse(obj);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      error: `schema validation: ${first.path.join(".") || "(root)"} — ${first.message}`,
    };
  }
  return { verdict: result.data };
}

export type ReviewResult = {
  verdict: ReviewVerdict;
  /** True when the model output failed to parse and a safe fallback was used. */
  degraded: boolean;
  model: string;
};

/**
 * Enforce the Definition-of-Done verdict rule in code rather than trusting the
 * model's self-reported verdict (weaker models routinely say "pass" while
 * reporting a blocker finding). Recomputes `verdict` from the scores + findings:
 * fail if any dimension <= 3, or securitySafety <= 5, or a blocker finding exists.
 */
function enforceVerdictRule(v: ReviewVerdict): {
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

/** Optional step-level progress events (used by the CLI's --verbose mode). */
export type ReviewOptions = {
  onEvent?: (message: string) => void;
  /** Per-provider-call timeout in ms (the call is aborted past this). Default 60s. */
  timeoutMs?: number;
};

function isTimeoutError(e: unknown): boolean {
  const err = e as { name?: string; message?: string };
  return (
    err?.name === "TimeoutError" ||
    err?.name === "AbortError" ||
    /abort|timed?\s*out|timeout/i.test(err?.message ?? "")
  );
}

/** A hard-fail verdict used when the reviewer can't be trusted (no parseable
 *  output, or the provider errored/timed out). Fails closed — never "pass". */
function failClosed(model: string, reason?: string): ReviewResult {
  const detail = reason
    ? `Reviewer could not complete: ${reason}. Failing closed — a human must review.`
    : "Reviewer returned a response that did not match the required schema. Failing closed — a human must review.";
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
      summary: detail,
      findings: [
        { severity: "blocker", note: reason ?? "Unparseable reviewer output." },
      ],
    },
  };
}

/**
 * Reviews a unified diff and returns a validated verdict. Retries once on a
 * malformed response; if it still can't parse, returns a degraded hard-fail
 * verdict (fail-closed) rather than throwing.
 */
export async function reviewDiff(
  diff: string,
  opts: ReviewOptions = {},
): Promise<ReviewResult> {
  const emit = opts.onEvent ?? (() => {});
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

  const provider = createProvider();
  const userMessage = `Review this unified diff:\n\n${diff}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  emit(
    `prompt prepared (system ${SYSTEM_PROMPT.length} chars, diff ${diff.length} chars, maxTokens ${MAX_TOKENS}, temp 0.2, timeout ${timeoutMs}ms)`,
  );

  /** Call the provider with a hard per-call timeout. Returns content or an error string. */
  async function callProvider(
    systemPrompt: string,
    user: string,
    temperature: number,
    maxTokens: number,
  ): Promise<
    | { content: string; model: string; ms: number }
    | { error: string; ms: number }
  > {
    const t0 = performance.now();
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const r = await provider.generate({
        systemPrompt,
        userMessage: user,
        temperature,
        maxTokens,
        signal,
      });
      return {
        content: r.content,
        model: r.model,
        ms: Math.round(performance.now() - t0),
      };
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      // We own this signal, so `signal.aborted` reliably means our timeout fired.
      const msg =
        signal.aborted || isTimeoutError(e)
          ? `timed out after ${timeoutMs}ms`
          : e instanceof Error
            ? e.message
            : String(e);
      return { error: msg, ms };
    }
  }

  let lastContent = "";
  let lastModel = "unparsed";
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    emit(
      `attempt ${attempt}/${MAX_ATTEMPTS}: calling provider (timeout ${timeoutMs}ms)…`,
    );
    const res = await callProvider(SYSTEM_PROMPT, userMessage, 0.2, MAX_TOKENS);
    if ("error" in res) {
      lastError = res.error;
      emit(
        `attempt ${attempt}: provider error after ${res.ms}ms — ${res.error}${attempt < MAX_ATTEMPTS ? " (retrying)" : ""}`,
      );
      logger.info("AI review: provider call failed", {
        attempt,
        reason: res.error,
      });
      continue;
    }
    const { content, model, ms } = res;
    lastContent = content;
    lastModel = model;
    emit(
      `attempt ${attempt}: received ${content.length} chars from ${model} in ${ms}ms`,
    );
    const parsed = parseVerdict(content);
    if ("verdict" in parsed) {
      const { verdict, overridden } = enforceVerdictRule(parsed.verdict);
      if (overridden)
        emit(
          `attempt ${attempt}: DoD rule overrode model verdict "${parsed.verdict.verdict}" → "${verdict.verdict}"`,
        );
      emit(`attempt ${attempt}: parsed OK → verdict=${verdict.verdict}`);
      return { verdict, degraded: false, model };
    }
    emit(
      `attempt ${attempt}: parse failed — ${parsed.error}${attempt < MAX_ATTEMPTS ? " (retrying)" : ""}`,
    );
    logger.info("AI review: unparseable response", {
      attempt,
      model,
      reason: parsed.error,
    });
  }

  // Repair pass: weaker models often answer in prose. Reformatting an existing
  // review into the schema is a far easier task than producing it, so one more
  // call against the prose usually salvages a usable verdict.
  if (lastContent.trim()) {
    emit(
      "repair: model did not emit JSON — asking it to reformat its review as JSON…",
    );
    const repairSystem = `${SENTINEL}\nYou convert a written code review into a single JSON object. Output ONLY the JSON, no prose, no code fences, matching exactly:\n${JSON_SHAPE}\nIf a score is missing from the review, infer a reasonable 1-10 value; apply the verdict rule (fail if any dimension <= 3, or securitySafety <= 5, or a blocker finding).`;
    const res = await callProvider(
      repairSystem,
      `Convert this code review into the JSON object:\n\n${lastContent}`,
      0,
      1200,
    );
    if ("error" in res) {
      lastError = res.error;
      emit(`repair: provider error after ${res.ms}ms — ${res.error}`);
      logger.info("AI review: repair call failed", { reason: res.error });
      return failClosed(lastModel, lastError);
    }
    const { content, model, ms } = res;
    emit(`repair: received ${content.length} chars from ${model} in ${ms}ms`);
    const parsed = parseVerdict(content);
    if ("verdict" in parsed) {
      const { verdict, overridden } = enforceVerdictRule(parsed.verdict);
      if (overridden)
        emit(
          `repair: DoD rule overrode model verdict "${parsed.verdict.verdict}" → "${verdict.verdict}"`,
        );
      emit(`repair: parsed OK → verdict=${verdict.verdict}`);
      return { verdict, degraded: false, model };
    }
    emit(`repair: parse failed — ${parsed.error}`);
    logger.info("AI review: repair pass failed", {
      model,
      reason: parsed.error,
    });
  }

  // Fail-closed: an unparseable/failed reviewer must not read as approval.
  return failClosed(lastModel, lastError || undefined);
}

export { SENTINEL, SYSTEM_PROMPT };
