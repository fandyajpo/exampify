import "server-only";

import { getDb } from "@/lib/db";
import { uuidv7 } from "@/lib/ids";

import { redactProps, type EventEntityType, type EventName } from "./events";

/**
 * `recordEvent()` — the one writer for `usage_events` (`OBSERVABILITY_AND_ANALYTICS.md`
 * §6, §7).
 *
 * Server-side facts are recorded inline by the service that performed the action, in the
 * same transaction when the action is a write, so an event cannot outlive a rolled-back
 * attempt. `received_at` is server time and is the column of record; `occurred_at` is only
 * for ordering (§6.3).
 *
 * Properties are passed through `redactProps`, so even a careless caller cannot store a
 * nested object, a long free-text value or an unexpected key.
 */
export type RecordEventInput = {
  name: EventName;
  /** Client-reported time in epoch milliseconds; defaults to now. */
  occurredAt?: number;
  userId?: string | null;
  anonymousId?: string | null;
  entityType?: EventEntityType | null;
  entityId?: string | null;
  props?: unknown;
  requestId?: string | null;
};

export async function recordEvent(input: RecordEventInput): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db
    .insertInto("usage_events")
    .values({
      id: uuidv7(now),
      name: input.name,
      occurred_at: input.occurredAt ?? now,
      received_at: now,
      user_id: input.userId ?? null,
      anonymous_id: input.anonymousId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      props_json: JSON.stringify(redactProps(input.props)),
      request_id: input.requestId ?? null,
      app_version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    })
    .execute();
}
