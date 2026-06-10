import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "tests/e2e/**", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
