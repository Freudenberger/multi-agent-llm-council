/** LLM Provider abstraction */

export type GenerateInput = {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
};

export type GenerateOutput = {
  content: string;
  model: string;
};

export type LLMProvider = {
  generate(input: GenerateInput): Promise<GenerateOutput>;
};

/**
 * Retry configuration for LLM provider calls.
 *
 * Environment variables:
 *   LLM_MAX_RETRIES       — max retry attempts (default: 3)
 *   LLM_RETRY_BASE_DELAY  — base delay in ms for exponential backoff (default: 1000)
 *   LLM_REQUEST_TIMEOUT   — per-request timeout in ms (default: 60000)
 */
export type RetryConfig = {
  /** Maximum number of retry attempts before giving up. */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff. */
  baseDelayMs: number;
};

export type TimeoutConfig = {
  /** Timeout in milliseconds for each individual request attempt. */
  requestTimeoutMs: number;
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
};

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  requestTimeoutMs: 60000,
};
