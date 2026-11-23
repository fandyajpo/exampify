import "server-only";

import { getDb } from "@/lib/db";
import { uuidv7 } from "@/lib/ids";

/**
 * `recordAudit()` — the one writer for `audit_logs` (`DATABASE_SCHEMA.md` §10.6,
 * `CONTENT_MODEL.md` §10 item 10): who changed what, when.
 *
 * `metadata` records field *names*, ids and transitions — never values, never an answer key,
 * never an email address (PRIV §5). The table is append-only for the runtime token, so a
 * correction is a new row, not an update.
 *
 * Callers pass the same transaction handle as the mutation so an audit row cannot outlive a
 * rolled-back write.
 */

export type AuditAction =
  | "curriculum.create"
  | "curriculum.update"
  | "curriculum.archive"
  | "curriculum.reorder"
  | "level.create"
  | "level.update"
  | "level.archive"
  | "level.reorder"
  | "subject.create"
  | "subject.update"
  | "subject.archive"
  | "subject.reorder"
  | "chapter.create"
  | "chapter.update"
  | "topic.create"
  | "topic.update"
  // Lifecycle verbs (`CONTENT_MODEL.md` §6). `direct_publish` is the admin-only shortcut
  // from draft; `restore` brings an archived row back as a draft.
  | "curriculum.submit"
  | "curriculum.return_to_draft"
  | "curriculum.publish"
  | "curriculum.direct_publish"
  | "curriculum.unpublish"
  | "curriculum.restore"
  | "level.submit"
  | "level.return_to_draft"
  | "level.publish"
  | "level.direct_publish"
  | "level.unpublish"
  | "level.restore"
  | "subject.submit"
  | "subject.return_to_draft"
  | "subject.publish"
  | "subject.direct_publish"
  | "subject.unpublish"
  | "subject.archive"
  | "subject.restore"
  | "chapter.submit"
  | "chapter.return_to_draft"
  | "chapter.publish"
  | "chapter.direct_publish"
  | "chapter.unpublish"
  | "chapter.archive"
  | "chapter.restore"
  | "topic.submit"
  | "topic.return_to_draft"
  | "topic.publish"
  | "topic.direct_publish"
  | "topic.unpublish"
  | "topic.archive"
  | "topic.restore"
  | "resource.create"
  | "resource.update"
  | "resource.duplicate"
  | "resource.block.create"
  | "resource.block.update"
  | "resource.block.delete"
  | "resource.block.reorder"
  | "resource.assessment.link"
  | "resource.assessment.unlink"
  | "resource.submit"
  | "resource.return_to_draft"
  | "resource.publish"
  | "resource.direct_publish"
  | "resource.unpublish"
  | "resource.archive"
  | "resource.restore";

export type AuditEntityType =
  | "curriculum"
  | "level"
  | "subject"
  | "chapter"
  | "topic"
  | "resource";

export type AuditEntry = {
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  /** Changed field names, transition or count — no values. */
  metadata?: Record<string, string | number | boolean | string[]>;
};

type Executor = Pick<Awaited<ReturnType<typeof getDb>>, "insertInto">;

export async function recordAudit(entry: AuditEntry, executor?: Executor): Promise<void> {
  const db = executor ?? (await getDb());

  await db
    .insertInto("audit_logs")
    .values({
      id: uuidv7(),
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: JSON.stringify(entry.metadata ?? {}),
      created_at: Date.now(),
    })
    .execute();
}
