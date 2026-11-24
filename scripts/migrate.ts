/**
 * Apply the SQL migrations in `db/` to the database in `TURSO_DATABASE_URL`.
 *
 * Runs outside the Next runtime, so it constructs its own libSQL client and never imports a
 * `server-only` module. Idempotent: each applied file is recorded in `schema_migrations` by
 * its id, and a re-run of an applied one is a no-op. Files are applied in list order, so
 * `phase2` never runs before `phase1`.
 *
 *   bun run db:migrate
 */
import { readFileSync } from "node:fs";
import { createClient, type Config } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  throw new Error("TURSO_DATABASE_URL is required (see .env.example).");
}

const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient((authToken ? { url, authToken } : { url }) as Config);

/** Applied in order; adding a migration is one entry plus its file. */
const MIGRATIONS = [
  { id: "phase1", file: "../db/schema.phase1.sql" },
  { id: "phase2", file: "../db/schema.phase2.sql" },
  // Slug-change redirects (`DATABASE_SCHEMA.md` §10.5) were the part of phase 2 that
  // depended on the studio's rename flow, so they ship as their own additive file.
  { id: "redirects", file: "../db/schema.redirects.sql" },
] as const;

function statementsFrom(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

await client.execute("PRAGMA foreign_keys = ON");

// WAL is a persistent property of a `file:` database, and only this script sets it: it
// needs an exclusive lock, which the app's several build workers must not contend for.
if (url.startsWith("file:")) {
  await client.execute("PRAGMA journal_mode = WAL");
}
await client.execute(
  "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
);

for (const migration of MIGRATIONS) {
  const applied = await client.execute({
    sql: "SELECT id FROM schema_migrations WHERE id = ?",
    args: [migration.id],
  });

  if (applied.rows.length > 0) {
    console.log(`migrate: ${migration.id} already applied, nothing to do`);
    continue;
  }

  const sql = readFileSync(new URL(migration.file, import.meta.url), "utf8");
  const statements = statementsFrom(sql).filter(
    // Journal mode and foreign-key enforcement are connection settings, not schema.
    (statement) => !/^PRAGMA\b/i.test(statement),
  );

  const transaction = await client.transaction("write");
  try {
    for (const statement of statements) {
      await transaction.execute(statement);
    }
    await transaction.execute({
      sql: "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
      args: [migration.id, Date.now()],
    });
    await transaction.commit();
    console.log(`migrate: applied ${migration.id} (${statements.length} statements)`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
);
console.log(`migrate: ${tables.rows.length} tables present`);
