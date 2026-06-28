/**
 * Minimal fixed-window rate limiter, keyed by an arbitrary string (e.g. client
 * IP). Protects expensive endpoints — chiefly POST /api/council, which fans out
 * to the LLM provider and can drain budget if called in a loop.
 *
 * ponytail: in-memory per-process counter. Correct for a single instance; if
 * the app is scaled horizontally, swap the Map for a shared store (Redis /
 * Upstash) keeping the same checkRateLimit signature.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the window resets — send as Retry-After when blocked. */
  retryAfterSec: number;
  remaining: number;
};

/**
 * Records a hit for `key` and reports whether it's within `limit` hits per
 * `windowMs`. The window starts on the first hit and is fixed (not sliding).
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic prune so the Map can't grow without bound under churn.
    if (windows.size > 10_000) {
      for (const [k, w] of windows) {
        if (now >= w.resetAt) windows.delete(k);
      }
    }
    return { allowed: true, retryAfterSec: 0, remaining: limit - 1 };
  }

  existing.count += 1;
  const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
  return {
    allowed: existing.count <= limit,
    retryAfterSec,
    remaining: Math.max(0, limit - existing.count),
  };
}

/** Test-only: clears all windows. */
export function _resetRateLimitsForTest(): void {
  windows.clear();
}
