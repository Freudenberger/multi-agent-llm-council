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
