import { can, type Actor } from "@/lib/rbac";
import { HttpError } from "@/lib/http/errors";

/**
 * Who a reader is allowed to see in the audit trail (`SECURITY_AND_PERMISSIONS.md` §6):
 * `admin` reads every actor, an `author` or `reviewer` only their own rows. Asking for
 * someone else is a `403`, not a silently narrowed page.
 *
 * Returns the `actor_id` filter to apply, or `undefined` for "everyone". Kept out of the
 * database service so the rule is testable on its own.
 */
export function auditActorScope(actor: Actor, requestedActorId?: string): string | undefined {
  if (can(actor, "audit:read:all")) return requestedActorId;
  if (!can(actor, "audit:read:own")) {
    throw new HttpError(403, "FORBIDDEN", "You cannot read the audit log.");
  }
  if (requestedActorId && requestedActorId !== actor.id) {
    throw new HttpError(403, "FORBIDDEN", "You can only read your own actions.");
  }
  return actor.id;
}
