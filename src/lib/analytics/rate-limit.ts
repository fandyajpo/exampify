/**
 * Fixed-window rate limiter for `POST /api/v1/events` (60 requests/min, §16.1).
 *
 * This is the in-process fallback: it is correct for a single instance and is what local
 * development and unit tests use. Deployed instances are short-lived and horizontally
 * scaled, so the shared Upstash Redis limiter becomes the real implementation once
 * `UPSTASH_REDIS_REST_URL` is provisioned (Phase 2); this module is the seam for that.
 */

type Window = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const LIMIT = 60;

const windows = new Map<string, Window>();

export function allowRequest(key: string, now: number = Date.now()): boolean {
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (existing.count >= LIMIT) return false;

  existing.count += 1;
  return true;
}

/** Exposed for tests; the map is otherwise bounded by the process lifetime. */
export function resetRateLimits(): void {
  windows.clear();
}
