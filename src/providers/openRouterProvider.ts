import type {
  LLMProvider,
  GenerateInput,
  GenerateOutput,
  RetryConfig,
  TimeoutConfig,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,
} from "./types";
import { logger } from "../core/logger";
import {
  ProviderRetryError,
  ProviderTimeoutError,
  CouncilAbortedError,
} from "../core/errors";

/**
 * OpenRouter Provider — uses OpenRouter API for LLM calls.
 * Requires OPENROUTER_API_KEY environment variable.
 *
 * Supports configurable retry logic with exponential backoff and per-request
 * timeout via constructor options or environment variables:
 *   LLM_MAX_RETRIES, LLM_RETRY_BASE_DELAY, LLM_REQUEST_TIMEOUT
 */

export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private apiUrl = "https://openrouter.ai/api/v1/chat/completions";
  private retryConfig: RetryConfig;
  private timeoutConfig: TimeoutConfig;

  constructor(
    apiKey?: string,
    model?: string,
    retryConfig?: RetryConfig,
    timeoutConfig?: TimeoutConfig,
  ) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    this.model = model || process.env.OPENROUTER_MODEL || "openrouter/free";
    this.retryConfig = retryConfig ?? {
      maxRetries: parseInt(process.env.LLM_MAX_RETRIES || "3", 10),
      baseDelayMs: parseInt(process.env.LLM_RETRY_BASE_DELAY || "1000", 10),
    };
    this.timeoutConfig = timeoutConfig ?? {
      requestTimeoutMs: parseInt(
        process.env.LLM_REQUEST_TIMEOUT || "60000",
        10,
      ),
    };
  }

  /**
   * Determines whether an error is transient and worth retrying.
   * Retries on network errors, 429 (rate limit), and 5xx (server errors).
   */
  private isRetryable(error: unknown, responseStatus?: number): boolean {
    if (responseStatus !== undefined) {
      return responseStatus === 429 || responseStatus >= 500;
    }
    if (error instanceof Error) {
      const msg = error.name + error.message;
      return (
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("fetch failed") ||
        msg.includes("network") ||
        msg.includes("socket")
      );
    }
    return false;
  }

  /**
   * Executes a single fetch attempt with a timeout.
   * Returns the Response or throws ProviderTimeoutError.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    externalSignal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Forward an external cancellation (e.g. user aborted the run) to this fetch.
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", onExternalAbort);
    }

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error: unknown) {
      // External cancellation takes precedence over the timeout interpretation.
      if (externalSignal?.aborted) {
        throw new CouncilAbortedError();
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderTimeoutError(
          `Request timed out after ${timeoutMs}ms`,
          timeoutMs,
          error,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }
  }

  /**
   * Delays for the given number of milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      maxRetries: this.retryConfig.maxRetries,
      timeoutMs: this.timeoutConfig.requestTimeoutMs,
    });

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userMessage },
      ],
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 2048,
    });

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Multi-Agent LLM Council",
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      // Stop before (re)trying if the run was cancelled in the meantime.
      if (input.signal?.aborted) {
        throw new CouncilAbortedError();
      }
      if (attempt > 0) {
        const backoffMs =
          this.retryConfig.baseDelayMs * Math.pow(2, attempt - 1);
        logger.info(
          `OpenRouterProvider retry attempt ${attempt}/${this.retryConfig.maxRetries}`,
          {
            model: this.model,
            backoffMs,
          },
        );
        await this.delay(backoffMs);
      }

      try {
        const response = await this.fetchWithTimeout(
          this.apiUrl,
          { method: "POST", headers, body },
          this.timeoutConfig.requestTimeoutMs,
          input.signal,
        );

        if (!response.ok) {
          const errorText = await response.text();

          const isRetryableStatus = this.isRetryable(
            undefined,
            response.status,
          );

          if (isRetryableStatus) {
            lastError = new Error(
              `OpenRouter API error: ${response.status} - ${errorText}`,
            );
            logger.info("OpenRouterProvider retryable HTTP error", {
              model: this.model,
              status: response.status,
              attempt: attempt + 1,
              maxRetries: this.retryConfig.maxRetries,
              error: errorText.substring(0, 300),
            });
            // Always continue — if more attempts remain the loop retries,
            // otherwise the loop ends and ProviderRetryError is thrown below.
            continue;
          } else {
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
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const durationMs = Math.round(performance.now() - start);

        if (attempt > 0) {
          logger.info("OpenRouterProvider succeeded after retries", {
            model: this.model,
            attempt: attempt + 1,
            durationMs,
          });
        }

        logger.debug("OpenRouterProvider.generate completed", {
          model: this.model,
          durationMs,
          responseLength: content.length,
          attempts: attempt + 1,
        });

        return {
          content,
          model: this.model,
        };
      } catch (error: unknown) {
        // Cancellation — propagate immediately, never retry.
        if (error instanceof CouncilAbortedError) {
          throw error;
        }

        // ProviderTimeoutError — retry if attempts remain
        if (error instanceof ProviderTimeoutError) {
          lastError = error;
          if (attempt < this.retryConfig.maxRetries) {
            logger.info("OpenRouterProvider timeout, will retry", {
              model: this.model,
              attempt: attempt + 1,
              maxRetries: this.retryConfig.maxRetries,
              timeoutMs: this.timeoutConfig.requestTimeoutMs,
            });
            continue;
          }
          // Exhausted retries on timeout
          const durationMs = Math.round(performance.now() - start);
          logger.error("OpenRouterProvider timeout, retries exhausted", {
            model: this.model,
            durationMs,
            attempts: attempt + 1,
            timeoutMs: this.timeoutConfig.requestTimeoutMs,
          });
          throw new ProviderRetryError(
            `Request timed out after ${attempt + 1} attempt(s) (${this.timeoutConfig.requestTimeoutMs}ms each)`,
            attempt + 1,
            error,
          );
        }

        // Network-level errors — retry if transient
        if (this.isRetryable(error) && attempt < this.retryConfig.maxRetries) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.info("OpenRouterProvider transient error, will retry", {
            model: this.model,
            attempt: attempt + 1,
            maxRetries: this.retryConfig.maxRetries,
            error: errorMessage.substring(0, 300),
          });
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }

        // Non-retryable error — throw immediately
        throw error;
      }
    }

    // All retries exhausted (should not reach here normally, but safety net)
    const durationMs = Math.round(performance.now() - start);
    logger.error("OpenRouterProvider all retries exhausted", {
      model: this.model,
      durationMs,
      attempts: this.retryConfig.maxRetries + 1,
      lastError: lastError?.message,
    });
    throw new ProviderRetryError(
      `All ${this.retryConfig.maxRetries + 1} attempt(s) failed. Last error: ${lastError?.message ?? "unknown"}`,
      this.retryConfig.maxRetries + 1,
      lastError,
    );
  }
}
