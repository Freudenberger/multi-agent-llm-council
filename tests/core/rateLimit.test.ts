import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, _resetRateLimitsForTest } from "@/core/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => _resetRateLimitsForTest());

  it("allows hits up to the limit, then blocks within the window", () => {
    // Arrange
    const key = "1.2.3.4";
    const t0 = 1_000_000;

    // Act + Assert — 3 allowed, 4th blocked (fixed clock, same window)
    expect(checkRateLimit(key, 3, 60_000, t0).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000, t0).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000, t0).allowed).toBe(true);

    const blocked = checkRateLimit(key, 3, 60_000, t0 + 1_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = "5.6.7.8";
    const t0 = 2_000_000;
    checkRateLimit(key, 1, 60_000, t0); // uses the single slot
    expect(checkRateLimit(key, 1, 60_000, t0).allowed).toBe(false);

    // Past resetAt → fresh window
    expect(checkRateLimit(key, 1, 60_000, t0 + 60_001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const t0 = 3_000_000;
    expect(checkRateLimit("a", 1, 60_000, t0).allowed).toBe(true);
    expect(checkRateLimit("b", 1, 60_000, t0).allowed).toBe(true);
    expect(checkRateLimit("a", 1, 60_000, t0).allowed).toBe(false);
  });
});
