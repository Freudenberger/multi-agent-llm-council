import { test, expect } from "@playwright/test";

test.describe("Home page SSR and hydration", () => {
  test("server renders stable signed-out navigation", async ({ request }) => {
    const response = await request.get("/");

    await test.step("fetch the prerendered home page HTML", async () => {
      expect(response.ok()).toBeTruthy();
    });

    const html = await response.text();

    await test.step("assert SSR includes real auth links instead of a loading shim", async () => {
      expect(html).toContain(">Sign in<");
      expect(html).toContain(">Register<");
      expect(html).not.toContain("animate-pulse");
    });
  });

  test("page loads without hydration mismatch warnings", async ({ page }) => {
    const consoleMessages: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        consoleMessages.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(String(error));
    });

    await test.step("open the home page", async () => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /multi-agent llm council/i })).toBeVisible();
      await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    });

    await test.step("assert hydration completed cleanly", async () => {
      const hydrationMessages = consoleMessages.filter((message) =>
        /hydration|didn't match|hydrated but some attributes|server rendered html/i.test(message)
      );

      expect(hydrationMessages).toEqual([]);
    });
  });
});
