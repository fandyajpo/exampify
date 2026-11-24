import "server-only";

import { auditActorScope } from "@/lib/audit/scope";
import { getDb } from "@/lib/db";
import type { AuditLogsTable } from "@/lib/db/schema";
import type { Actor } from "@/lib/rbac";
import { parseAuditMetadata, type AuditListPage, type AuditListQuery, type AuditLogDto } from "@/lib/validation/audit";
import { decodeCursor, encodeCursor } from "@/lib/validation/cursor";

/**
 * The read side of `audit_logs` (`API_CONTRACTS.md` §7.7, `DATABASE_SCHEMA.md` §10.6).
 *
 * The table is append-only, so this module has no write path: rows arrive from
 * `recordAudit()` inside the mutation that made them. Reading is row-scoped, not just
 * endpoint-scoped (`SECURITY_AND_PERMISSIONS.md` §6): `admin` sees every actor, an `author`
 * or `reviewer` sees only their own rows, and asking for someone else is a `403` rather
 * than a silently narrowed page.
 */

const AUDIT_COLUMNS = [
  "id",
  "actor_id",
  "action",
  "entity_type",
  "entity_id",
  "metadata",
  "created_at",
] as const;

type AuditRow = Pick<AuditLogsTable, (typeof AUDIT_COLUMNS)[number]>;

function toDto(row: AuditRow): AuditLogDto {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: parseAuditMetadata(row.metadata),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** `GET /studio/audit`: newest first, keyed on `(created_at, id)` like every studio list. */
export async function listAuditLogs(actor: Actor, query: AuditListQuery): Promise<AuditListPage> {
  const db = await getDb();
  const actorId = auditActorScope(actor, query.actorId);

  let builder = db.selectFrom("audit_logs").select(AUDIT_COLUMNS);

  if (actorId) builder = builder.where("actor_id", "=", actorId);
  if (query.entityType) builder = builder.where("entity_type", "=", query.entityType);
  if (query.entityId) builder = builder.where("entity_id", "=", query.entityId);
  if (query.from) builder = builder.where("created_at", ">=", Date.parse(query.from));
  if (query.to) builder = builder.where("created_at", "<=", Date.parse(query.to));

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    const createdAt = Number(cursor.k);
    builder = builder.where((eb) =>
      eb.or([
        eb("created_at", "<", createdAt),
        eb.and([eb("created_at", "=", createdAt), eb("id", "<", cursor.id)]),
      ]),
    );
  }

  const rows = await builder
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(query.limit + 1)
    .execute();

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    data: page.map(toDto),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({ k: last.created_at, id: last.id })
        : null,
  };
}
