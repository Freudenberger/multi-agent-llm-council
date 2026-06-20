import type {
  LLMProvider,
  RetryConfig,
  TimeoutConfig,
  ProviderOverride,
} from "./types";
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

/** Options handed to every provider factory in the registry. */
type ProviderInit = {
  /** API key. For `apiKey`-keyed callers this is the user's own key; otherwise
   * undefined and the provider falls back to its own env var. */
  apiKey?: string;
  model?: string;
  retryConfig?: RetryConfig;
  timeoutConfig?: TimeoutConfig;
};

/**
 * Registry of known LLM providers, keyed by the value of `LLM_PROVIDER`.
 *
 * To add a provider: implement the `LLMProvider` interface and add one entry
 * here — `createProvider` and every caller pick it up automatically. Nothing
 * else in this file is provider-specific.
 */
const PROVIDER_REGISTRY: Record<string, (init: ProviderInit) => LLMProvider> = {
  mock: () => new MockProvider(),
  openrouter: (init) =>
    new OpenRouterProvider(
      init.apiKey,
      init.model || undefined,
      init.retryConfig,
      init.timeoutConfig,
    ),
};

const FALLBACK_PROVIDER = "mock";

/**
 * Factory function to create the appropriate LLM provider.
 *
 * Resolution order:
 *   1. If `override` is supplied (a signed-in user's own key + the provider it
 *      belongs to), build THAT provider with the user's key — regardless of the
 *      env. So a user with their own key gets live LLMs on a `LLM_PROVIDER=mock`
 *      demo instance, and the key is routed to the correct provider when more
 *      than one exists.
 *   2. Otherwise use `LLM_PROVIDER` (default `mock`) with that provider's env key.
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
  override?: ProviderOverride,
): LLMProvider {
  const providerId =
    override?.providerId || process.env.LLM_PROVIDER || FALLBACK_PROVIDER;

  const factory = PROVIDER_REGISTRY[providerId];
  if (!factory) {
    console.warn(
      `Unknown provider "${providerId}", falling back to ${FALLBACK_PROVIDER}.`,
    );
    return PROVIDER_REGISTRY[FALLBACK_PROVIDER]({});
  }

  return factory({
    apiKey: override?.apiKey,
    model,
    retryConfig,
    timeoutConfig,
  });
}
