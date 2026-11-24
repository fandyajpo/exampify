import "server-only";

import { sql, type Kysely, type Transaction } from "kysely";

import { recordAudit } from "@/lib/audit";
import { evaluateAssessmentGates, type AssessmentGateItem } from "@/lib/content/assessment-gates";
import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db/schema";
import { contentConflict, HttpError, notFound, slugTaken } from "@/lib/http/errors";
import { uuidv7 } from "@/lib/ids";
import type { Actor } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import type { GateDetail, GateResult } from "@/lib/validation/resources";
import type { ContentStatus } from "@/lib/validation/taxonomy";
import type {
  AssessmentAvailability,
  AssessmentCreateInput,
  AssessmentDetailDto,
  AssessmentDto,
  AssessmentItemInput,
  AssessmentItemDto,
  AssessmentListQuery,
  AssessmentMode,
  AssessmentUpdateInput,
} from "@/lib/validation/assessments";
import { decodeCursor, encodeCursor } from "@/lib/validation/cursor";

import { loadQuestionDetails } from "./questions-admin";

/**
 * Assessment reads and writes (`API_CONTRACTS.md` §7.3, `CONTENT_MODEL.md` §4.7).
 *
 * Scope is fixed at creation — a topic's practice set, or a subject-wide practice test — and
 * every item must sit inside it, so a published assessment can never draw on another
 * course's questions. `items` is replaced wholesale on save: order is part of the contract,
 * and a single-item patch would let the stored `question_count` drift.
 *
 * No public assessment route exists yet, so a slug change writes no redirect (Phase 4 adds
 * the `/practice/{slug}` page together with its redirect).
 */

type Db = Kysely<Database>;
type Trx = Transaction<Database>;
type Executor = Db | Trx;

const ISO = (ms: number): string => new Date(ms).toISOString();

type AssessmentRow = {
  id: string;
  topic_id: string | null;
  subject_id: string;
  scope_key: string;
  slug: string;
  title: string;
  description_md: string | null;
  mode: AssessmentMode;
  difficulty: "easy" | "medium" | "hard" | "very_hard";
  duration_seconds: number | null;
  question_count: number;
  status: ContentStatus;
  published_at: number | null;
  version: number;
  updated_by: string | null;
  updated_at: number;
};

const ASSESSMENT_COLUMNS = [
  "id",
  "topic_id",
  "subject_id",
  "scope_key",
  "slug",
  "title",
  "description_md",
  "mode",
  "difficulty",
  "duration_seconds",
  "question_count",
  "status",
  "published_at",
  "version",
  "updated_by",
  "updated_at",
] as const;

function validationError(details: GateDetail[]): HttpError {
  return new HttpError(422, "VALIDATION_ERROR", "Some fields need attention.", details);
}

function toAssessmentDto(row: AssessmentRow): AssessmentDto {
  return {
    id: row.id,
    topicId: row.topic_id,
    subjectId: row.subject_id,
    slug: row.slug,
    title: row.title,
    mode: row.mode,
    difficulty: row.difficulty,
    durationSeconds: row.duration_seconds,
    questionCount: row.question_count,
    status: row.status,
    publishedAt: row.published_at === null ? null : ISO(row.published_at),
    updatedAt: ISO(row.updated_at),
  };
}

async function loadAssessmentRow(executor: Executor, id: string): Promise<AssessmentRow | null> {
  const row = await executor
    .selectFrom("assessments")
    .select(ASSESSMENT_COLUMNS)
    .where("id", "=", id)
    .executeTakeFirst();
  return row ?? null;
}

async function slugTakenInScope(
  executor: Executor,
  scopeKey: string,
  slug: string,
  exceptId = "",
): Promise<boolean> {
  const row = await executor
    .selectFrom("assessments")
    .select("id")
    .where("scope_key", "=", scopeKey)
    .where("slug", "=", slug)
    .where("id", "!=", exceptId)
    .executeTakeFirst();
  return row !== undefined;
}

/**
 * The questions that may sit in `assessment_items`, and a field error for each one that may
 * not. Existence and scope are checked on write; publication is a publish gate, because a
 * draft set is allowed to reference draft questions.
 */
async function validateItems(
  executor: Executor,
  scope: { topicId: string | null; subjectId: string },
  items: readonly AssessmentItemInput[],
): Promise<void> {
  const details: GateDetail[] = [];

  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.questionId)) {
      details.push({
        path: `items.${index}.questionId`,
        code: "duplicate_question",
        message: "This question is already in the assessment.",
      });
    }
    seen.add(item.questionId);
  }

  const ids = [...seen];
  if (ids.length > 0) {
    const questions = await executor
      .selectFrom("questions")
      .select("id")
      .where("id", "in", ids)
      .execute();
    const found = new Set(questions.map((row) => row.id));

    const inScopeRows =
      scope.topicId !== null
        ? await executor
            .selectFrom("question_topics")
            .select("question_id")
            .where("topic_id", "=", scope.topicId)
            .where("question_id", "in", ids)
            .execute()
        : await executor
            .selectFrom("question_topics as qt")
            .innerJoin("topics as t", "t.id", "qt.topic_id")
            .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
            .select("qt.question_id")
            .where("ch.subject_id", "=", scope.subjectId)
            .where("qt.question_id", "in", ids)
            .execute();
    const inScope = new Set(inScopeRows.map((row) => row.question_id));

    for (const [index, item] of items.entries()) {
      if (!found.has(item.questionId)) {
        details.push({
          path: `items.${index}.questionId`,
          code: "question_missing",
          message: "That question no longer exists.",
        });
      } else if (!inScope.has(item.questionId)) {
        details.push({
          path: `items.${index}.questionId`,
          code: "question_out_of_scope",
          message: "Every question must belong to this assessment's topic or subject.",
        });
      }
    }
  }

  if (details.length > 0) throw validationError(details);
}

/** Omitted mode is `practice`; the merged mode is what the duration rules apply to. */
function durationError(mode: AssessmentMode, durationSeconds: number | null): GateDetail | null {
  if (mode === "practice") {
    return durationSeconds === null
      ? null
      : {
          path: "durationSeconds",
          code: "practice_is_untimed",
          message: "A practice set is untimed. Leave the duration blank or choose a timed mode.",
        };
  }
  return durationSeconds !== null && durationSeconds >= 60 && durationSeconds <= 10_800
    ? null
    : {
        path: "durationSeconds",
        code: "duration_required",
        message: "A timed set needs a duration between 60 and 10 800 seconds.",
      };
}

async function writeItems(
  trx: Trx,
  assessmentId: string,
  items: readonly AssessmentItemInput[],
  now: number,
): Promise<void> {
  await trx.deleteFrom("assessment_items").where("assessment_id", "=", assessmentId).execute();
  if (items.length > 0) {
    await trx
      .insertInto("assessment_items")
      .values(
        items.map((item, position) => ({
          id: uuidv7(now),
          assessment_id: assessmentId,
          question_id: item.questionId,
          position,
          points_x100_override: item.pointsOverride === undefined ? null : item.pointsOverride * 100,
        })),
      )
      .execute();
  }
  await trx
    .updateTable("assessments")
    .set({ question_count: items.length, updated_at: now })
    .where("id", "=", assessmentId)
    .execute();
}

async function detailFor(executor: Executor, id: string): Promise<AssessmentDetailDto> {
  const row = await loadAssessmentRow(executor, id);
  if (!row) throw notFound("assessment");

  const items = await executor
    .selectFrom("assessment_items")
    .select(["id", "question_id", "position", "points_x100_override"])
    .where("assessment_id", "=", id)
    .orderBy("position")
    .execute();

  const questions = await loadQuestionDetails(executor, items.map((item) => item.question_id));

  const itemDtos: AssessmentItemDto[] = [];
  for (const item of items) {
    const question = questions.get(item.question_id);
    if (!question) continue;
    itemDtos.push({
      id: item.id,
      questionId: item.question_id,
      position: item.position,
      pointsOverride: item.points_x100_override === null ? null : item.points_x100_override / 100,
      question,
    });
  }

  return { ...toAssessmentDto(row), descriptionMd: row.description_md, items: itemDtos };
}

export async function getAssessmentAdmin(id: string): Promise<AssessmentDetailDto | null> {
  const db = await getDb();
  const row = await loadAssessmentRow(db, id);
  return row ? detailFor(db, id) : null;
}

/** `GET /studio/assessments`: filters, newest-first by default, keyset paginated. */
export async function listAssessments(query: AssessmentListQuery): Promise<{
  data: AssessmentDto[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}> {
  const db = await getDb();
  const limit = query.limit ?? 20;
  const sort = query.sort ?? "updatedAt";
  const dir = query.dir ?? "desc";
  const column = sort === "updatedAt" ? "updated_at" : "created_at";

  let builder = db
    .selectFrom("assessments")
    .select([...ASSESSMENT_COLUMNS, "created_at"])
    .orderBy(sql.ref(column), dir)
    .orderBy(sql.ref("id"), dir)
    .limit(limit + 1);

  if (query.topicId) builder = builder.where("topic_id", "=", query.topicId);
  if (query.subjectId) builder = builder.where("subject_id", "=", query.subjectId);
  if (query.mode) builder = builder.where("mode", "=", query.mode);
  if (query.status) builder = builder.where("status", "=", query.status);
  if (query.q) builder = builder.where("title", "like", `%${query.q}%`);

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    builder = builder.where(
      sql<boolean>`(${sql.ref(column)}, ${sql.ref("id")}) ${sql.raw(dir === "asc" ? ">" : "<")} (${cursor.k}, ${cursor.id})`,
    );
  }

  const rows = await builder.execute();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    data: page.map((row) => toAssessmentDto(row as AssessmentRow)),
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({ k: sort === "updatedAt" ? last.updated_at : last.created_at, id: last.id })
          : null,
    },
  };
}

export async function createAssessment(
  actor: Actor,
  input: AssessmentCreateInput,
): Promise<AssessmentDetailDto> {
  const db = await getDb();
  const now = Date.now();
  const mode = input.mode ?? "practice";
  const duration = input.durationSeconds ?? null;

  const durationProblem = durationError(mode, duration);
  if (durationProblem) throw validationError([durationProblem]);

  return db.transaction().execute(async (trx) => {
    const subject = await trx
      .selectFrom("subjects")
      .select("id")
      .where("id", "=", input.subjectId)
      .executeTakeFirst();
    if (!subject) throw notFound("subject");

    if (input.topicId) {
      const topic = await trx
        .selectFrom("topics as t")
        .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
        .select(["t.id", "ch.subject_id"])
        .where("t.id", "=", input.topicId)
        .executeTakeFirst();
      if (!topic) throw notFound("topic");
      if (topic.subject_id !== input.subjectId) {
        throw validationError([
          {
            path: "topicId",
            code: "topic_subject_mismatch",
            message: "That topic belongs to another subject.",
          },
        ]);
      }
    }

    const slug = input.slug ?? slugify(input.title);
    if (!slug) {
      throw validationError([
        { path: "slug", code: "invalid_slug", message: "Add a slug: the title produced an empty one." },
      ]);
    }

    const scopeKey = input.topicId ?? input.subjectId;
    if (await slugTakenInScope(trx, scopeKey, slug)) throw slugTaken();

    await validateItems(trx, { topicId: input.topicId ?? null, subjectId: input.subjectId }, input.items);

    const id = uuidv7(now);
    await trx
      .insertInto("assessments")
      .values({
        id,
        topic_id: input.topicId ?? null,
        subject_id: input.subjectId,
        scope_key: scopeKey,
        slug,
        title: input.title,
        description_md: input.descriptionMd ?? null,
        mode,
        difficulty: input.difficulty ?? "medium",
        duration_seconds: duration,
        question_count: 0,
        status: "draft",
        published_at: null,
        version: 1,
        created_by: actor.id,
        updated_by: actor.id,
        created_at: now,
        updated_at: now,
      })
      .execute();

    await writeItems(trx, id, input.items, now);

    await recordAudit(
      {
        actorId: actor.id,
        action: "assessment.create",
        entityType: "assessment",
        entityId: id,
        metadata: { mode, topicId: input.topicId ?? input.subjectId, items: input.items.length },
      },
      trx,
    );

    return detailFor(trx, id);
  });
}

export async function updateAssessment(
  actor: Actor,
  id: string,
  input: AssessmentUpdateInput,
): Promise<AssessmentDetailDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await loadAssessmentRow(trx, id);
    if (!existing) throw notFound("assessment");
    if (existing.updated_at !== Date.parse(input.expectedUpdatedAt)) {
      throw contentConflict({
        currentUpdatedAt: ISO(existing.updated_at),
        currentUpdatedBy: existing.updated_by,
      });
    }

    const mode = input.mode ?? existing.mode;
    const duration =
      input.durationSeconds === undefined ? existing.duration_seconds : (input.durationSeconds ?? null);
    const durationProblem = durationError(mode, duration);
    if (durationProblem) throw validationError([durationProblem]);

    if (input.slug !== undefined && input.slug !== existing.slug) {
      if (await slugTakenInScope(trx, existing.scope_key, input.slug, id)) throw slugTaken();
    }

    if (input.items !== undefined) {
      await validateItems(trx, { topicId: existing.topic_id, subjectId: existing.subject_id }, input.items);
    }

    const now = Date.now();
    await trx
      .updateTable("assessments")
      .set({
        slug: input.slug ?? existing.slug,
        title: input.title ?? existing.title,
        description_md: input.descriptionMd === undefined ? existing.description_md : input.descriptionMd,
        mode,
        difficulty: input.difficulty ?? existing.difficulty,
        duration_seconds: duration,
        updated_by: actor.id,
        updated_at: now,
      })
      .where("id", "=", id)
      .execute();

    if (input.items !== undefined) await writeItems(trx, id, input.items, now);

    await recordAudit(
      {
        actorId: actor.id,
        action: "assessment.update",
        entityType: "assessment",
        entityId: id,
        metadata: {
          fields: [
            ...(input.slug ? ["slug"] : []),
            ...(input.title ? ["title"] : []),
            ...(input.descriptionMd !== undefined ? ["descriptionMd"] : []),
            ...(input.mode ? ["mode"] : []),
            ...(input.difficulty ? ["difficulty"] : []),
            ...(input.durationSeconds !== undefined ? ["durationSeconds"] : []),
            ...(input.items ? ["items"] : []),
          ],
        },
      },
      trx,
    );

    return detailFor(trx, id);
  });
}

/** `POST /studio/assessments/{id}/duplicate`: a draft copy, items by reference (§7.3). */
export async function duplicateAssessment(actor: Actor, id: string): Promise<AssessmentDetailDto> {
  const db = await getDb();
  const now = Date.now();

  return db.transaction().execute(async (trx) => {
    const source = await loadAssessmentRow(trx, id);
    if (!source) throw notFound("assessment");

    let slug = `${source.slug}-copy`;
    for (let attempt = 2; await slugTakenInScope(trx, source.scope_key, slug); attempt += 1) {
      slug = `${source.slug}-copy-${attempt}`;
    }

    const copyId = uuidv7(now);
    await trx
      .insertInto("assessments")
      .values({
        ...source,
        id: copyId,
        slug,
        status: "draft",
        published_at: null,
        version: 1,
        created_by: actor.id,
        updated_by: actor.id,
        created_at: now,
        updated_at: now,
      })
      .execute();

    const items = await trx
      .selectFrom("assessment_items")
      .select(["question_id", "position", "points_x100_override"])
      .where("assessment_id", "=", id)
      .orderBy("position")
      .execute();

    if (items.length > 0) {
      await trx
        .insertInto("assessment_items")
        .values(
          items.map((item, position) => ({
            id: uuidv7(now),
            assessment_id: copyId,
            question_id: item.question_id,
            position,
            points_x100_override: item.points_x100_override,
          })),
        )
        .execute();
    }

    await recordAudit(
      {
        actorId: actor.id,
        action: "assessment.duplicate",
        entityType: "assessment",
        entityId: copyId,
        metadata: { copiedFromId: id, items: items.length },
      },
      trx,
    );

    return detailFor(trx, copyId);
  });
}

/** `GET …/availability`: how many questions the composer's scope can draw on, by slice. */
export async function getAssessmentAvailability(id: string): Promise<AssessmentAvailability> {
  const db = await getDb();
  const assessment = await db
    .selectFrom("assessments")
    .select(["topic_id", "subject_id"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!assessment) throw notFound("assessment");

  let builder = db
    .selectFrom("question_topics as qt")
    .innerJoin("questions as q", "q.id", "qt.question_id")
    .innerJoin("topics as t", "t.id", "qt.topic_id")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .select(({ fn }) => [
      "q.status",
      "q.question_type",
      "q.difficulty",
      fn.count<number>("q.id").distinct().as("count"),
    ])
    .groupBy(["q.status", "q.question_type", "q.difficulty"]);

  builder =
      assessment.topic_id === null
        ? builder.where("ch.subject_id", "=", assessment.subject_id)
        : builder.where("qt.topic_id", "=", assessment.topic_id);

  const rows = await builder.execute();

  let total = 0;
  let published = 0;
  let draft = 0;
  const byType: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};

  for (const row of rows) {
    const count = Number(row.count);
    total += count;
    if (row.status === "published") published += count;
    if (row.status === "draft" || row.status === "in_review") draft += count;
    byType[row.question_type] = (byType[row.question_type] ?? 0) + count;
    byDifficulty[row.difficulty] = (byDifficulty[row.difficulty] ?? 0) + count;
  }

  return {
    scope: { topicId: assessment.topic_id, subjectId: assessment.subject_id },
    total,
    published,
    draft,
    byType,
    byDifficulty,
  };
}

/**
 * Everything §10.2 needs: the row, its items with their question status, and whether each
 * question is in scope. One extra query resolves scope membership, never one per item.
 */
export async function loadAssessmentGates(executor: Executor, id: string): Promise<GateResult | null> {
  const row = await executor
    .selectFrom("assessments")
    .select(["mode", "duration_seconds", "question_count", "topic_id", "subject_id"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) return null;

  const items = await executor
    .selectFrom("assessment_items as ai")
    .innerJoin("questions as q", "q.id", "ai.question_id")
    .select(["ai.question_id", "ai.points_x100_override", "q.status"])
    .where("ai.assessment_id", "=", id)
    .orderBy("ai.position")
    .execute();

  const questionIds = items.map((item) => item.question_id);
  const scopeRows =
    questionIds.length === 0
      ? []
      : row.topic_id !== null
        ? await executor
            .selectFrom("question_topics")
            .select("question_id")
            .where("topic_id", "=", row.topic_id)
            .where("question_id", "in", questionIds)
            .execute()
        : await executor
            .selectFrom("question_topics as qt")
            .innerJoin("topics as t", "t.id", "qt.topic_id")
            .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
            .select("qt.question_id")
            .where("ch.subject_id", "=", row.subject_id)
            .where("qt.question_id", "in", questionIds)
            .execute();
  const inScope = new Set(scopeRows.map((scope) => scope.question_id));

  const gateItems: AssessmentGateItem[] = items.map((item) => ({
    questionId: item.question_id,
    status: item.status,
    inScope: inScope.has(item.question_id),
    pointsOverrideX100: item.points_x100_override,
  }));

  const blocking = evaluateAssessmentGates({
    mode: row.mode,
    durationSeconds: row.duration_seconds,
    questionCount: row.question_count,
    items: gateItems,
  });

  return { passing: blocking.length === 0, blocking, warnings: [] };
}

/** `POST /studio/assessments/{id}/validate`: the dry run, reusing the publish gate exactly. */
export async function validateAssessment(id: string): Promise<GateResult> {
  const db = await getDb();
  const result = await loadAssessmentGates(db, id);
  if (!result) throw notFound("assessment");
  return result;
}
