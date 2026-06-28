import { test, expect } from "@playwright/test";

/**
 * Golden path E2E for the council flow.
 *
 * Runs under LLM_PROVIDER=mock (set in playwright.config.ts). No external
 * API calls; mock responses are deterministic so this test is hermetic.
 */

test.describe("council golden path (mock provider)", () => {
  test("user submits a question and receives a full report", async ({
    page,
  }) => {
    // A cold Turbopack dev server compiles /api/council on first hit (10-30s)
    // on top of the mock council's per-agent latency — give the run headroom
    // over the 30s default so the first cold test isn't a false fail.
    // (theme-and-pdf.spec.ts and idor.spec.ts bump their timeouts likewise.)
    test.setTimeout(90_000);
    // Arrange
    await page.goto("/");

    const input = page.getByLabel("Your Question, Problem, or Idea");
    const runButton = page.getByRole("button", {
      name: /run council analysis/i,
    });

    await expect(input).toBeVisible();
    // Button starts disabled until the input is non-empty (see test below)
    await expect(runButton).toBeDisabled();

    // Act — fill question, keep default Decision mode, run
    await input.fill(
      "Should we migrate our monolith to microservices in the next quarter?",
    );
    await expect(runButton).toBeEnabled();

    // Sanity check: Decision is the default selected mode (matches buildAgents in src/modes/index.ts)
    await expect(page.getByRole("button", { name: "Decision" })).toHaveClass(
      /ring-blue-500/,
    );

    await runButton.click();

    // Loading state should appear (mock has 300-1000ms per call, multiple stages).
    // "Council in Session" is a <p> status label in the loading panel, not a heading.
    await expect(
      page.getByText(/council in session/i),
    ).toBeVisible({ timeout: 5_000 });

    // Assert — final report renders within a generous window
    // (Decision mode: 4 specialists in parallel + 1 judge, all via mock)
    await expect(
      page.getByRole("heading", { name: /final synthesis report/i }),
    ).toBeVisible({ timeout: 30_000 });

    // Loading state must have disappeared
    await expect(
      page.getByText(/council in session/i),
    ).toBeHidden();

    // The 4 specialist cards must be present (their names from defaultAgents).
    // Scope to the result cards' toggle buttons ("🤖 {name} Confidence: …") —
    // the names also appear in the always-visible #mode-details panel, so a
    // plain getByText would be ambiguous.
    for (const agentName of [
      "Optimist",
      "Sceptic",
      "Risk Analyst",
      "Pragmatist",
    ]) {
      await expect
        .soft(
          page.getByRole("button", {
            name: new RegExp(`${agentName}\\b.*confidence`, "i"),
          }),
        )
        .toBeVisible();
    }

    // The judge mock returns this phrase in §Summary — sourced from
    // composeReportJudge() in src/providers/mockProvider.ts. (Topic-independent
    // substring so it survives the "${topic}" interpolation in that string.)
    await expect.soft(
      page.getByText(/converged on a qualified, balanced position/i),
    ).toBeVisible();

    // Copy button is available and clickable on the result
    const copyButton = page.getByRole("button", { name: /copy report/i });
    await expect(copyButton).toBeVisible();
  });

  test("submit button is disabled when the input is empty", async ({
    page,
  }) => {
    await page.goto("/");

    const runButton = page.getByRole("button", {
      name: /run council analysis/i,
    });

    await expect(runButton).toBeDisabled();
  });

  test("switching modes updates the agents shown in the details panel", async ({
    page,
  }) => {
    await page.goto("/");

    // Decision mode (default) — Pragmatist is in its agent list
    await expect.soft(
      page.locator("#mode-details").getByText("Pragmatist"),
    ).toBeVisible();

    // Switch to Technical mode — Software Architect should now be listed
    await page.getByRole("button", { name: "Technical" }).click();
    await expect.soft(
      page.locator("#mode-details").getByText(/software architect/i),
    ).toBeVisible();

    // Pragmatist should no longer be in the details panel
    await expect.soft(
      page.locator("#mode-details").getByText("Pragmatist"),
    ).toHaveCount(0);
  });
});
