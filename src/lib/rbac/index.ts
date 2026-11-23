/**
 * `lib/rbac` — the capability matrix and `can()`
 * ([SECURITY_AND_PERMISSIONS.md](../../../docs/SECURITY_AND_PERMISSIONS.md) §3).
 *
 * `can()` is the only authorization primitive in the codebase: route handlers call it
 * before loading data, services re-check with the loaded row. The matrix is written out
 * per capability rather than derived from a role rank, because a rank silently grants every
 * future capability to every higher role; adding a capability must be a deliberate edit.
 *
 * A missing capability denies. Nothing here throws: `can()` is a predicate, and the
 * `401`/`403` conversion belongs to the HTTP layer (`lib/http/studio.ts`).
 */

export const ROLES = ["student", "author", "reviewer", "admin"] as const;

export type Role = (typeof ROLES)[number];

/** Column values are free text in Better Auth's table, so a stored role is validated. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** The matrix of §3.1, verbatim. `audit:read:own` is what an author or reviewer may do. */
export const CAPABILITIES = {
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
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

/** What the guards need from a resolved session; identity fields stay in `lib/auth`. */
export type Actor = {
  id: string;
  role: Role;
};

/**
 * `true` only when the actor's role is listed for the capability. An unknown capability is
 * a programming error, and denying it is the safe direction.
 */
export function can(actor: Actor, capability: Capability): boolean {
  const allowed: readonly Role[] | undefined = CAPABILITIES[capability];
  return allowed ? allowed.includes(actor.role) : false;
}
