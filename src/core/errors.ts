/** Custom error types for the Council Core */

export class CouncilError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouncilError";
  }
}

export class ModeNotFoundError extends CouncilError {
  constructor(modeId: string) {
    super(`Council mode "${modeId}" not found`);
    this.name = "ModeNotFoundError";
  }
}

export class ProviderError extends CouncilError {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class ValidationError extends CouncilError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Error thrown when all retry attempts to the LLM provider have been exhausted.
 */
export class ProviderRetryError extends CouncilError {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ProviderRetryError";
  }
}

/**
 * Error thrown when a single request to the LLM provider exceeds the timeout.
 */
export class ProviderTimeoutError extends CouncilError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ProviderTimeoutError";
  }
}

/**
 * Thrown when a council run is cancelled via its AbortSignal (e.g. the user
 * cancels from the UI). Signals an intentional stop, not a failure — callers
 * should not retry and should not surface it as an error to the user.
 */
export class CouncilAbortedError extends CouncilError {
  constructor(message = "Council run was cancelled") {
    super(message);
    this.name = "CouncilAbortedError";
  }
}
