import "server-only";

import { sql, type Transaction } from "kysely";

import { recordAudit, type AuditEntityType } from "@/lib/audit";
import { resolveTransition } from "@/lib/content/lifecycle";
import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db/schema";
import { HttpError, notFound, type ErrorDetail } from "@/lib/http/errors";
import { uuidv7 } from "@/lib/ids";
import type { Actor } from "@/lib/rbac";
import { loadAssessmentGates } from "@/lib/services/assessments-admin";
import { loadQuestionGates } from "@/lib/services/questions-admin";
import { loadResourceGates } from "@/lib/services/resources-admin";
import type { ContentStatus } from "@/lib/validation/taxonomy";
import type { TransitionEntity, TransitionInput, TransitionResult } from "@/lib/validation/transitions";

/**
 * `POST /api/v1/studio/{entity}/{id}/transition` (`API_CONTRACTS.md` §7.5,
 * `CONTENT_MODEL.md` §6).
 *
 * The rules live in `lib/content/lifecycle`; this module is the write side of them. Every
 * transition, its audit row and its search event share one transaction, so a published row
 * can never exist without the index event that tells the search worker about it (ADR-021) —
 * and a rejected gate leaves nothing behind.
 *
 * `BEGIN IMMEDIATE` is what `PRODUCT_ARCHITECTURE.md` §6 asks for at publish, because two
 * concurrent publishes of the same row would otherwise both read `in_review` and both write.
 */

type Trx = Transaction<Database>;

const ISO = (ms: number): string => new Date(ms).toISOString();

/** Singular names: the audit `entity_type`, the search `entity_type` and the error label. */
const ENTITY_NAME = {
  curricula: "curriculum",
  levels: "level",
  subjects: "subject",
  chapters: "chapter",
  topics: "topic",
  resources: "resource",
  questions: "question",
  assessments: "assessment",
} as const satisfies Record<TransitionEntity, AuditEntityType>;

type LoadedRow = {
  status: ContentStatus;
  publishedAt: number | null;
  ownerId: string | null;
};

async function loadRow(trx: Trx, entity: TransitionEntity, id: string): Promise<LoadedRow | null> {
  if (entity === "curricula") {
    const row = await trx
      .selectFrom("curricula")
      .select(["status"])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? { status: row.status, publishedAt: null, ownerId: null } : null;
  }

  if (entity === "levels") {
    const row = await trx
      .selectFrom("education_levels")
      .select(["status"])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? { status: row.status, publishedAt: null, ownerId: null } : null;
  }

  if (entity === "subjects") {
    const row = await trx
      .selectFrom("subjects")
      .select(["status", "published_at", "created_by"])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? { status: row.status, publishedAt: row.published_at, ownerId: row.created_by } : null;
  }

  if (entity === "chapters") {
    const row = await trx
      .selectFrom("chapters")
      .select(["status", "published_at", "created_by"])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? { status: row.status, publishedAt: row.published_at, ownerId: row.created_by } : null;
  }

  if (entity === "resources") {
    const row = await trx
      .selectFrom("learning_resources")
      .select(["status", "published_at", "created_by"])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? { status: row.status, publishedAt: row.published_at, ownerId: row.created_by } : null;
  }

  if (entity === "questions") {
    const row = await trx
      .selectFrom("questions")
      .select(["status", "published_at", "created_by"])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? { status: row.status, publishedAt: row.published_at, ownerId: row.created_by } : null;
  }

  if (entity === "assessments") {
    const row = await trx
      .selectFrom("assessments")
      .select(["status", "published_at", "created_by"])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? { status: row.status, publishedAt: row.published_at, ownerId: row.created_by } : null;
  }

  const row = await trx
    .selectFrom("topics")
    .select(["status", "published_at", "created_by"])
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? { status: row.status, publishedAt: row.published_at, ownerId: row.created_by } : null;
}

async function writeStatus(
  trx: Trx,
  entity: TransitionEntity,
  id: string,
  status: ContentStatus,
  publishedAt: number | null,
  actor: Actor,
  now: number,
): Promise<void> {
  if (entity === "curricula") {
    await trx.updateTable("curricula").set({ status, updated_at: now }).where("id", "=", id).execute();
    return;
  }

  if (entity === "levels") {
    await trx
      .updateTable("education_levels")
      .set({ status, updated_at: now })
      .where("id", "=", id)
      .execute();
    return;
  }

  if (entity === "subjects") {
    await trx
      .updateTable("subjects")
      .set({ status, published_at: publishedAt, updated_at: now, updated_by: actor.id })
      .where("id", "=", id)
      .execute();
    return;
  }

  if (entity === "chapters") {
    await trx
      .updateTable("chapters")
      .set({ status, published_at: publishedAt, updated_at: now, updated_by: actor.id })
      .where("id", "=", id)
      .execute();
    return;
  }

  if (entity === "resources") {
    // §6: a publish increments `version`; a status-only move never does.
    await trx
      .updateTable("learning_resources")
      .set({
        status,
        published_at: publishedAt,
        updated_at: now,
        updated_by: actor.id,
        ...(status === "published" ? { version: sql<number>`version + 1` } : {}),
      })
      .where("id", "=", id)
      .execute();
    return;
  }

  if (entity === "questions") {
    // A publish bumps `version`; attempt items snapshot it (`QUESTION_ENGINE.md` §8).
    await trx
      .updateTable("questions")
      .set({
        status,
        published_at: publishedAt,
        updated_at: now,
        updated_by: actor.id,
        ...(status === "published" ? { version: sql<number>`version + 1` } : {}),
      })
      .where("id", "=", id)
      .execute();
    return;
  }

  if (entity === "assessments") {
    await trx
      .updateTable("assessments")
      .set({
        status,
        published_at: publishedAt,
        updated_at: now,
        updated_by: actor.id,
        ...(status === "published" ? { version: sql<number>`version + 1` } : {}),
      })
      .where("id", "=", id)
      .execute();
    return;
  }

  await trx
    .updateTable("topics")
    .set({ status, published_at: publishedAt, updated_at: now, updated_by: actor.id })
    .where("id", "=", id)
    .execute();
}

function gateFailed(details: ErrorDetail[]): HttpError {
  return new HttpError(422, "PUBLISH_GATE_FAILED", "This isn't ready to publish yet.", details);
}

/**
 * The publish gates of `CONTENT_MODEL.md` §4: a page is only publishable when something
 * would actually be on it. Curricula and levels define no gate — their child's gate is what
 * keeps an empty leaf off the site, and publishing a curriculum before its levels is legal.
 */
async function assertPublishGate(trx: Trx, entity: TransitionEntity, id: string): Promise<void> {
  if (entity === "curricula" || entity === "levels") return;

  if (entity === "subjects") {
    const chapter = await trx
      .selectFrom("chapters")
      .select("id")
      .where("subject_id", "=", id)
      .where("status", "=", "published")
      .executeTakeFirst();

    if (!chapter) {
      throw gateFailed([
        {
          path: "chapters",
          code: "no_published_chapters",
          message: "Publish at least one chapter of this subject first, or students land on an empty course.",
        },
      ]);
    }
    return;
  }

  if (entity === "resources") {
    const gates = await loadResourceGates(trx, id);
    if (!gates) throw notFound("resource");
    if (!gates.passing) throw gateFailed(gates.blocking);
    return;
  }

  if (entity === "questions") {
    const gates = await loadQuestionGates(trx, id);
    if (!gates) throw notFound("question");
    if (!gates.passing) throw gateFailed(gates.blocking);
    return;
  }

  if (entity === "assessments") {
    const gates = await loadAssessmentGates(trx, id);
    if (!gates) throw notFound("assessment");
    if (!gates.passing) throw gateFailed(gates.blocking);
    return;
  }

  if (entity === "chapters") {
    const topic = await trx
      .selectFrom("topics")
      .select("id")
      .where("chapter_id", "=", id)
      .where("status", "=", "published")
      .executeTakeFirst();

    if (!topic) {
      throw gateFailed([
        {
          path: "topics",
          code: "no_published_topics",
          message: "Publish at least one topic of this chapter first, or students land on an empty chapter.",
        },
      ]);
    }
    return;
  }

  const [row, resource, assessment] = await Promise.all([
    trx.selectFrom("topics").select(["summary"]).where("id", "=", id).executeTakeFirst(),
    trx
      .selectFrom("learning_resources")
      .select("id")
      .where("topic_id", "=", id)
      .where("status", "=", "published")
      .executeTakeFirst(),
    trx
      .selectFrom("assessments")
      .select("id")
      .where("topic_id", "=", id)
      .where("status", "=", "published")
      .executeTakeFirst(),
  ]);

  // Both checks run, so the author fixes the summary and the missing content in one pass
  // instead of discovering the second problem after the first publish attempt.
  const details: ErrorDetail[] = [];
  const summary = row?.summary?.trim() ?? "";
  if (summary.length < 40) {
    details.push({
      path: "summary",
      code: "summary_too_short",
      message: "A topic needs a summary of 40–320 characters to publish.",
    });
  }
  if (!resource && !assessment) {
    details.push({
      path: "resources",
      code: "no_published_content",
      message: "Publish a learning resource or an assessment for this topic first.",
    });
  }

  if (details.length > 0) throw gateFailed(details);
}

/** The transactional outbox row ADR-021 requires alongside a publish or unpublish. */
async function enqueueSearchEvent(
  trx: Trx,
  entityType: string,
  entityId: string,
  op: "upsert" | "delete",
  now: number,
): Promise<void> {
  await trx
    .insertInto("search_events")
    .values({
      id: uuidv7(now),
      entity_type: entityType,
      entity_id: entityId,
      op,
      status: "pending",
      attempts: 0,
      available_at: now,
      created_at: now,
      updated_at: now,
    })
    .execute();
}

export async function transitionEntity(
  entity: TransitionEntity,
  id: string,
  actor: Actor,
  input: TransitionInput,
): Promise<TransitionResult> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const now = Date.now();
    const row = await loadRow(trx, entity, id);
    if (!row) throw notFound(ENTITY_NAME[entity]);

    const resolution = resolveTransition(
      actor,
      { status: row.status, ownerId: row.ownerId },
      input.to,
      input.reason,
    );

    if (!resolution.ok) {
      if (resolution.code === "FORBIDDEN") throw new HttpError(403, "FORBIDDEN", resolution.message);
      throw new HttpError(422, resolution.code, resolution.message, [
        {
          path: resolution.code === "REASON_REQUIRED" ? "reason" : "to",
          code: resolution.code.toLowerCase(),
          message: resolution.message,
        },
      ]);
    }

    const { edge } = resolution;
    if (edge.gate) await assertPublishGate(trx, entity, id);

    // `published_at` is set exactly when entering `published` and cleared when leaving (§6).
    const hasPublishedAt =
      entity === "subjects" ||
      entity === "chapters" ||
      entity === "topics" ||
      entity === "resources" ||
      entity === "questions" ||
      entity === "assessments";
    const publishedAt = hasPublishedAt && edge.to === "published" ? now : null;

    await writeStatus(trx, entity, id, edge.to, publishedAt, actor, now);

    const name = ENTITY_NAME[entity];
    await recordAudit(
      {
        actorId: actor.id,
        action: `${name}.${edge.action}`,
        entityType: name,
        entityId: id,
        metadata: {
          from: row.status,
          to: edge.to,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      },
      trx,
    );

    // Questions are not indexed at all (`QUESTION_ENGINE.md` §12), so a publish writes no
    // search event for them even though the edge carries one.
    if (edge.search && entity !== "questions") {
      await enqueueSearchEvent(trx, name, id, edge.search, now);
    }

    return {
      entity,
      id,
      status: edge.to,
      publishedAt: publishedAt === null ? null : ISO(publishedAt),
      // No tag cache is attached to these pages yet (they revalidate on an interval), and
      // the search worker has not been built: both flags report what actually happened.
      cacheInvalidated: false,
      searchEnqueued: edge.search !== null && entity !== "questions",
    };
  });
}
