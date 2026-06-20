import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProvider } from "@/providers";
import { MockProvider } from "@/providers/mockProvider";
import { OpenRouterProvider } from "@/providers/openRouterProvider";

/**
 * Behaviour under test: a caller-supplied (user's own) provider override — a key
 * plus the provider id it belongs to — forces THAT provider even when
 * LLM_PROVIDER=mock, so a user with their own key gets live LLMs on a demo
 * instance, and the key is routed to the correct provider. Without an override,
 * the env provider is used as before.
 */
describe("createProvider — per-user provider override", () => {
  const original = {
    provider: process.env.LLM_PROVIDER,
    key: process.env.OPENROUTER_API_KEY,
  };

  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env.LLM_PROVIDER = original.provider;
    process.env.OPENROUTER_API_KEY = original.key;
    if (original.provider === undefined) delete process.env.LLM_PROVIDER;
    if (original.key === undefined) delete process.env.OPENROUTER_API_KEY;
    vi.unstubAllGlobals();
  });

  it("uses the mock provider when no override is supplied and LLM_PROVIDER=mock", () => {
    process.env.LLM_PROVIDER = "mock";
    expect(createProvider()).toBeInstanceOf(MockProvider);
  });

  it("forces the override's provider even under LLM_PROVIDER=mock", () => {
    process.env.LLM_PROVIDER = "mock";
    const provider = createProvider(undefined, undefined, undefined, {
      providerId: "openrouter",
      apiKey: "user-key",
    });
    expect(provider).toBeInstanceOf(OpenRouterProvider);
  });

  it("routes the key by providerId, not a hardcoded provider", () => {
    process.env.LLM_PROVIDER = "mock";
    // An override naming an unknown provider must NOT silently become OpenRouter;
    // it falls back to mock. This is what proves routing is provider-aware.
    const provider = createProvider(undefined, undefined, undefined, {
      providerId: "some-future-provider",
      apiKey: "user-key",
    });
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it("treats no override as 'use env provider'", () => {
    process.env.LLM_PROVIDER = "mock";
    const provider = createProvider("some/model", undefined, undefined, undefined);
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it("sends the user's key in the Authorization header on generate", async () => {
    process.env.LLM_PROVIDER = "mock"; // env says mock…
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "hi" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // …but the user's own key takes over and actually calls OpenRouter.
    const provider = createProvider(undefined, undefined, undefined, {
      providerId: "openrouter",
      apiKey: "sk-user-123",
    });
    await provider.generate({ systemPrompt: "s", userMessage: "u" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer sk-user-123");
  });
});
