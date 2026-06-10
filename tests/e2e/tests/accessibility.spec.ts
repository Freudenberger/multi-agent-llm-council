import { test, expect } from "@playwright/test";

/**
 * Asserts the keyboard/ARIA affordances added to
 * the main page: a skip link, a labelled main landmark, toggle semantics on the
 * mode buttons (aria-pressed) and theme switch (role=switch), and a labelled
 * input. Hermetic — no council run required.
 */

test.describe("accessibility", () => {
  test("exposes a skip link and a labelled main landmark", async ({ page }) => {
    await page.goto("/");

    const skip = page.getByRole("link", { name: /skip to main content/i });
    await expect(skip).toBeAttached();
    await expect(skip).toHaveAttribute("href", "#main-content");

    // The target landmark exists and is a <main>.
    const main = page.locator("main#main-content");
    await expect(main).toBeAttached();
  });

  test("mode buttons expose aria-pressed and update on selection", async ({
    page,
  }) => {
    await page.goto("/");

    const decision = page.getByRole("button", { name: "Decision" });
    const technical = page.getByRole("button", { name: "Technical" });

    // Decision is the default selected mode.
    await expect(decision).toHaveAttribute("aria-pressed", "true");
    await expect(technical).toHaveAttribute("aria-pressed", "false");

    await technical.click();
    await expect(technical).toHaveAttribute("aria-pressed", "true");
    await expect(decision).toHaveAttribute("aria-pressed", "false");
  });

  test("the input is associated with its label", async ({ page }) => {
    await page.goto("/");
    // getByLabel resolves only if the label is correctly associated.
    await expect(
      page.getByLabel("Your Question, Problem, or Idea"),
    ).toBeVisible();
  });

  test("the theme control is an accessible switch", async ({ page }) => {
    await page.goto("/");
    const themeSwitch = page.getByRole("switch", { name: /theme/i });
    await expect(themeSwitch).toBeVisible();
    // aria-checked reflects the active theme (dark by default).
    await expect(themeSwitch).toHaveAttribute("aria-checked", "true");
  });
});
