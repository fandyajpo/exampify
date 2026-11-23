/**
 * `lib/db` barrel. The client is `server-only`; scripts that run outside the Next runtime
 * import `./schema` and `./seed-data` directly instead of this module.
 */
export { getDb } from "./client";
export type { ContentStatus, Database, Difficulty } from "./schema";
