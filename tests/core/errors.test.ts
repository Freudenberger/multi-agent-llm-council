import { describe, it, expect } from "vitest";
import {
  CouncilError,
  ValidationError,
  ModeNotFoundError,
  ProviderError,
  ProviderRetryError,
  ProviderTimeoutError,
} from "@/core/errors";

describe("errors", () => {
  describe("CouncilError", () => {
    it("should be an instance of Error", () => {
      const err = new CouncilError("test");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(CouncilError);
    });

    it("should set the name property", () => {
      const err = new CouncilError("test message");
      expect(err.name).toBe("CouncilError");
      expect(err.message).toBe("test message");
    });
  });

  describe("ValidationError", () => {
    it("should extend CouncilError", () => {
      const err = new ValidationError("invalid input");
      expect(err).toBeInstanceOf(CouncilError);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.name).toBe("ValidationError");
      expect(err.message).toBe("invalid input");
    });
  });

  describe("ModeNotFoundError", () => {
    it("should extend CouncilError", () => {
      const err = new ModeNotFoundError("brainstorm");
      expect(err).toBeInstanceOf(CouncilError);
      expect(err).toBeInstanceOf(ModeNotFoundError);
      expect(err.name).toBe("ModeNotFoundError");
    });

    it("should include the mode ID in the message", () => {
      const err = new ModeNotFoundError("brainstorm");
      expect(err.message).toContain("brainstorm");
      expect(err.message).toContain("not found");
    });
  });

  describe("ProviderError", () => {
    it("should extend CouncilError", () => {
      const err = new ProviderError("provider failed");
      expect(err).toBeInstanceOf(CouncilError);
      expect(err).toBeInstanceOf(ProviderError);
      expect(err.name).toBe("ProviderError");
    });

    it("should store an optional cause", () => {
      const cause = new Error("underlying issue");
      const err = new ProviderError("wrapper", cause);
      expect(err.message).toBe("wrapper");
      expect(err.cause).toBe(cause);
    });

    it("should work without a cause", () => {
      const err = new ProviderError("no cause");
      expect(err.cause).toBeUndefined();
    });
  });

  describe("ProviderRetryError", () => {
    it("should extend CouncilError", () => {
      const err = new ProviderRetryError("exhausted", 3);
      expect(err).toBeInstanceOf(CouncilError);
      expect(err).toBeInstanceOf(ProviderRetryError);
      expect(err.name).toBe("ProviderRetryError");
    });

    it("should store attempts count", () => {
      const err = new ProviderRetryError("failed after retries", 5);
      expect(err.attempts).toBe(5);
      expect(err.message).toBe("failed after retries");
    });

    it("should store an optional cause", () => {
      const cause = new Error("timeout");
      const err = new ProviderRetryError("exhausted", 2, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe("ProviderTimeoutError", () => {
    it("should extend CouncilError", () => {
      const err = new ProviderTimeoutError("timed out", 30000);
      expect(err).toBeInstanceOf(CouncilError);
      expect(err).toBeInstanceOf(ProviderTimeoutError);
      expect(err.name).toBe("ProviderTimeoutError");
    });

    it("should store timeout value", () => {
      const err = new ProviderTimeoutError("request timed out", 60000);
      expect(err.timeoutMs).toBe(60000);
      expect(err.message).toBe("request timed out");
    });

    it("should store an optional cause", () => {
      const cause = new DOMException("aborted", "AbortError");
      const err = new ProviderTimeoutError("timed out", 5000, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe("error hierarchy", () => {
    it("all error types should be catchable as CouncilError", () => {
      const errors = [
        new ValidationError("v"),
        new ModeNotFoundError("m"),
        new ProviderError("p"),
        new ProviderRetryError("r", 1),
        new ProviderTimeoutError("t", 1000),
      ];
      for (const err of errors) {
        expect(err).toBeInstanceOf(CouncilError);
        expect(err).toBeInstanceOf(Error);
      }
    });
  });
});
