import "server-only";

import { LibsqlDialect, type libsql } from "@libsql/kysely-libsql";
import { createClient, type Config } from "@libsql/client";
import { Kysely } from "kysely";

import { env } from "@/lib/env";
import type { Database } from "./schema";

/**
 * `lib/db` — the one libSQL client for the process, over Kysely.
 *
 * Pragmas are applied once per connection because the driver gives no `afterConnect` hook
 * (`TECHNICAL_STANDARDS.md` §4.3, `db/schema.phase1.sql` header): `busy_timeout` first,
 * so contention waits instead of failing, then the mandatory `foreign_keys`.
 *
 * `journal_mode = WAL` is deliberately **not** set here: it is a property of the database
 * file, and issuing it needs an exclusive lock, which several build workers opening the
 * same file at once turn into `SQLITE_BUSY`. `scripts/db-migrate.ts` sets it once.
 *
 * Nothing else in the app constructs a client: `lib/services/*` calls `getDb()`, and no
 * component may import this module (`TECHNICAL_STANDARDS.md` §4.3).
 */

function createLibsqlClient(): ReturnType<typeof createClient> {
  const url = env.TURSO_DATABASE_URL;
  const authToken = env.TURSO_AUTH_TOKEN;

  const config: Config = authToken ? { url, authToken } : { url };
  return createClient(config);
}

const client = createLibsqlClient();

const ready: Promise<void> = (async () => {
  // Connection pragmas are a local-file concern. A remote libSQL database rejects them with
  // `SQL_PARSE_ERROR: SQL not allowed statement` and already enforces foreign keys
  // server-side, so sending them over HTTP would fail every read (`TECHNICAL_STANDARDS.md` §4.3).
  if (!env.TURSO_DATABASE_URL.startsWith("file:")) return;
  await client.execute("PRAGMA busy_timeout = 5000");
  await client.execute("PRAGMA foreign_keys = ON");
})();

/**
 * `@libsql/kysely-libsql` 0.4.1 (the current release) still types against
 * `@libsql/client` 0.8 while the app pins 0.18. The two differ only in the return type of
 * `sync()`, which the dialect never calls; `execute`, `batch` and `transaction` are
 * runtime-compatible. The cast keeps a single client so the pragmas above apply to every
 * query the dialect runs.
 */
const db = new Kysely<Database>({
  dialect: new LibsqlDialect({ client: client as unknown as libsql.Client }),
});

/** The shared Kysely instance, once the connection pragmas have been applied. */
export async function getDb(): Promise<Kysely<Database>> {
  await ready;
  return db;
}

/**
 * `GET /api/v1/health` probe: one round trip, never a throw. Reporting `down` is the point
 * of the endpoint, so a connection refusal must not become a 500 with a stack trace in it.
 */
export async function probeDatabase(): Promise<boolean> {
  try {
    await ready;
    await client.execute("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * The database handle Better Auth's Kysely adapter expects. It uses the same client, so
 * auth queries share the connection pragmas above; `lib/auth/server.ts` is the only
 * caller, and this stays in `lib/db` because importing `@libsql/*` elsewhere is what
 * `TECHNICAL_STANDARDS.md` §4.3 forbids.
 */
export function getAuthDatabase(): { dialect: LibsqlDialect; type: "sqlite" } {
  return {
    dialect: new LibsqlDialect({ client: client as unknown as libsql.Client }),
    type: "sqlite",
  };
}
