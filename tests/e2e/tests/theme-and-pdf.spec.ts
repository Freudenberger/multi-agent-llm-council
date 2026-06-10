import { test, expect } from "@playwright/test";

/**
 *
 * Runs under LLM_PROVIDER=mock.
 */

test.describe("theme toggle (SR-14)", () => {
  test("defaults to dark, toggles to light, and persists across reloads", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const themeSwitch = page.getByRole("switch", { name: /theme/i });
    const input = page.getByLabel("Your Question, Problem, or Idea");

    // Default theme is dark (no stored preference).
    await expect(html).toHaveClass(/dark/);
    await expect(themeSwitch).toHaveAttribute("aria-checked", "true");

    // Capture an actual surface colour while dark — the toggle must change it,
    // not just flip the class. (Guards against the `dark:` variant compiling
    // against prefers-color-scheme instead of the `.dark` class.)
    const darkBg = await input.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );

    // Toggle to light.
    await themeSwitch.click();
    await expect(html).not.toHaveClass(/dark/);
    await expect(themeSwitch).toHaveAttribute("aria-checked", "false");
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");

    // The surface colour must actually have changed (dark zinc → light white).
    const lightBg = await input.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(lightBg).not.toBe(darkBg);
    expect(lightBg).toBe("rgb(255, 255, 255)");

    // Persisted: a fresh load stays light with no flash back to dark.
    await page.reload();
    await expect(html).not.toHaveClass(/dark/);
    await expect(page.getByRole("switch", { name: /theme/i })).toHaveAttribute("aria-checked", "false");

    // Toggle back to dark and confirm persistence again.
    await page.getByRole("switch", { name: /theme/i }).click();
    await expect(html).toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
  });
});

test.describe("PDF export (SR-13)", () => {
  test("offers an Export PDF action on the report that triggers printing", async ({ page }) => {
    // Runs a full council (mock) before the report appears — allow headroom
    // over the 30s default under parallel load.
    test.setTimeout(60_000);
    // Stub window.print before any script runs so we can observe the call
    // without opening a real (blocking) print dialog.
    await page.addInitScript(() => {
      // @ts-expect-error test-only counter
      window.__printCalls = 0;
      window.print = () => {
        // @ts-expect-error test-only counter
        window.__printCalls += 1;
      };
    });

    await page.goto("/");
    await page.getByLabel("Your Question, Problem, or Idea").fill("Should we adopt a four-day work week?");
    await page.getByRole("button", { name: /run council analysis/i }).click();

    await expect(page.getByRole("heading", { name: /final synthesis report/i })).toBeVisible({ timeout: 30_000 });

    const exportBtn = page.getByRole("button", { name: /export pdf/i });
    await expect(exportBtn).toBeVisible();

    await exportBtn.click();
    const calls = await page.evaluate(
      // @ts-expect-error test-only counter
      () => window.__printCalls as number
    );
    expect(calls).toBe(1);
  });
});
