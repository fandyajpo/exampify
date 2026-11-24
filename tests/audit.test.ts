import { describe, expect, it } from "vitest";

import { auditActorScope } from "@/lib/audit/scope";
import type { HttpError } from "@/lib/http/errors";
import { auditListQuerySchema, parseAuditMetadata } from "@/lib/validation/audit";

/**
 * The audit trail's read rules (`API_CONTRACTS.md` §7.7, `SECURITY_AND_PERMISSIONS.md` §6,
 * `DATABASE_SCHEMA.md` §10.6).
 *
 * The important cases are the denials: an author never reads someone else's actions, and a
 * student never reaches the trail at all. The query schema is checked because an unknown
 * filter must be refused rather than quietly ignored.
 */

const admin = { id: "admin-1", role: "admin" as const };
const author = { id: "author-1", role: "author" as const };
const reviewer = { id: "reviewer-1", role: "reviewer" as const };
const student = { id: "student-1", role: "student" as const };

/** The refusal `auditActorScope` throws, or `null` when it allowed the request. */
function scopeError(actor: Parameters<typeof auditActorScope>[0], requestedActorId?: string) {
  try {
    auditActorScope(actor, requestedActorId);
    return null;
  } catch (error) {
    return error as HttpError;
  }
}

describe("auditActorScope", () => {
  it("lets an admin read everyone or narrow to one actor", () => {
    expect(auditActorScope(admin)).toBeUndefined();
    expect(auditActorScope(admin, author.id)).toBe(author.id);
  });

  it("scopes an author and a reviewer to their own rows", () => {
    expect(auditActorScope(author)).toBe(author.id);
    expect(auditActorScope(reviewer)).toBe(reviewer.id);
    expect(auditActorScope(author, author.id)).toBe(author.id);
  });

  it("refuses an author asking for another actor's rows", () => {
    const error = scopeError(author, reviewer.id);
    expect(error?.status).toBe(403);
    expect(error?.code).toBe("FORBIDDEN");
  });

  it("refuses a student outright, even for their own id", () => {
    expect(scopeError(student)?.status).toBe(403);
    expect(scopeError(student, student.id)?.status).toBe(403);
  });
});

describe("auditListQuerySchema", () => {
  it("defaults the page size and accepts the documented filters", () => {
    expect(auditListQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(
      auditListQuerySchema.parse({
        entityType: "resource",
        entityId: "018f",
        actorId: "abc",
        from: "2026-01-01",
        to: "2026-11-24T10:00:00Z",
      }),
    ).toEqual({
      entityType: "resource",
      entityId: "018f",
      actorId: "abc",
      from: "2026-01-01",
      to: "2026-11-24T10:00:00Z",
      limit: 20,
    });
  });

  it("rejects an unknown filter, an unknown entity type and a bad date", () => {
    expect(auditListQuerySchema.safeParse({ action: "resource.update" }).success).toBe(false);
    expect(auditListQuerySchema.safeParse({ entityType: "user" }).success).toBe(false);
    expect(auditListQuerySchema.safeParse({ from: "yesterday" }).success).toBe(false);
    expect(auditListQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
  });
});

describe("parseAuditMetadata", () => {
  it("parses a stored object and rejects everything else to an empty object", () => {
    expect(parseAuditMetadata('{"fields":["title"]}')).toEqual({ fields: ["title"] });
    expect(parseAuditMetadata("not json")).toEqual({});
    expect(parseAuditMetadata("[1,2]")).toEqual({});
    expect(parseAuditMetadata("null")).toEqual({});
  });
});
