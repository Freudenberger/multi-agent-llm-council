import type { LLMProvider, GenerateInput, GenerateOutput } from "./types";
import { logger } from "../core/logger";

/**
 * OpenRouter Provider — uses OpenRouter API for LLM calls.
 * Requires OPENROUTER_API_KEY environment variable.
 */

export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private apiUrl = "https://openrouter.ai/api/v1/chat/completions";

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    this.model = model || process.env.OPENROUTER_MODEL || "openrouter/free";
  }

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    if (!this.apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Set it in your environment or .env file.",
      );
    }

    const start = performance.now();
    logger.debug("OpenRouterProvider.generate called", {
      model: this.model,
      systemPromptLength: input.systemPrompt.length,
      userMessageLength: input.userMessage.length,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Multi-Agent LLM Council",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userMessage },
        ],
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const durationMs = Math.round(performance.now() - start);
      logger.error("OpenRouterProvider API error", {
        model: this.model,
        status: response.status,
        durationMs,
        error: errorText.substring(0, 500),
      });
      throw new Error(
        `OpenRouter API error: ${response.status} - ${errorText}`,
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const durationMs = Math.round(performance.now() - start);

    logger.debug("OpenRouterProvider.generate completed", {
      model: this.model,
      durationMs,
      responseLength: content.length,
    });

    return {
      content,
      model: this.model,
    };
  }
}
