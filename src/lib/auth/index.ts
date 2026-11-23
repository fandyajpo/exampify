import "server-only";

/**
 * `lib/auth` — the Better Auth instance plus the actor guards
 * ([PRODUCT_ARCHITECTURE.md](../../../docs/PRODUCT_ARCHITECTURE.md) §6,
 * [SECURITY_AND_PERMISSIONS.md](../../../docs/SECURITY_AND_PERMISSIONS.md) §4).
 *
 * `auth` is the library instance (configuration in `./server`); `getActor`,
 * `requireActor` and `requireCapability` turn its session cookie into the `Actor` the routes
 * and services authorize against. Authorization itself lives in `lib/rbac`.
 */
export { auth, type AuthSession } from "./server";
export { getActor, requireActor, requireCapability } from "./actor";
