import type { LLMProvider } from "./types";
import { MockProvider } from "./mockProvider";
import { OpenRouterProvider } from "./openRouterProvider";

/**
 * Factory function to create the appropriate LLM provider based on environment config.
 *
 * Environment variables:
 *   LLM_PROVIDER=mock|openrouter
 *   OPENROUTER_API_KEY=...
 *   OPENROUTER_MODEL=...
 */
export function createProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "mock";

  switch (provider) {
    case "mock":
      return new MockProvider();
    case "openrouter":
      return new OpenRouterProvider();
    default:
      console.warn(`Unknown LLM_PROVIDER "${provider}", falling back to mock.`);
      return new MockProvider();
  }
}
