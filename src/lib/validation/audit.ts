import { z } from "zod";

import type { AuditEntityType } from "@/lib/audit";

/**
 * Audit log query and response shapes (`API_CONTRACTS.md` §7.7).
 *
 * The row itself is append-only and written by `recordAudit()`; this module only describes
 * how the trail is read back. `metadata` is JSON text in SQLite, so it is parsed here — a
 * corrupt row must not break the whole page, and it never carries a value, only field names.
 */

/** Mirrors `AuditEntityType`; `satisfies` fails the build if the union gains a member. */
export const AUDIT_ENTITY_TYPES = [
  "curriculum",
  "level",
  "subject",
  "chapter",
  "topic",
  "resource",
  "media",
] as const satisfies readonly AuditEntityType[];

/** An ISO-8601 date or timestamp; anything `Date.parse` cannot read is a `422`. */
const timestamp = z
  .string()
  .trim()
  .min(8)
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Use an ISO-8601 date or timestamp.");

/** Both id filters are the same opaque shape, so they are bounded in one place. */
const rowId = z.string().trim().min(1).max(64);

export const auditListQuerySchema = z
  .object({
    entityType: z.enum(AUDIT_ENTITY_TYPES).optional(),
    entityId: rowId.optional(),
    actorId: rowId.optional(),
    from: timestamp.optional(),
    to: timestamp.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(512).optional(),
  })
  .strict();

export const auditLogDtoSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const auditListSchema = z.object({
  data: z.array(auditLogDtoSchema),
  nextCursor: z.string().nullable(),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
export type AuditLogDto = z.infer<typeof auditLogDtoSchema>;
export type AuditListPage = z.infer<typeof auditListSchema>;

/** A row's `metadata` as an object; anything unparseable is treated as empty. */
export function parseAuditMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}
