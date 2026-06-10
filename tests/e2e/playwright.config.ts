import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["line"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },

  webServer: {
    // Dedicated E2E port + isolated build dir (NEXT_DIST_DIR) so this server is
    // fully independent of any `npm run dev` you may have running on port 3000.
    // That avoids two problems: (1) reusing a dev server stuck in `openrouter`
    // mode, and (2) Turbopack contending over a shared `.next` folder (which
    // surfaces as a 500 on `/` — and since Playwright only treats HTTP <= 403 as
    // "ready", a 500 makes it poll silently until timeout).
    command: "npm run dev -- -p 3100",
    cwd: "../..",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Surface the server's logs instead of halting without feedback.
    stdout: "pipe",
    stderr: "pipe",
    env: {
      LLM_PROVIDER: "mock",
      LOG_LEVEL: "error",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
