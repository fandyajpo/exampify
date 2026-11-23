import "server-only";

import { createHmac } from "node:crypto";

import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * `email_suppressions` (`EMAIL_AND_NOTIFICATIONS.md` §5, `DATABASE_SCHEMA.md` §10.8).
 *
 * Only a keyed hash of the address is stored, so the table survives account deletion and
 * is not personal data on its own. The pepper is the Better Auth secret: it already exists
 * in every environment and is never in the repository.
 *
 * There are two sources and only one is automatic: a synchronous 5xx refusal during the
 * SMTP conversation (`source='smtp'`), and an operator reconciling a later bounce from the
 * sending account's inbox (`source='ops'`, `R10`). Google provides no delivery events, so
 * nothing else can feed this table (ADR-037).
 */
export type SuppressionReason = "hard_bounce" | "complaint" | "manual" | "invalid";

export function hashEmail(email: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export async function isSuppressed(email: string): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .selectFrom("email_suppressions")
    .select("email_hash")
    .where("email_hash", "=", hashEmail(email))
    .executeTakeFirst();
  return Boolean(row);
}

/** Insert-or-ignore: reconciling the same bounce twice changes nothing (`EM-08`). */
export async function suppressEmail(
  email: string,
  reason: SuppressionReason,
  source: string,
): Promise<void> {
  const db = await getDb();
  await db
    .insertInto("email_suppressions")
    .values({ email_hash: hashEmail(email), reason, source, created_at: Date.now() })
    .onConflict((conflict) => conflict.column("email_hash").doNothing())
    .execute();
}
