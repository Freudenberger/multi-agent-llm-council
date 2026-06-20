import type { LLMProvider, RetryConfig, TimeoutConfig } from "./types";
import { MockProvider } from "./mockProvider";
import { OpenRouterProvider } from "./openRouterProvider";

// Re-export the mock test hooks so tests can script/reset the mock provider
// without reaching into the file directly.
export {
  setMockResponder,
  resetMockProvider,
  setMockLatency,
  type MockResponder,
} from "./mockProvider";

/**
 * Factory function to create the appropriate LLM provider based on environment config.
 *
 * Environment variables:
 *   LLM_PROVIDER=mock|openrouter
 *   OPENROUTER_API_KEY=...
 *   OPENROUTER_MODEL=...
 *   LLM_MAX_RETRIES=3
 *   LLM_RETRY_BASE_DELAY=1000
 *   LLM_REQUEST_TIMEOUT=60000
 */
export function createProvider(
  model?: string,
  retryConfig?: RetryConfig,
  timeoutConfig?: TimeoutConfig,
): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "mock";

  switch (provider) {
    case "mock":
      return new MockProvider();
    case "openrouter":
      return new OpenRouterProvider(
        undefined,
        model || undefined,
        retryConfig,
        timeoutConfig,
      );
    default:
      console.warn(`Unknown LLM_PROVIDER "${provider}", falling back to mock.`);
      return new MockProvider();
  }
}
