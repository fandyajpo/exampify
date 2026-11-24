import "server-only";

import { sql, type Kysely, type Transaction } from "kysely";

import { recordAudit } from "@/lib/audit";
import { evaluateQuestionGates, optionLabelErrors, questionKeyErrors } from "@/lib/content/question-gates";
import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db/schema";
import { contentConflict, HttpError, notFound } from "@/lib/http/errors";
import { uuidv7 } from "@/lib/ids";
import type { Actor } from "@/lib/rbac";
import type { GateDetail, GateResult } from "@/lib/validation/resources";
import type { ContentStatus } from "@/lib/validation/taxonomy";
import {
  answerKeySchema,
  type AnswerKey,
  type OptionLabel,
  type QuestionCreateInput,
  type QuestionDetailDto,
  type QuestionDto,
  type QuestionListQuery,
  type QuestionOptionDto,
  type QuestionOptionInput,
  type QuestionType,
  type QuestionUpdateInput,
} from "@/lib/validation/questions";

import { decodeCursor, encodeCursor } from "@/lib/validation/cursor";

/**
 * Studio question writes and reads (`API_CONTRACTS.md` §7.4, `QUESTION_ENGINE.md` §3).
 *
 * The answer key is the one scoring payload (ADR-004), so a write validates the key against
 * the options it names and the primary/secondary topic invariant in one transaction with the
 * row. Cross-listing lives in `question_topics`: exactly one primary row, equal to
 * `questions.topic_id`, with the partial unique index as the database's backstop.
 *
 * List projections never select `answer_key` or `explanation_md`; only the detail read does.
 */

type Db = Kysely<Database>;
type Trx = Transaction<Database>;
type Executor = Db | Trx;

const ISO = (ms: number): string => new Date(ms).toISOString();
const POINTS = (x100: number): number => x100 / 100;

type QuestionRow = {
  id: string;
  topic_id: string;
  question_type: QuestionType;
  stem_md: string;
  media_id: string | null;
  difficulty: "easy" | "medium" | "hard" | "very_hard";
  explanation_md: string;
  answer_key: string;
  points_x100: number;
  status: ContentStatus;
  published_at: number | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
};

const QUESTION_COLUMNS = [
  "id",
  "topic_id",
  "question_type",
  "stem_md",
  "media_id",
  "difficulty",
  "explanation_md",
  "answer_key",
  "points_x100",
  "status",
  "published_at",
  "version",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
] as const;

type QuestionOptionRow = {
  question_id: string;
  label: OptionLabel;
  content_md: string;
  feedback_md: string | null;
  position: number;
};

const OPTION_COLUMNS = ["question_id", "label", "content_md", "feedback_md", "position"] as const;

function validationError(details: GateDetail[]): HttpError {
  return new HttpError(422, "VALIDATION_ERROR", "Some fields need attention.", details);
}

function toQuestionDto(row: QuestionRow): QuestionDto {
  return {
    id: row.id,
    topicId: row.topic_id,
    type: row.question_type,
    stemMd: row.stem_md,
    difficulty: row.difficulty,
    points: POINTS(row.points_x100),
    status: row.status,
    publishedAt: row.published_at === null ? null : ISO(row.published_at),
    updatedAt: ISO(row.updated_at),
  };
}

function toOptionDto(row: QuestionOptionRow): QuestionOptionDto {
  return { label: row.label, contentMd: row.content_md, feedbackMd: row.feedback_md };
}

/** A stored key that no longer parses reads as absent; the publish gate refuses it. */
function parseStoredKey(raw: string): AnswerKey | null {
  try {
    const parsed = answerKeySchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The `true_false` options are generated, never authored (§7.4). */
const TRUE_FALSE_OPTIONS: QuestionOptionInput[] = [
  { label: "A", contentMd: "True" },
  { label: "B", contentMd: "False" },
];

/** A new draft needs a valid, if uninteresting, key; the editor replaces it. */
const SKELETON: Record<QuestionType, { options: QuestionOptionInput[]; answerKey: AnswerKey }> = {
  multiple_choice: {
    options: [
      { label: "A", contentMd: "Option A" },
      { label: "B", contentMd: "Option B" },
    ],
    answerKey: { v: 1, type: "multiple_choice", correct: "A" },
  },
  multiple_select: {
    options: [
      { label: "A", contentMd: "Option A" },
      { label: "B", contentMd: "Option B" },
    ],
    answerKey: { v: 1, type: "multiple_select", correct: ["A"], scoring: "all_or_nothing" },
  },
  true_false: {
    options: TRUE_FALSE_OPTIONS,
    answerKey: { v: 1, type: "true_false", correct: true },
  },
  short_answer: {
    options: [],
    answerKey: { v: 1, type: "short_answer", accepted: ["answer"] },
  },
};

function optionsFor(type: QuestionType, provided: QuestionOptionInput[] | undefined): QuestionOptionInput[] {
  if (type === "true_false") return TRUE_FALSE_OPTIONS;
  return provided ?? SKELETON[type].options;
}

async function loadQuestionRow(executor: Executor, id: string): Promise<QuestionRow | null> {
  const row = await executor
    .selectFrom("questions")
    .select(QUESTION_COLUMNS)
    .where("id", "=", id)
    .executeTakeFirst();
  return row ?? null;
}

async function optionsForQuestions(
  executor: Executor,
  ids: readonly string[],
): Promise<Map<string, QuestionOptionRow[]>> {
  if (ids.length === 0) return new Map();
  const rows = await executor
    .selectFrom("question_options")
    .select(OPTION_COLUMNS)
    .where("question_id", "in", ids as string[])
    .orderBy("question_id")
    .orderBy("position")
    .execute();

  const byQuestion = new Map<string, QuestionOptionRow[]>();
  for (const row of rows) {
    const list = byQuestion.get(row.question_id) ?? [];
    list.push(row);
    byQuestion.set(row.question_id, list);
  }
  return byQuestion;
}

async function secondaryTopicsForQuestions(
  executor: Executor,
  ids: readonly string[],
): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map();
  const rows = await executor
    .selectFrom("question_topics")
    .select(["question_id", "topic_id"])
    .where("question_id", "in", ids as string[])
    .where("is_primary", "=", 0)
    .orderBy("topic_id")
    .execute();

  const byQuestion = new Map<string, string[]>();
  for (const row of rows) {
    const list = byQuestion.get(row.question_id) ?? [];
    list.push(row.topic_id);
    byQuestion.set(row.question_id, list);
  }
  return byQuestion;
}

/**
 * The bulk detail read: three queries regardless of how many questions are asked for, so an
 * assessment read is never an N+1 (`TECHNICAL_STANDARDS.md` §9).
 */
export async function loadQuestionDetails(
  executor: Executor,
  ids: readonly string[],
): Promise<Map<string, QuestionDetailDto>> {
  if (ids.length === 0) return new Map();

  const rows = await executor
    .selectFrom("questions")
    .select(QUESTION_COLUMNS)
    .where("id", "in", ids as string[])
    .execute();
  const [options, secondaries] = await Promise.all([
    optionsForQuestions(executor, rows.map((row) => row.id)),
    secondaryTopicsForQuestions(executor, rows.map((row) => row.id)),
  ]);

  return new Map(
    rows.map((row) => [
      row.id,
      {
        ...toQuestionDto(row),
        secondaryTopicIds: secondaries.get(row.id) ?? [],
        explanationMd: row.explanation_md,
        mediaId: row.media_id,
        options: (options.get(row.id) ?? []).map(toOptionDto),
        answerKey: parseStoredKey(row.answer_key) ?? SKELETON[row.question_type].answerKey,
      },
    ]),
  );
}

export async function getQuestionAdmin(id: string): Promise<QuestionDetailDto | null> {
  const db = await getDb();
  return (await loadQuestionDetails(db, [id])).get(id) ?? null;
}

/** `GET /studio/questions`: filters, sort and keyset pagination (§7.4, §10). */
export async function listQuestions(query: QuestionListQuery): Promise<{
  data: QuestionDto[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}> {
  const db = await getDb();
  const limit = query.limit ?? 20;
  const sort = query.sort ?? "updatedAt";
  const dir = query.dir ?? "desc";
  const column = sort === "updatedAt" ? "q.updated_at" : "q.created_at";

  let builder = db
    .selectFrom("questions as q")
    .innerJoin("topics as t", "t.id", "q.topic_id")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .select([
      "q.id",
      "q.topic_id",
      "q.question_type",
      "q.stem_md",
      "q.difficulty",
      "q.points_x100",
      "q.status",
      "q.published_at",
      "q.updated_at",
      "q.created_at",
    ])
    .orderBy(sql.ref(column), dir)
    .orderBy(sql.ref("q.id"), dir)
    .limit(limit + 1);

  if (query.topicId) builder = builder.where("q.topic_id", "=", query.topicId);
  if (query.subjectId) builder = builder.where("ch.subject_id", "=", query.subjectId);
  if (query.type) builder = builder.where("q.question_type", "=", query.type);
  if (query.difficulty) builder = builder.where("q.difficulty", "=", query.difficulty);
  if (query.status) builder = builder.where("q.status", "=", query.status);
  if (query.authorId) builder = builder.where("q.created_by", "=", query.authorId);
  if (query.q) builder = builder.where("q.stem_md", "like", `%${query.q}%`);

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    builder = builder.where(
      sql<boolean>`(${sql.ref(column)}, ${sql.ref("q.id")}) ${sql.raw(dir === "asc" ? ">" : "<")} (${cursor.k}, ${cursor.id})`,
    );
  }

  const rows = await builder.execute();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    data: page.map((row) => toQuestionDto(row as QuestionRow)),
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

/** The invariant of `question_topics` (§7.4, `DATABASE_SCHEMA.md` §7): one primary, no self-listing. */
async function resolveSecondaryTopicIds(
  executor: Executor,
  primaryTopicId: string,
  requested: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(requested)];
  if (unique.length !== requested.length) {
    throw validationError([
      {
        path: "secondaryTopicIds",
        code: "duplicate_topic",
        message: "List each secondary topic once.",
      },
    ]);
  }

  const errors: GateDetail[] = [];
  if (unique.includes(primaryTopicId)) {
    errors.push({
      path: "secondaryTopicIds",
      code: "secondary_is_primary",
      message: "The primary topic cannot also be a secondary one.",
    });
  }

  if (unique.length > 0) {
    const rows = await executor
      .selectFrom("topics")
      .select("id")
      .where("id", "in", unique)
      .execute();
    const found = new Set(rows.map((row) => row.id));
    for (const [index, topicId] of unique.entries()) {
      if (!found.has(topicId)) {
        errors.push({
          path: `secondaryTopicIds.${index}`,
          code: "topic_missing",
          message: "That topic no longer exists.",
        });
      }
    }
  }

  if (errors.length > 0) throw validationError(errors);
  return unique;
}

async function writeOptions(
  trx: Trx,
  questionId: string,
  options: readonly QuestionOptionInput[],
): Promise<void> {
  await trx.deleteFrom("question_options").where("question_id", "=", questionId).execute();
  if (options.length === 0) return;
  await trx
    .insertInto("question_options")
    .values(
      options.map((option, position) => ({
        id: uuidv7(),
        question_id: questionId,
        label: option.label,
        content_md: option.contentMd,
        feedback_md: option.feedbackMd ?? null,
        position,
      })),
    )
    .execute();
}

async function writeTopics(
  trx: Trx,
  questionId: string,
  primaryTopicId: string,
  secondaryTopicIds: readonly string[],
): Promise<void> {
  await trx.deleteFrom("question_topics").where("question_id", "=", questionId).execute();
  await trx
    .insertInto("question_topics")
    .values([
      { question_id: questionId, topic_id: primaryTopicId, is_primary: 1 },
      ...secondaryTopicIds.map((topicId) => ({ question_id: questionId, topic_id: topicId, is_primary: 0 })),
    ])
    .execute();
}

export async function createQuestion(actor: Actor, input: QuestionCreateInput): Promise<QuestionDetailDto> {
  const db = await getDb();
  const now = Date.now();

  return db.transaction().execute(async (trx) => {
    const topic = await trx
      .selectFrom("topics")
      .select("id")
      .where("id", "=", input.topicId)
      .executeTakeFirst();
    if (!topic) throw notFound("topic");

    const secondaryTopicIds = await resolveSecondaryTopicIds(trx, input.topicId, input.secondaryTopicIds ?? []);
    const options = optionsFor(input.type, input.options);
    const answerKey = input.answerKey ?? SKELETON[input.type].answerKey;

    const structural = [...optionLabelErrors(options), ...questionKeyErrors(input.type, options, answerKey)];
    if (structural.length > 0) throw validationError(structural);

    const id = uuidv7(now);
    await trx
      .insertInto("questions")
      .values({
        id,
        topic_id: input.topicId,
        question_type: input.type,
        stem_md: input.stemMd,
        media_id: input.mediaId ?? null,
        difficulty: input.difficulty ?? "medium",
        explanation_md: input.explanationMd ?? "",
        answer_key: JSON.stringify(answerKey),
        points_x100: (input.points ?? 1) * 100,
        status: "draft",
        published_at: null,
        version: 1,
        created_by: actor.id,
        updated_by: actor.id,
        created_at: now,
        updated_at: now,
      })
      .execute();

    await writeOptions(trx, id, options);
    await writeTopics(trx, id, input.topicId, secondaryTopicIds);

    await recordAudit(
      {
        actorId: actor.id,
        action: "question.create",
        entityType: "question",
        entityId: id,
        metadata: { type: input.type, topicId: input.topicId, options: options.length },
      },
      trx,
    );

    const detail = (await loadQuestionDetails(trx, [id])).get(id);
    if (!detail) throw notFound("question");
    return detail;
  });
}

export async function updateQuestion(
  actor: Actor,
  id: string,
  input: QuestionUpdateInput,
): Promise<QuestionDetailDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await loadQuestionRow(trx, id);
    if (!existing) throw notFound("question");
    if (existing.updated_at !== Date.parse(input.expectedUpdatedAt)) {
      throw contentConflict({
        currentUpdatedAt: ISO(existing.updated_at),
        currentUpdatedBy: existing.updated_by,
      });
    }

    const type = input.type ?? existing.question_type;
    const typeChanged = type !== existing.question_type;
    if (typeChanged && !input.answerKey) {
      throw validationError([
        {
          path: "answerKey",
          code: "answer_key_required",
          message: "Changing the question type needs a matching answer key in the same save.",
        },
      ]);
    }

    const currentOptions = await optionsForQuestions(trx, [id]);
    const providedOptions =
      input.options ??
      (currentOptions.get(id) ?? []).map((option) => ({
        label: option.label,
        contentMd: option.content_md,
        ...(option.feedback_md === null ? {} : { feedbackMd: option.feedback_md }),
      }));
    const options = optionsFor(type, providedOptions);
    const answerKey = input.answerKey ?? parseStoredKey(existing.answer_key);

    const structural = [...optionLabelErrors(options), ...questionKeyErrors(type, options, answerKey)];
    if (structural.length > 0) throw validationError(structural);

    const secondaryTopicIds =
      input.secondaryTopicIds === undefined
        ? undefined
        : await resolveSecondaryTopicIds(trx, existing.topic_id, input.secondaryTopicIds);

    const now = Date.now();
    await trx
      .updateTable("questions")
      .set({
        question_type: type,
        stem_md: input.stemMd ?? existing.stem_md,
        media_id: input.mediaId === undefined ? existing.media_id : (input.mediaId ?? null),
        difficulty: input.difficulty ?? existing.difficulty,
        explanation_md: input.explanationMd ?? existing.explanation_md,
        answer_key: JSON.stringify(answerKey),
        points_x100: input.points === undefined ? existing.points_x100 : input.points * 100,
        updated_by: actor.id,
        updated_at: now,
      })
      .where("id", "=", id)
      .execute();

    await writeOptions(trx, id, options);
    if (secondaryTopicIds !== undefined) {
      await writeTopics(trx, id, existing.topic_id, secondaryTopicIds);
    }

    await recordAudit(
      {
        actorId: actor.id,
        action: "question.update",
        entityType: "question",
        entityId: id,
        metadata: {
          fields: [
            ...(input.type ? ["type"] : []),
            ...(input.stemMd ? ["stemMd"] : []),
            ...(input.difficulty ? ["difficulty"] : []),
            ...(input.explanationMd !== undefined ? ["explanationMd"] : []),
            ...(input.points !== undefined ? ["points"] : []),
            ...(input.mediaId !== undefined ? ["mediaId"] : []),
            ...(input.options ? ["options"] : []),
            ...(input.answerKey ? ["answerKey"] : []),
            ...(secondaryTopicIds ? ["secondaryTopicIds"] : []),
          ],
        },
      },
      trx,
    );

    const detail = (await loadQuestionDetails(trx, [id])).get(id);
    if (!detail) throw notFound("question");
    return detail;
  });
}

/** `POST /studio/questions/{id}/duplicate`: a draft copy with its options and cross-listings. */
export async function duplicateQuestion(actor: Actor, id: string): Promise<QuestionDetailDto> {
  const db = await getDb();
  const now = Date.now();

  return db.transaction().execute(async (trx) => {
    const source = await loadQuestionRow(trx, id);
    if (!source) throw notFound("question");

    const copyId = uuidv7(now);
    await trx
      .insertInto("questions")
      .values({
        ...source,
        id: copyId,
        status: "draft",
        published_at: null,
        version: 1,
        created_by: actor.id,
        updated_by: actor.id,
        created_at: now,
        updated_at: now,
      })
      .execute();

    const options = (await optionsForQuestions(trx, [id])).get(id) ?? [];
    const topics = await trx
      .selectFrom("question_topics")
      .select(["topic_id", "is_primary"])
      .where("question_id", "=", id)
      .execute();

    await writeOptions(
      trx,
      copyId,
      options.map((option) => ({
        label: option.label,
        contentMd: option.content_md,
        ...(option.feedback_md === null ? {} : { feedbackMd: option.feedback_md }),
      })),
    );
    await trx
      .insertInto("question_topics")
      .values(topics.map((topic) => ({ ...topic, question_id: copyId })))
      .execute();

    await recordAudit(
      {
        actorId: actor.id,
        action: "question.duplicate",
        entityType: "question",
        entityId: copyId,
        metadata: { copiedFromId: id, options: options.length, topics: topics.length },
      },
      trx,
    );

    const detail = (await loadQuestionDetails(trx, [copyId])).get(copyId);
    if (!detail) throw notFound("question");
    return detail;
  });
}

/** `DELETE /studio/questions/{id}`: archive only, and never a question a live set uses. */
export async function archiveQuestion(actor: Actor, id: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.transaction().execute(async (trx) => {
    const existing = await loadQuestionRow(trx, id);
    if (!existing) throw notFound("question");

    const used = await trx
      .selectFrom("assessment_items as ai")
      .innerJoin("assessments as a", "a.id", "ai.assessment_id")
      .select(["a.id", "a.title"])
      .where("ai.question_id", "=", id)
      .where("a.status", "=", "published")
      .executeTakeFirst();

    if (used) {
      throw new HttpError(
        409,
        "QUESTION_IN_USE",
        `“${used.title}” is published and uses this question. Unpublish it first.`,
      );
    }

    await trx
      .updateTable("questions")
      .set({ status: "archived", updated_by: actor.id, updated_at: now })
      .where("id", "=", id)
      .execute();

    await recordAudit(
      {
        actorId: actor.id,
        action: "question.archive",
        entityType: "question",
        entityId: id,
        metadata: { from: existing.status },
      },
      trx,
    );
  });
}

/**
 * Everything §10.1 needs, loaded once: the row, its options, its topics with statuses and
 * any image. Shared by the dry run and the publish transition.
 */
export async function loadQuestionGates(executor: Executor, id: string): Promise<GateResult | null> {
  const row = await loadQuestionRow(executor, id);
  if (!row) return null;

  const [options, topicRows, media] = await Promise.all([
    optionsForQuestions(executor, [id]),
    executor
      .selectFrom("question_topics as qt")
      .innerJoin("topics as t", "t.id", "qt.topic_id")
      .select(["t.id", "t.status", "qt.is_primary"])
      .where("qt.question_id", "=", id)
      .execute(),
    row.media_id === null
      ? Promise.resolve(null)
      : executor
          .selectFrom("media_assets")
          .select(["status", "alt_text"])
          .where("id", "=", row.media_id)
          .executeTakeFirst(),
  ]);

  const primaryRow = topicRows.find((topic) => topic.is_primary === 1);
  const blocking = evaluateQuestionGates({
    type: row.question_type,
    stemMd: row.stem_md,
    explanationMd: row.explanation_md,
    difficulty: row.difficulty,
    pointsX100: row.points_x100,
    answerKeyRaw: row.answer_key,
    options: (options.get(id) ?? []).map((option) => ({
      label: option.label,
      contentMd: option.content_md,
    })),
    mediaId: row.media_id,
    media: media ? { status: media.status, altText: media.alt_text } : null,
    primaryTopic: primaryRow ? { id: primaryRow.id, status: primaryRow.status } : null,
    secondaryTopics: topicRows
      .filter((topic) => topic.is_primary === 0)
      .map((topic) => ({ id: topic.id, status: topic.status })),
  });

  return { passing: blocking.length === 0, blocking, warnings: [] };
}

/** `POST /studio/questions/validate`: the dry run, reusing the publish gate exactly. */
export async function validateQuestion(id: string): Promise<GateResult> {
  const db = await getDb();
  const result = await loadQuestionGates(db, id);
  if (!result) throw notFound("question");
  return result;
}
