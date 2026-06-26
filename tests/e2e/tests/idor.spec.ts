import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * Locks in the ownership guard in src/app/api/conversations/[id]/route.ts —
 * user A must not be able to read user B's saved conversation, and B's
 * conversation must not appear in A's own list. Ownership now lives in the
 * storage contract (StorageProvider.getOwned), which collapses not-found and
 * not-owned into a single 404 so a stranger can't even confirm the id exists.
 * Runs under LLM_PROVIDER=mock so the council run is hermetic.
 */

const PASSWORD = "password123";

async function register(request: APIRequestContext, email: string, name: string): Promise<void> {
  const res = await request.post("/api/auth/register", {
    data: { name, email, password: PASSWORD },
  });
  // 201 = created, 409 = already exists (re-run tolerance)
  expect([201, 409]).toContain(res.status());
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Successful sign-in redirects to home and the account menu appears.
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible({
    timeout: 10_000,
  });
}

async function runCouncilAndGetId(page: Page): Promise<string> {
  await page.goto("/");
  await page
    .getByLabel("Your Question, Problem, or Idea")
    .fill("User B's confidential strategy question — should stay private.");
  await page.getByRole("button", { name: /run council analysis/i }).click();
  await expect(page.getByRole("heading", { name: /final synthesis report/i })).toBeVisible({ timeout: 30_000 });

  // The API auto-saves for authenticated users; read it back from the list.
  const res = await page.request.get("/api/conversations");
  expect(res.ok()).toBeTruthy();
  const conversations = (await res.json()) as { id: string }[];
  expect(conversations.length).toBeGreaterThan(0);
  return conversations[0].id;
}

test("user A cannot read user B's conversation", async ({ browser }) => {
  // Multi-step flow (two auth round-trips + a full council run) — give it more
  // than the 30s default, since the mock council adds artificial per-agent
  // latency and several of these run in parallel.
  test.setTimeout(90_000);
  const stamp = Date.now();
  const emailA = `idor-a-${stamp}@example.com`;
  const emailB = `idor-b-${stamp}@example.com`;

  // ── User B: register, log in, run a council, capture its id ──
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await register(pageB.request, emailB, "User B");
  await login(pageB, emailB);
  const bConversationId = await runCouncilAndGetId(pageB);

  // ── User A: register, log in ──
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await register(pageA.request, emailA, "User A");
  await login(pageA, emailA);

  // A directly requests B's conversation → 404 (not-owned is indistinguishable
  // from not-found; the guard refuses to confirm the id even exists).
  const direct = await pageA.request.get(`/api/conversations/${bConversationId}`);
  expect(direct.status()).toBe(404);

  // B's conversation must not leak into A's own list either.
  const listRes = await pageA.request.get("/api/conversations");
  expect(listRes.ok()).toBeTruthy();
  const aConversations = (await listRes.json()) as { id: string }[];
  expect(aConversations.some((c) => c.id === bConversationId)).toBe(false);

  // Sanity: B can still read B's own conversation (guard isn't over-broad).
  const owner = await pageB.request.get(`/api/conversations/${bConversationId}`);
  expect(owner.ok()).toBeTruthy();

  await ctxA.close();
  await ctxB.close();
});

test("unauthenticated requests to a conversation are rejected", async ({ request }) => {
  const res = await request.get("/api/conversations/some-made-up-id");
  expect(res.status()).toBe(401);
});
