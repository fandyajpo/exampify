import "server-only";

import type { Kysely, Transaction } from "kysely";

import { collapseTarget, matchRedirect } from "@/lib/content/redirects";
import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db/schema";
import { uuidv7 } from "@/lib/ids";
import { url } from "@/lib/urls";

/**
 * The `redirects` table (`DATABASE_SCHEMA.md` §10.5): written when a published path changes,
 * read by the public pages when a path no longer resolves.
 *
 * A redirect is written inside the transaction that renamed the row, so a slug change and its
 * 301 cannot disagree. Only published paths get one: a draft was never addressable.
 *
 * The App Router can only issue a permanent redirect with `permanentRedirect`, which answers
 * `308`; the table's `CHECK (status_code IN (301, 308))` allows exactly that. `308` is
 * permanent and method-preserving, so a slug change behaves as `FR-CMS-12` requires.
 */

type Db = Kysely<Database>;
type Executor = Db | Transaction<Database>;

export type RedirectReason = "slug_change" | "topic_moved" | "manual";

/** The path a missing URL should go to, or `null` when nothing was moved. */
export async function resolveRedirect(path: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.selectFrom("redirects").select(["source_path", "target_path"]).execute();
  return matchRedirect(rows, path);
}

/**
 * Writes or refreshes `sourcePath → targetPath`, collapsing chains: anything that pointed at
 * the retired path is re-pointed at the new one, so a second rename never leaves two hops.
 */
export async function writeRedirect(
  executor: Executor,
  input: { sourcePath: string; targetPath: string; reason: RedirectReason },
): Promise<void> {
  if (input.sourcePath === input.targetPath) return;

  const rows = await executor
    .selectFrom("redirects")
    .select(["source_path", "target_path"])
    .execute();

  // Renaming back to the retired slug cancels the earlier move. Keeping the old row would
  // point the address at a path that no longer exists, which §6 forbids outright.
  const reverse = rows.find(
    (row) => row.source_path === input.targetPath && row.target_path === input.sourcePath,
  );
  if (reverse) {
    await executor
      .deleteFrom("redirects")
      .where("source_path", "=", input.targetPath)
      .execute();
    return;
  }

  const targetPath = collapseTarget(rows, input.sourcePath, input.targetPath);
  if (!targetPath) return;

  await executor
    .updateTable("redirects")
    .set({ target_path: targetPath })
    .where("target_path", "=", input.sourcePath)
    .where("source_path", "!=", input.sourcePath)
    .execute();

  const existing = rows.find((row) => row.source_path === input.sourcePath);
  if (existing) {
    await executor
      .updateTable("redirects")
      .set({ target_path: targetPath, reason: input.reason })
      .where("source_path", "=", input.sourcePath)
      .execute();
    return;
  }

  await executor
    .insertInto("redirects")
    .values({
      id: uuidv7(),
      source_path: input.sourcePath,
      target_path: targetPath,
      status_code: 301,
      reason: input.reason,
      created_at: Date.now(),
    })
    .execute();
}

type Entity = "curriculum" | "level" | "subject" | "chapter" | "topic" | "resource";

/**
 * The public path of an entity with `slug` substituted for its stored one, resolved through
 * its ancestors. Called once before and once after a slug change, which is where the
 * redirect's two sides come from.
 */
export async function pathOf(
  executor: Executor,
  entity: Entity,
  id: string,
  slug: string,
): Promise<string | null> {
  if (entity === "curriculum") {
    const row = await executor
      .selectFrom("curricula")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? url.curriculum(slug) : null;
  }

  if (entity === "level") {
    const row = await executor
      .selectFrom("education_levels as l")
      .innerJoin("curricula as c", "c.id", "l.curriculum_id")
      .select(["c.slug as curriculum"])
      .where("l.id", "=", id)
      .executeTakeFirst();
    return row ? url.level(row.curriculum, slug) : null;
  }

  if (entity === "subject") {
    const row = await executor
      .selectFrom("subjects as s")
      .innerJoin("education_levels as l", "l.id", "s.education_level_id")
      .innerJoin("curricula as c", "c.id", "l.curriculum_id")
      .select(["c.slug as curriculum", "l.slug as level"])
      .where("s.id", "=", id)
      .executeTakeFirst();
    return row ? url.subject(row.curriculum, row.level, slug) : null;
  }

  if (entity === "chapter") {
    const row = await executor
      .selectFrom("chapters as ch")
      .innerJoin("subjects as s", "s.id", "ch.subject_id")
      .innerJoin("education_levels as l", "l.id", "s.education_level_id")
      .innerJoin("curricula as c", "c.id", "l.curriculum_id")
      .select(["c.slug as curriculum", "l.slug as level", "s.slug as subject"])
      .where("ch.id", "=", id)
      .executeTakeFirst();
    return row ? url.chapter(row.curriculum, row.level, row.subject, slug) : null;
  }

  if (entity === "topic") {
    const row = await executor
      .selectFrom("topics as t")
      .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
      .innerJoin("subjects as s", "s.id", "ch.subject_id")
      .innerJoin("education_levels as l", "l.id", "s.education_level_id")
      .innerJoin("curricula as c", "c.id", "l.curriculum_id")
      .select([
        "c.slug as curriculum",
        "l.slug as level",
        "s.slug as subject",
        "ch.slug as chapter",
      ])
      .where("t.id", "=", id)
      .executeTakeFirst();
    return row ? url.topic(row.curriculum, row.level, row.subject, row.chapter, slug) : null;
  }

  const row = await executor
    .selectFrom("learning_resources as r")
    .innerJoin("topics as t", "t.id", "r.topic_id")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      "c.slug as curriculum",
      "l.slug as level",
      "s.slug as subject",
      "ch.slug as chapter",
      "t.slug as topic",
    ])
    .where("r.id", "=", id)
    .executeTakeFirst();
  return row
    ? url.resource(row.curriculum, row.level, row.subject, row.chapter, row.topic, slug)
    : null;
}

/**
 * Records the move of `entity` from `oldSlug` to `newSlug` when the row was published. Called
 * after the update, so the new path is resolved from the row as it now stands.
 */
export async function redirectSlugChange(
  executor: Executor,
  entity: Entity,
  id: string,
  oldSlug: string,
  newSlug: string,
  wasPublished: boolean,
): Promise<void> {
  if (!wasPublished) return;

  // Sequential, because `executor` is usually a transaction and libSQL runs its statements
  // one at a time.
  const sourcePath = await pathOf(executor, entity, id, oldSlug);
  const targetPath = await pathOf(executor, entity, id, newSlug);
  if (!sourcePath || !targetPath) return;

  await writeRedirect(executor, { sourcePath, targetPath, reason: "slug_change" });
}
