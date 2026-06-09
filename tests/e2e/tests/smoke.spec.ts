import { test, expect } from "@playwright/test";

test("main page loads and shows hero content", async ({ page }) => {
  await page.goto("/");

  // Assert
  await Promise.all([
    expect.soft(page.getByRole("heading", { name: /multi-agent llm council/i })).toBeVisible(),
    expect.soft(page.getByLabel("Your Question, Problem, or Idea")).toBeVisible(),
    expect.soft(page.getByRole("button", { name: /run council analysis/i })).toBeVisible(),
  ]);
});

test.describe("registration flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
    await expect.soft(page.getByRole("heading", { name: /create an account/i })).toBeVisible();
  });

  test("successful registration redirects to the login page", async ({ page }) => {
    // Arrange
    const uniqueEmail = `e2e-test-${Date.now()}@example.com`;
    const userPassword = "password123";
    const username = "E2E Tester";

    const nameInput = page.getByLabel("Name");
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password", { exact: true });
    const confirmPasswordInput = page.getByLabel("Confirm Password");

    // Act
    await nameInput.fill(username);
    await emailInput.fill(uniqueEmail);
    await passwordInput.fill(userPassword);
    await confirmPasswordInput.fill(userPassword);

    // Assert
    await Promise.all([
      expect.soft(page).toHaveURL(/\/login\?registered=true$/),
      page.getByRole("button", { name: /create account/i }).click(),
    ]);

    await expect.soft(page).toHaveURL(/\/login\?registered=true$/);
  });
});
