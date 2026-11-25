import "server-only";

import type { Kysely, Transaction } from "kysely";

import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db/schema";
import { HttpError, notFound } from "@/lib/http/errors";
import { uuidv7 } from "@/lib/ids";
import { markdownTextToHtml } from "@/lib/markdown";
import { selectQuestions, type SelectionFilter, type SelectedQuestion } from "@/lib/practice/selection";
import type { Actor } from "@/lib/rbac";
import type { AttemptDto, CreateAttemptInput, StudentQuestion } from "@/lib/validation/attempts";
import type { QuestionType } from "@/lib/validation/questions";

/**
 * `POST /api/v1/attempts` (`API_CONTRACTS.md` §5.1, `QUESTION_ENGINE.md` §7–§8).
 *
 * Creation is the only moment the item list is decided, and it is decided on the server: the
 * client sends a scope, never a question id. Two selection paths exist because the content
 * does:
 *
 * - a curated assessment (`source: 'assessment'`, and the inline practice inside a lesson)
 *   serves its own published items, in their authored order, with the per-item points
 *   override applied;
 * - a topic, chapter or subject serves a generated practice set through `selectQuestions()`,
 *   whose seed is stored in `config` so a retry can be reproduced.
 *
 * Each item is snapshotted as `question_version` + `points_x100_max` (ADR-005); the stem and
 * the key are not copied, so nothing here can leak an `answer_key`. `expires_at` is 24 hours
 * of inactivity, tightened to the assessment duration for `test`/`mock`.
 *
 * `Idempotency-Key` is the unique index on `(user_id, idempotency_key)`: a replay returns the
 * attempt that already exists instead of creating a second one.
 */

type Db = Kysely<Database>;
type Trx = Transaction<Database>;
type Executor = Db | Trx;

const DAY_MS = 86_400_000;
const PUBLISHED = "published" as const;

type Selection = {
  subjectId: string;
  chapterId: string | null;
  topicId: string | null;
  assessmentId: string | null;
  resourceId: string | null;
  mode: "practice" | "test" | "mock";
  durationSeconds: number | null;
  requestedCount: number;
  config: Record<string, unknown>;
  /** `null` for a curated assessment, which serves its own items instead of a draw. */
  filter: SelectionFilter | null;
  /** Set when the items are the assessment's, already ordered and priced. */
  curated: SelectedQuestion[] | null;
};

const ISO = (ms: number): string => new Date(ms).toISOString();
const POINTS = (x100: number): number => x100 / 100;

function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

function noQuestionsMatch(appliedFilters: Record<string, unknown>): HttpError {
  return new HttpError(
    422,
    "NO_QUESTIONS_MATCH",
    "No published questions match that practice set yet.",
    undefined,
    { appliedFilters },
  );
}

/** The assessment's own items: published questions, authored order, override applied. */
async function curatedItems(db: Executor, assessmentId: string): Promise<SelectedQuestion[]> {
  const rows = await db
    .selectFrom("assessment_items as ai")
    .innerJoin("questions as q", "q.id", "ai.question_id")
    .select([
      "q.id as id",
      "q.question_type as questionType",
      "q.difficulty as difficulty",
      "q.points_x100 as pointsX100",
      "q.version as version",
      "ai.points_x100_override as override",
    ])
    .where("ai.assessment_id", "=", assessmentId)
    .where("q.status", "=", PUBLISHED)
    .orderBy("ai.position")
    .execute();

  // Positions are renumbered: an unpublished item leaves no gap for the runner to explain.
  return rows.map((row, index) => ({
    id: row.id,
    questionType: row.questionType as QuestionType,
    difficulty: row.difficulty,
    pointsX100: row.override ?? row.pointsX100,
    version: row.version,
    position: index + 1,
  }));
}

async function publishedTopicIds(db: Executor, where: { chapterId?: string; subjectId?: string }) {
  let builder = db.selectFrom("topics as t").innerJoin("chapters as ch", "ch.id", "t.chapter_id").select("t.id");
  if (where.chapterId !== undefined) builder = builder.where("ch.id", "=", where.chapterId);
  if (where.subjectId !== undefined) builder = builder.where("ch.subject_id", "=", where.subjectId);
  const rows = await builder.where("t.status", "=", PUBLISHED).execute();
  return rows.map((row) => row.id);
}

async function resolveSelection(db: Executor, input: CreateAttemptInput): Promise<Selection> {
  switch (input.source) {
    case "topic": {
      const row = await db
        .selectFrom("topics as t")
        .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
        .innerJoin("subjects as s", "s.id", "ch.subject_id")
        .select(["t.id as topicId", "ch.id as chapterId", "ch.subject_id as subjectId"])
        .where("t.id", "=", input.topicId)
        .where("t.status", "=", PUBLISHED)
        .where("ch.status", "=", PUBLISHED)
        .where("s.status", "=", PUBLISHED)
        .executeTakeFirst();
      if (!row) throw notFound("topic");

      const seed = newSeed();
      return {
        subjectId: row.subjectId,
        chapterId: row.chapterId,
        topicId: row.topicId,
        assessmentId: null,
        resourceId: null,
        mode: "practice",
        durationSeconds: null,
        requestedCount: input.questionCount,
        config: {
          source: "topic",
          topicId: row.topicId,
          seed,
          requestedCount: input.questionCount,
          difficulty: input.difficulty,
          questionTypes: input.questionTypes,
          order: input.order ?? "random",
        },
        filter: { ...selectionFilter(input, seed), questionCount: input.questionCount },
        curated: null,
      };
    }
    case "chapter": {
      const row = await db
        .selectFrom("chapters as ch")
        .innerJoin("subjects as s", "s.id", "ch.subject_id")
        .select(["ch.id as chapterId", "ch.subject_id as subjectId"])
        .where("ch.id", "=", input.chapterId)
        .where("ch.status", "=", PUBLISHED)
        .where("s.status", "=", PUBLISHED)
        .executeTakeFirst();
      if (!row) throw notFound("chapter");

      const seed = newSeed();
      return {
        subjectId: row.subjectId,
        chapterId: row.chapterId,
        topicId: null,
        assessmentId: null,
        resourceId: null,
        mode: "practice",
        durationSeconds: null,
        requestedCount: input.questionCount,
        config: {
          source: "chapter",
          chapterId: row.chapterId,
          seed,
          requestedCount: input.questionCount,
          difficulty: input.difficulty,
          questionTypes: input.questionTypes,
          order: input.order ?? "random",
        },
        filter: { ...selectionFilter(input, seed), questionCount: input.questionCount },
        curated: null,
      };
    }
    case "subject": {
      const subject = await db
        .selectFrom("subjects")
        .select("id")
        .where("id", "=", input.subjectId)
        .where("status", "=", PUBLISHED)
        .executeTakeFirst();
      if (!subject) throw notFound("subject");

      const seed = newSeed();
      return {
        subjectId: subject.id,
        chapterId: null,
        topicId: null,
        assessmentId: null,
        resourceId: null,
        mode: "practice",
        durationSeconds: null,
        requestedCount: input.questionCount,
        config: {
          source: "subject",
          subjectId: subject.id,
          seed,
          requestedCount: input.questionCount,
          difficulty: input.difficulty,
          questionTypes: input.questionTypes,
          order: input.order ?? "random",
        },
        filter: { ...selectionFilter(input, seed), questionCount: input.questionCount },
        curated: null,
      };
    }
    case "assessment": {
      const assessment = await db
        .selectFrom("assessments")
        .select([
          "id",
          "subject_id",
          "topic_id",
          "mode",
          "duration_seconds",
          "question_count",
          "version",
        ])
        .where("id", "=", input.assessmentId)
        .where("status", "=", PUBLISHED)
        .executeTakeFirst();
      if (!assessment) throw notFound("assessment");

      return {
        subjectId: assessment.subject_id,
        chapterId: null,
        topicId: assessment.topic_id,
        assessmentId: assessment.id,
        resourceId: null,
        mode: assessment.mode,
        durationSeconds: assessment.duration_seconds,
        requestedCount: assessment.question_count,
        config: {
          source: "assessment",
          assessmentId: assessment.id,
          assessmentVersion: assessment.version,
        },
        filter: null,
        curated: await curatedItems(db, assessment.id),
      };
    }
    case "resource": {
      const resource = await db
        .selectFrom("learning_resources as r")
        .innerJoin("topics as t", "t.id", "r.topic_id")
        .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
        .select(["r.id as resourceId", "t.id as topicId", "ch.id as chapterId", "ch.subject_id as subjectId"])
        .where("r.id", "=", input.resourceId)
        .where("r.status", "=", PUBLISHED)
        .where("t.status", "=", PUBLISHED)
        .where("ch.status", "=", PUBLISHED)
        .executeTakeFirst();
      if (!resource) throw notFound("resource");

      // The assessment must belong to this lesson: inline practice is not a way around scope.
      const link = await db
        .selectFrom("resource_assessments as ra")
        .innerJoin("assessments as a", "a.id", "ra.assessment_id")
        .select([
          "a.id as id",
          "a.subject_id as subjectId",
          "a.mode as mode",
          "a.duration_seconds as durationSeconds",
          "a.question_count as questionCount",
          "a.version as version",
        ])
        .where("ra.resource_id", "=", resource.resourceId)
        .where("ra.assessment_id", "=", input.assessmentId)
        .where("a.status", "=", PUBLISHED)
        .executeTakeFirst();
      if (!link) throw notFound("assessment");

      return {
        subjectId: resource.subjectId,
        chapterId: resource.chapterId,
        topicId: resource.topicId,
        assessmentId: link.id,
        resourceId: resource.resourceId,
        mode: link.mode,
        durationSeconds: link.durationSeconds,
        requestedCount: link.questionCount,
        config: {
          source: "resource",
          resourceId: resource.resourceId,
          assessmentId: link.id,
          assessmentVersion: link.version,
        },
        filter: null,
        curated: await curatedItems(db, link.id),
      };
    }
    default: {
      const exhaustive: never = input;
      throw new Error(`Unhandled attempt source: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function selectionFilter(
  input: Extract<CreateAttemptInput, { source: "topic" | "chapter" | "subject" }>,
  seed: number,
): Omit<SelectionFilter, "questionCount"> {
  const questionTypes = [...new Set(input.questionTypes)] as QuestionType[];
  return {
    ...(input.difficulty === "any" ? {} : { difficulty: input.difficulty }),
    questionTypes,
    order: input.order ?? "random",
    seed,
  };
}

function toAttemptDto(row: Database["assessment_attempts"], config: Record<string, unknown>): AttemptDto {
  return {
    id: row.id,
    status: row.status,
    startedAt: ISO(row.started_at),
    expiresAt: ISO(row.expires_at),
    mode: config.mode === "test" || config.mode === "mock" ? config.mode : "practice",
    questionCount: row.question_count,
    requestedCount:
      typeof config.requestedCount === "number" ? config.requestedCount : row.question_count,
    durationSeconds: config.durationSeconds === null || config.durationSeconds === undefined
      ? null
      : Number(config.durationSeconds),
    config,
  };
}

function parseConfig(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** The student view of an attempt's items: text and options, never the key (SEC §5). */
async function loadStudentQuestions(db: Executor, attemptId: string): Promise<StudentQuestion[]> {
  const items = await db
    .selectFrom("attempt_items as ai")
    .innerJoin("questions as q", "q.id", "ai.question_id")
    .select([
      "ai.question_id as questionId",
      "ai.position as position",
      "ai.points_x100_max as pointsX100Max",
      "q.question_type as questionType",
      "q.difficulty as difficulty",
      "q.stem_md as stemMd",
      "q.media_id as mediaId",
    ])
    .where("ai.attempt_id", "=", attemptId)
    .orderBy("ai.position")
    .execute();

  if (items.length === 0) return [];

  const ids = items.map((item) => item.questionId);
  const options = await db
    .selectFrom("question_options")
    .select(["question_id as questionId", "label", "content_md as contentMd"])
    .where("question_id", "in", ids)
    .orderBy("position")
    .execute();

  const optionsByQuestion = new Map<string, { label: StudentQuestion["options"][number]["label"]; html: string }[]>();
  for (const option of options) {
    const list = optionsByQuestion.get(option.questionId) ?? [];
    list.push({ label: option.label, html: markdownTextToHtml(option.contentMd) });
    optionsByQuestion.set(option.questionId, list);
  }

  const mediaIds = items.flatMap((item) => (item.mediaId === null ? [] : [item.mediaId]));
  const media = new Map<string, NonNullable<StudentQuestion["media"]>>();
  if (mediaIds.length > 0) {
    const assets = await db
      .selectFrom("media_assets")
      .select(["id", "public_url", "alt_text", "width", "height"])
      .where("id", "in", mediaIds)
      .where("status", "=", "ready")
      .execute();
    for (const asset of assets) {
      // `§5.1` types width/height as numbers, so an asset without them is reported as absent
      // rather than as a misleading `0`.
      if (asset.public_url === null || asset.width === null || asset.height === null) continue;
      media.set(asset.id, {
        url: asset.public_url,
        alt: asset.alt_text,
        width: asset.width,
        height: asset.height,
      });
    }
  }

  return items.map((item) => ({
    id: item.questionId,
    position: item.position,
    type: item.questionType as QuestionType,
    difficulty: item.difficulty,
    stemHtml: markdownTextToHtml(item.stemMd),
    media: item.mediaId === null ? null : (media.get(item.mediaId) ?? null),
    options: optionsByQuestion.get(item.questionId) ?? [],
    pointsMax: POINTS(item.pointsX100Max),
    answer: null,
  }));
}

export type CreateAttemptResult = {
  attempt: AttemptDto;
  questions: StudentQuestion[];
  /** `true` when an `Idempotency-Key` matched an existing attempt, so the reply is `200`. */
  replayed: boolean;
};

async function replay(db: Executor, actor: Actor, key: string): Promise<CreateAttemptResult | null> {
  const existing = await db
    .selectFrom("assessment_attempts")
    .selectAll()
    .where("user_id", "=", actor.id)
    .where("idempotency_key", "=", key)
    .executeTakeFirst();
  if (!existing) return null;

  return {
    attempt: toAttemptDto(existing, parseConfig(existing.config)),
    questions: await loadStudentQuestions(db, existing.id),
    replayed: true,
  };
}

export async function createAttempt(
  actor: Actor,
  input: CreateAttemptInput,
  idempotencyKey: string | null,
): Promise<CreateAttemptResult> {
  const db = await getDb();

  if (idempotencyKey !== null) {
    const replayed = await replay(db, actor, idempotencyKey);
    if (replayed) return replayed;
  }

  const selection = await resolveSelection(db, input);

  const chosen =
    selection.curated ??
    (await selectQuestions(
      db,
      { topicIds: await resolveTopicIds(db, input) },
      selection.filter ?? { questionCount: selection.requestedCount, seed: newSeed() },
    )).questions;

  if (chosen.length === 0) {
    throw noQuestionsMatch(
      selection.filter === null
        ? { assessmentId: selection.assessmentId }
        : {
            difficulty: selection.filter.difficulty ?? "any",
            questionTypes: selection.filter.questionTypes ?? [],
            requestedCount: selection.requestedCount,
          },
    );
  }

  const now = Date.now();
  const attemptId = uuidv7(now);
  const config: Record<string, unknown> = {
    ...selection.config,
    mode: selection.mode,
    durationSeconds: selection.durationSeconds,
  };
  const configJson = JSON.stringify(config);
  const expiresAt =
    selection.durationSeconds === null
      ? now + DAY_MS
      : Math.min(now + DAY_MS, now + selection.durationSeconds * 1_000);

  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("assessment_attempts")
        .values({
          id: attemptId,
          user_id: actor.id,
          source: input.source,
          assessment_id: selection.assessmentId,
          resource_id: selection.resourceId,
          subject_id: selection.subjectId,
          chapter_id: selection.chapterId,
          topic_id: selection.topicId,
          config: configJson,
          question_count: chosen.length,
          status: "in_progress",
          started_at: now,
          last_activity_at: now,
          expires_at: expiresAt,
          submitted_at: null,
          answered_count: 0,
          correct_count: 0,
          score_x100: 0,
          max_score_x100: 0,
          score_percent_x100: null,
          duration_seconds: null,
          idempotency_key: idempotencyKey,
          created_at: now,
          updated_at: now,
        })
        .execute();

      await trx
        .insertInto("attempt_items")
        .values(
          chosen.map((question) => ({
            id: uuidv7(now),
            attempt_id: attemptId,
            question_id: question.id,
            question_version: question.version,
            position: question.position,
            points_x100_max: question.pointsX100,
            selected_answer: null,
            is_correct: null,
            points_x100_awarded: null,
            feedback: null,
            response_ms: null,
            answered_at: null,
          })),
        )
        .execute();
    });
  } catch (error) {
    // A concurrent request with the same key won the unique index; its attempt is the answer.
    if (idempotencyKey !== null && error instanceof Error && /UNIQUE/i.test(error.message)) {
      const replayed = await replay(db, actor, idempotencyKey);
      if (replayed) return replayed;
    }
    throw error;
  }

  const row = await db
    .selectFrom("assessment_attempts")
    .selectAll()
    .where("id", "=", attemptId)
    .executeTakeFirstOrThrow();

  return {
    attempt: toAttemptDto(row, config),
    questions: await loadStudentQuestions(db, attemptId),
    replayed: false,
  };
}

/** The topic ids a generated practice set draws from, resolved from the requested scope. */
async function resolveTopicIds(db: Db, input: CreateAttemptInput): Promise<string[]> {
  switch (input.source) {
    case "topic":
      return [input.topicId];
    case "chapter":
      return publishedTopicIds(db, { chapterId: input.chapterId });
    case "subject":
      return publishedTopicIds(db, { subjectId: input.subjectId });
    default:
      // A curated assessment and inline practice serve their own items, never a scope draw.
      return [];
  }
}
