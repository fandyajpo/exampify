import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Cron authentication (`BACKGROUND_JOBS.md` §5.1): Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`, and Vercel does not speak QStash signatures.
 *
 * The comparison is constant-time over equal-length buffers. A length check before
 * `timingSafeEqual` is required (the function throws on a mismatch) and does not leak the
 * secret: the expected length is fixed by the environment, not by the attacker.
 */
export function verifyCronRequest(authorization: string | null): boolean {
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const actual = Buffer.from(authorization ?? "");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
