import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeError,
  enforceVerdictRule,
  extractUsage,
  reviewDiffV2,
  safeJson,
} from "../../tools/ai-review/v2/reviewAgentV2";
import type { ReviewVerdict } from "../../tools/ai-review/schema";

const base: ReviewVerdict = {
  implementationCorrectness: 8,
  idiomaticity: 8,
  simplicity: 8,
  testRiskCoverage: 8,
  securitySafety: 8,
  verdict: "pass",
  summary: "ok",
  findings: [],
};

describe("ai-review v2 — enforceVerdictRule (deterministic DoD gate)", () => {
  it("keeps pass when every dimension is healthy", () => {
    const { verdict, overridden } = enforceVerdictRule(base);
    expect(verdict.verdict).toBe("pass");
    expect(overridden).toBe(false);
  });

  it("overrides a model 'pass' to 'fail' when securitySafety <= 5", () => {
    const { verdict, overridden } = enforceVerdictRule({ ...base, securitySafety: 5 });
    expect(verdict.verdict).toBe("fail");
    expect(overridden).toBe(true);
  });

  it("overrides to fail when any dimension <= 3", () => {
    expect(enforceVerdictRule({ ...base, testRiskCoverage: 3 }).verdict.verdict).toBe("fail");
  });

  it("overrides to fail when a blocker finding exists", () => {
    const { verdict } = enforceVerdictRule({
      ...base,
      findings: [{ severity: "blocker", note: "x" }],
    });
    expect(verdict.verdict).toBe("fail");
  });
});

describe("ai-review v2 — describeError (surface the real cause)", () => {
  it("includes HTTP status and the parsed provider message", () => {
    const msg = describeError({
      message: "Provider returned error",
      statusCode: 429,
      body: JSON.stringify({ error: { message: "rate limited" } }),
    });
    expect(msg).toContain("HTTP 429");
    expect(msg).toContain("rate limited");
  });

  it("falls back to the raw body when it is not JSON", () => {
    const msg = describeError({ message: "bad", statusCode: 400, body: "boom" });
    expect(msg).toContain("HTTP 400");
    expect(msg).toContain("boom");
  });

  it("handles plain Error objects", () => {
    expect(describeError(new Error("network down"))).toContain("network down");
  });
});

describe("ai-review v2 — safeJson", () => {
  it("returns bare JSON unchanged", () => {
    expect(safeJson('{"a":1}')).toBe('{"a":1}');
  });
  it("strips a ```json code fence", () => {
    expect(JSON.parse(safeJson('```json\n{"a":1}\n```'))).toEqual({ a: 1 });
  });
  it("extracts the object out of surrounding prose", () => {
    expect(JSON.parse(safeJson('Here:\n{"a":1}\nThanks'))).toEqual({ a: 1 });
  });
});

describe("ai-review v2 — extractUsage", () => {
  it("maps snake_case and camelCase token fields", () => {
    expect(extractUsage({ usage: { input_tokens: 10, output_tokens: 20, cost: 0.01 } })).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: undefined,
      costUsd: 0.01,
    });
  });
  it("returns undefined when there is no usage", () => {
    expect(extractUsage({})).toBeUndefined();
  });
});

describe("ai-review v2 — reviewDiffV2 edge paths (no network)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns a no-op pass for an empty diff (before any API call)", async () => {
    const { verdict, degraded } = await reviewDiffV2("   ");
    expect(verdict.verdict).toBe("pass");
    expect(degraded).toBe(false);
  });

  it("throws a clear error when OPENROUTER_API_KEY is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(reviewDiffV2("diff --git a/x b/x\n+const a = 1;\n")).rejects.toThrow(
      /OPENROUTER_API_KEY/,
    );
  });
});
