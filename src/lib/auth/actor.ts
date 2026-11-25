import "server-only";

import { headers } from "next/headers";

import { HttpError, unauthenticated } from "@/lib/http/errors";
import { can, isRole, type Actor, type Capability } from "@/lib/rbac";

import { auth } from "./server";

/**
 * `getActor` / `requireActor` (`PRODUCT_ARCHITECTURE.md` §6, `SECURITY_AND_PERMISSIONS.md`
 * §4.3) — the one place a session cookie becomes an `Actor`.
 *
 * The session is read through Better Auth's own API, so the cookie's signature and expiry
 * are the library's problem. What remains is our policy: a suspended or soft-deleted account
 * resolves to nobody even with a live cookie, and an unrecognised stored role is treated as
 * the least privileged one.
 */

type SessionUser = {
  id: string;
  role?: string | null;
  status?: string | null;
  deletedAt?: number | null;
  emailVerified?: boolean | null;
};

/** The actor for this request, or `null` when there is no usable session. */
export async function getActor(): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = session.user as SessionUser;

  // `status` is nullable in the library's table; only "active" is a session we act on.
  if (user.deletedAt != null || (user.status != null && user.status !== "active")) return null;

  return { id: user.id, role: isRole(user.role) ? user.role : "student" };
}

/** The actor, or a `401`. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw unauthenticated();
  return actor;
}

/**
 * The actor, or the documented refusal when the address is not verified yet
 * (`API_CONTRACTS.md` §5, `SEC §4.3`). Sign-in is allowed before verification — practice is
 * what waits, so this is the gate every attempt endpoint goes through.
 */
export async function requireVerifiedActor(): Promise<Actor> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw unauthenticated();

  const user = session.user as SessionUser;
  if (user.deletedAt != null || (user.status != null && user.status !== "active")) {
    throw unauthenticated();
  }
  if (user.emailVerified !== true) {
    throw new HttpError(401, "EMAIL_NOT_VERIFIED", "Verify your email address to start practising.");
  }

  return { id: user.id, role: isRole(user.role) ? user.role : "student" };
}

/** The actor, or a `403` when the capability is missing (`SEC §3.1`: deny, never throw raw). */
export async function requireCapability(capability: Capability): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor, capability)) {
    throw new HttpError(403, "FORBIDDEN", "This account does not have access to that action.");
  }
  return actor;
}
