import { beforeEach, describe, expect, it, vi } from "vitest";
import { reviewDiff } from "../../tools/ai-review/reviewAgent";

/**
 * v1 reviewer — exercised end-to-end through the mock provider (no API key).
 * This covers the full path: prompt → mock verdict → JSON parse → Zod validation
 * → deterministic DoD enforcement → fail-closed, without a network call.
 */
describe("ai-review v1 — reviewDiff (mock provider)", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    vi.stubEnv("LOG_LEVEL", "error");
  });

  it("fails a diff that introduces an unsafe string-built query", async () => {
    const diff = [
      "diff --git a/src/api.ts b/src/api.ts",
      "--- a/src/api.ts",
      "+++ b/src/api.ts",
      "@@ -1,1 +1,3 @@",
      "+const q = req.query.q;",
      "+const sql = `select * from t where name like '%${q}%'`;",
      "+await db.raw(sql);",
    ].join("\n");

    const { verdict, degraded } = await reviewDiff(diff);

    expect(degraded).toBe(false);
    expect(verdict.verdict).toBe("fail");
    expect(verdict.securitySafety).toBeLessThanOrEqual(5);
    expect(verdict.findings.length).toBeGreaterThan(0);
  });

  it("passes a clean change that ships with a test", async () => {
    const diff = [
      "diff --git a/src/util.ts b/src/util.ts",
      "+export const add = (a: number, b: number) => a + b;",
      "diff --git a/tests/util.test.ts b/tests/util.test.ts",
      "+it('adds', () => expect(add(1,2)).toBe(3));",
    ].join("\n");

    const { verdict } = await reviewDiff(diff);

    expect(verdict.verdict).toBe("pass");
    expect(verdict.securitySafety).toBeGreaterThan(5);
  });

  it("treats an empty diff as a no-op pass", async () => {
    const { verdict } = await reviewDiff("   \n  ");
    expect(verdict.verdict).toBe("pass");
    expect(verdict.summary).toMatch(/empty diff/i);
  });

  it("returns a verdict whose every dimension is within 1..10", async () => {
    const { verdict } = await reviewDiff("diff --git a/x b/x\n+const a = 1;\n");
    for (const dim of [
      verdict.implementationCorrectness,
      verdict.idiomaticity,
      verdict.simplicity,
      verdict.testRiskCoverage,
      verdict.securitySafety,
    ]) {
      expect(dim).toBeGreaterThanOrEqual(1);
      expect(dim).toBeLessThanOrEqual(10);
    }
  });
});
