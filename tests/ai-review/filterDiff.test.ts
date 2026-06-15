import { describe, expect, it } from "vitest";
import { filterDiff } from "../../tools/ai-review/v2/filterDiff";

function section(path: string): string {
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n+change\n`;
}

describe("ai-review v2 — filterDiff (drop non-code from the review input)", () => {
  it("keeps source files and drops non-code categories", () => {
    const diff = [
      section("src/core/runCouncil.ts"),
      section(".claude/settings.local.json"),
      section("package-lock.json"),
      section("docs/CERTIFICATION-REPORT.md"),
      section(".github/workflows/ai-review-v2.yml"),
      section("coverage/lcov.info"),
      section("app/page.min.js"),
      section(".env.local"),
    ].join("");

    const { filtered, dropped } = filterDiff(diff);

    expect(filtered).toContain("src/core/runCouncil.ts");
    expect(dropped).toEqual(
      expect.arrayContaining([
        ".claude/settings.local.json",
        "package-lock.json",
        "docs/CERTIFICATION-REPORT.md",
        ".github/workflows/ai-review-v2.yml",
        "coverage/lcov.info",
        "app/page.min.js",
        ".env.local",
      ]),
    );
    // Nothing dropped should remain in the filtered output.
    for (const p of dropped) expect(filtered).not.toContain(`b/${p}`);
  });

  it("returns the diff unchanged when there are no git headers", () => {
    const plain = "just some text, not a diff";
    expect(filterDiff(plain)).toEqual({ filtered: plain, dropped: [] });
  });

  it("keeps everything when all files are code", () => {
    const diff = section("src/a.ts") + section("tools/x.tsx");
    const { filtered, dropped } = filterDiff(diff);
    expect(dropped).toEqual([]);
    expect(filtered).toBe(diff);
  });

  it("drops a whole-diff of only non-code to empty (→ reviewer treats as no-op)", () => {
    const diff = section("README.md") + section("yarn.lock");
    const { filtered, dropped } = filterDiff(diff);
    expect(dropped).toHaveLength(2);
    expect(filtered.trim()).toBe("");
  });
});
