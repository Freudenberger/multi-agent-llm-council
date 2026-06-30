import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // set-state-in-effect caused a real bug in src/app/metrics/page.tsx (mount
  // refresh). Promote to error so CI's lint job gates it repo-wide — replaces a
  // flaky vitest test that re-ran ESLint in-process. ponytail: one rule > one-file test.
  {
    rules: {
      "react-hooks/set-state-in-effect": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Custom ignores:
    "dist/**",
    "coverage/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
