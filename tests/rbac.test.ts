import { describe, expect, it } from "vitest";

import { can, CAPABILITIES, isRole, ROLES, type Capability } from "@/lib/rbac";

/**
 * The capability matrix (`SECURITY_AND_PERMISSIONS.md` §3.1).
 *
 * The important cases are the denials: an author never publishes, a student never reaches
 * the studio, and a reviewer never touches taxonomy or users. Those are the ones a role
 * hierarchy gets wrong by accident.
 */

describe("capability matrix", () => {
  it("only names roles that exist", () => {
    for (const [capability, roles] of Object.entries(CAPABILITIES)) {
      for (const role of roles) expect(ROLES, capability).toContain(role);
    }
  });

  it("grants each capability to exactly the documented roles", () => {
    const expected: Record<Capability, string[]> = {
      "content:read:studio": ["author", "reviewer", "admin"],
      "content:write": ["author", "reviewer", "admin"],
      "content:submit": ["author", "reviewer", "admin"],
      "content:publish": ["reviewer", "admin"],
      "content:unpublish": ["reviewer", "admin"],
      "content:archive": ["author", "reviewer", "admin"],
      "taxonomy:write": ["admin"],
      "content:move": ["admin"],
      "media:write": ["author", "reviewer", "admin"],
      "users:manage": ["admin"],
      "audit:read:all": ["admin"],
      "audit:read:own": ["author", "reviewer"],
    };

    expect(Object.keys(CAPABILITIES).sort()).toEqual(Object.keys(expected).sort());

    for (const role of ROLES) {
      const granted = (Object.keys(expected) as Capability[]).filter((capability) =>
        expected[capability].includes(role),
      );
      const actual = (Object.keys(CAPABILITIES) as Capability[]).filter((capability) =>
        can({ id: "u", role }, capability),
      );
      expect(actual, role).toEqual(granted);
    }
  });

  it("denies a student the studio and the audit trail", () => {
    const student = { id: "u", role: "student" as const };
    expect(can(student, "content:read:studio")).toBe(false);
    expect(can(student, "content:write")).toBe(false);
    expect(can(student, "audit:read:own")).toBe(false);
  });

  it("never lets an author publish, and never lets a reviewer manage users or taxonomy", () => {
    const author = { id: "u", role: "author" as const };
    const reviewer = { id: "u", role: "reviewer" as const };

    expect(can(author, "content:publish")).toBe(false);
    expect(can(author, "taxonomy:write")).toBe(false);
    expect(can(reviewer, "content:publish")).toBe(true);
    expect(can(reviewer, "taxonomy:write")).toBe(false);
    expect(can(reviewer, "users:manage")).toBe(false);
  });

  it("denies a capability nobody granted", () => {
    const admin = { id: "u", role: "admin" as const };
    expect(can(admin, "not:a:capability" as Capability)).toBe(false);
  });

  it("validates stored roles instead of trusting the column", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});
