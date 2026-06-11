import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "tests/e2e/**", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json", "json-summary", "html", "lcov"],
      // Still emit coverage reports even when some tests fail, so CI can
      // always upload/publish them.
      reportOnFailure: true,
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "tests/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
