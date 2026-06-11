import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenRouterProvider } from "@/providers/openRouterProvider";
import { ProviderRetryError, ProviderTimeoutError } from "@/core/errors";

// ─── Helpers ────────────────────────────────────────────────────────

/** Install a mock for globalThis.fetch and return the mock function. */
function installFetchMock() {
  const mock = vi.fn();
  vi.stubGlobal("fetch", mock);
  return mock;
}

function restoreFetch() {
  vi.unstubAllGlobals();
}

/** Build a minimal JSON Response object (fresh each call). */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SUCCESS_BODY = {
  choices: [{ message: { content: "hello from the model" } }],
};

// ─── Tests ──────────────────────────────────────────────────────────

describe("OpenRouterProvider — retry logic", () => {
  let fetchMock: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  afterEach(() => {
    restoreFetch();
  });

  it("should succeed on the first attempt when no errors occur", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUCCESS_BODY));

    const provider = new OpenRouterProvider("test-key", "test-model", {
      maxRetries: 2,
      baseDelayMs: 10,
    });
    const result = await provider.generate({
      systemPrompt: "You are a helper.",
      userMessage: "Say hello.",
    });

    expect(result.content).toBe("hello from the model");
    expect(result.model).toBe("test-model");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should retry on HTTP 500 and eventually succeed", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "server boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: "still broken" }, 502))
      .mockResolvedValueOnce(jsonResponse(SUCCESS_BODY));

    const provider = new OpenRouterProvider("test-key", "test-model", {
      maxRetries: 3,
      baseDelayMs: 10,
    });
    const result = await provider.generate({
      systemPrompt: "You are a helper.",
      userMessage: "Say hello.",
    });

    expect(result.content).toBe("hello from the model");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("should retry on HTTP 429 (rate limit) and eventually succeed", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429))
      .mockResolvedValueOnce(jsonResponse(SUCCESS_BODY));

    const provider = new OpenRouterProvider("test-key", "test-model", {
      maxRetries: 2,
      baseDelayMs: 10,
    });
    const result = await provider.generate({
      systemPrompt: "You are a helper.",
      userMessage: "Say hello.",
    });

    expect(result.content).toBe("hello from the model");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should NOT retry on HTTP 400 (client error)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "bad request" }, 400),
    );

    const provider = new OpenRouterProvider("test-key", "test-model", {
      maxRetries: 3,
      baseDelayMs: 10,
    });

    await expect(
      provider.generate({
        systemPrompt: "You are a helper.",
        userMessage: "Say hello.",
      }),
    ).rejects.toThrow("OpenRouter API error: 400");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should throw ProviderRetryError when all retries are exhausted (503)", async () => {
    // Use mockResolvedValueOnce for each attempt so each gets a fresh Response
    fetchMock
      .mockResolvedValueOnce(
        new Response('{"error":"server down"}', {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{"error":"server down"}', {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{"error":"server down"}', {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const provider = new OpenRouterProvider("test-key", "test-model", {
      maxRetries: 2,
      baseDelayMs: 10,
    });

    let caughtError: unknown;
    try {
      await provider.generate({
        systemPrompt: "You are a helper.",
        userMessage: "Say hello.",
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ProviderRetryError);
    // initial attempt + 2 retries = 3 total
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("should retry on network-level errors (fetch throws)", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("fetch failed: ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse(SUCCESS_BODY));

    const provider = new OpenRouterProvider("test-key", "test-model", {
      maxRetries: 2,
      baseDelayMs: 10,
    });
    const result = await provider.generate({
      systemPrompt: "You are a helper.",
      userMessage: "Say hello.",
    });

    expect(result.content).toBe("hello from the model");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should use exponential backoff delays between retries", async () => {
    const delays: number[] = [];
    let lastTime = performance.now();

    // Use a single mock implementation that captures timing and returns
    // errors for the first 2 calls, then success on the 3rd
    fetchMock.mockImplementation(() => {
      delays.push(Math.round(performance.now() - lastTime));
      lastTime = performance.now();
      if (delays.length >= 3) {
        return Promise.resolve(jsonResponse(SUCCESS_BODY));
      }
      return Promise.resolve(jsonResponse({ error: "boom" }, 500));
    });

    const provider = new OpenRouterProvider("test-key", "test-model", {
      maxRetries: 2,
      baseDelayMs: 50,
    });

    await provider.generate({
      systemPrompt: "You are a helper.",
      userMessage: "Say hello.",
    });

    // delays[0] = time to first call (near 0)
    // delays[1] = backoff after first failure (~50ms)
    // delays[2] = backoff after second failure (~100ms)
    // Allow generous tolerance for CI timing
    expect(delays.length).toBeGreaterThanOrEqual(3);
    expect(delays[1]).toBeGreaterThanOrEqual(20); // ~50ms with tolerance
    expect(delays[2]).toBeGreaterThanOrEqual(40); // ~100ms with tolerance
  });
});

describe("OpenRouterProvider — timeout handling", () => {
  let fetchMock: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  afterEach(() => {
    restoreFetch();
  });

  it("should abort a request that exceeds the timeout and retry", async () => {
    // First call: respects abort signal and throws AbortError
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    // Second call: succeeds
    fetchMock.mockResolvedValueOnce(jsonResponse(SUCCESS_BODY));

    const provider = new OpenRouterProvider(
      "test-key",
      "test-model",
      { maxRetries: 2, baseDelayMs: 10 },
      { requestTimeoutMs: 100 },
    );

    const result = await provider.generate({
      systemPrompt: "You are a helper.",
      userMessage: "Say hello.",
    });

    expect(result.content).toBe("hello from the model");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should throw ProviderRetryError when timeout exhausts all retries", async () => {
    // All calls hang until aborted
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const provider = new OpenRouterProvider(
      "test-key",
      "test-model",
      { maxRetries: 1, baseDelayMs: 10 },
      { requestTimeoutMs: 50 },
    );

    await expect(
      provider.generate({
        systemPrompt: "You are a helper.",
        userMessage: "Say hello.",
      }),
    ).rejects.toThrow(ProviderRetryError);

    // initial + 1 retry = 2
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should pass the AbortSignal to fetch", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUCCESS_BODY));

    const provider = new OpenRouterProvider(
      "test-key",
      "test-model",
      { maxRetries: 0, baseDelayMs: 10 },
      { requestTimeoutMs: 5000 },
    );

    await provider.generate({
      systemPrompt: "You are a helper.",
      userMessage: "Say hello.",
    });

    const callArgs = fetchMock.mock.calls[0];
    const init = callArgs[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("OpenRouterProvider — configuration", () => {
  let fetchMock: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  afterEach(() => {
    restoreFetch();
  });

  // Typed view of the provider's private config fields, for assertions.
  type ProviderInternals = {
    retryConfig: { maxRetries: number; baseDelayMs: number };
    timeoutConfig: { requestTimeoutMs: number };
  };
  const internals = (provider: OpenRouterProvider) =>
    provider as unknown as ProviderInternals;

  it("should use default retry config when none provided", () => {
    const provider = new OpenRouterProvider("test-key", "test-model");
    // Access private fields via cast for assertion
    expect(internals(provider).retryConfig.maxRetries).toBe(3);
    expect(internals(provider).retryConfig.baseDelayMs).toBe(1000);
    expect(internals(provider).timeoutConfig.requestTimeoutMs).toBe(60000);
  });

  it("should accept custom retry and timeout config", () => {
    const provider = new OpenRouterProvider(
      "test-key",
      "test-model",
      { maxRetries: 5, baseDelayMs: 2000 },
      { requestTimeoutMs: 120000 },
    );
    expect(internals(provider).retryConfig.maxRetries).toBe(5);
    expect(internals(provider).retryConfig.baseDelayMs).toBe(2000);
    expect(internals(provider).timeoutConfig.requestTimeoutMs).toBe(120000);
  });

  it("should throw when API key is missing", async () => {
    const provider = new OpenRouterProvider("", "test-model");
    await expect(
      provider.generate({
        systemPrompt: "You are a helper.",
        userMessage: "Say hello.",
      }),
    ).rejects.toThrow("OPENROUTER_API_KEY is not set");
  });
});
