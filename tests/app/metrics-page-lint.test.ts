import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";

describe("src/app/metrics/page.tsx", () => {
  it(
    "avoids the set-state-in-effect lint violation on mount refresh",
    async () => {
      const eslint = new ESLint({ cwd: process.cwd() });
      const [result] = await eslint.lintFiles(["src/app/metrics/page.tsx"]);

      const violations = result.messages.filter(
        (message) =>
          message.fatal || message.ruleId === "react-hooks/set-state-in-effect",
      );

      expect(violations).toHaveLength(0);
    },
    30000,
  );
});