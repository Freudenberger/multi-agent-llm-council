import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, timed } from "@/core/logger";

describe("logger", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalEnv;
    }
    vi.restoreAllMocks();
  });

  describe("log level filtering", () => {
    it("should default to info level", () => {
      delete process.env.LOG_LEVEL;
      // Re-import to pick up the new env — but since the module
      // reads at call time via getConfiguredLevel(), we can just
      // test indirectly: debug should not log, info should.
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.debug("should not appear");
      logger.info("should appear");

      expect(debugSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("should appear"),
      );
    });

    it("should log everything when LOG_LEVEL=debug", () => {
      process.env.LOG_LEVEL = "debug";
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.debug("debug msg");
      logger.info("info msg");
      logger.error("error msg");

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining("debug msg"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("info msg"));
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("error msg"),
      );
    });

    it("should only log errors when LOG_LEVEL=error", () => {
      process.env.LOG_LEVEL = "error";
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      logger.debug("debug msg");
      logger.info("info msg");
      logger.error("error msg");

      expect(debugSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("error msg"),
      );
    });
  });

  describe("message formatting", () => {
    it("should include timestamp and level in output", () => {
      process.env.LOG_LEVEL = "info";
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.info("test message");

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T.*\] \[INFO\] test message/),
      );
    });

    it("should include data as JSON when provided", () => {
      process.env.LOG_LEVEL = "info";
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.info("with data", { key: "value", count: 42 });

      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('"key":"value"');
      expect(call).toContain('"count":42');
    });
  });

  describe("getLevel", () => {
    it("should return the configured level", () => {
      process.env.LOG_LEVEL = "debug";
      expect(logger.getLevel()).toBe("debug");

      process.env.LOG_LEVEL = "error";
      expect(logger.getLevel()).toBe("error");

      delete process.env.LOG_LEVEL;
      expect(logger.getLevel()).toBe("info");
    });
  });
});

describe("timed", () => {
  beforeEach(() => {
    process.env.LOG_LEVEL = "error"; // suppress log noise during tests
  });

  afterEach(() => {
    delete process.env.LOG_LEVEL;
    vi.restoreAllMocks();
  });

  it("should return the result and duration", async () => {
    const result = await timed("test-op", async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });

    expect(result.result).toBe(42);
    expect(result.durationMs).toBeGreaterThanOrEqual(10);
  });

  it("should propagate errors from the wrapped function", async () => {
    await expect(
      timed("failing-op", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("should log start and completion", async () => {
    process.env.LOG_LEVEL = "debug";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await timed("my-op", async () => "done", { extra: true });

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining("Starting: my-op"),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("my-op completed"),
    );
  });
});
