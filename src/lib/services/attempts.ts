import "server-only";

import type { Kysely, Transaction } from "kysely";

import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db/schema";
import { HttpError, notFound } from "@/lib/http/errors";
import { uuidv7 } from "@/lib/ids";
import { markdownTextToHtml } from "@/lib/markdown";
import { gradeAttempt } from "@/lib/practice/grading";
import { selectQuestions, type SelectionFilter, type SelectedQuestion } from "@/lib/practice/selection";
import type { Actor } from "@/lib/rbac";
import {
  loadAttemptReview,
  loadMediaMap,
  parseAnswerKey,
  parseStudentAnswer,
  toCorrectAnswerView,
} from "@/lib/services/attempt-review";
import type {
  AttemptDto,
  CreateAttemptInput,
  ResumeAttemptDto,
  RevealDto,
  ReviewItem,
  SavedAnswer,
  SaveAnswersInput,
  StudentQuestion,
  SubmitAttemptDto,
} from "@/lib/validation/attempts";
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

/**
 * The student view of an attempt's items: text and options, never the key (SEC §5).
 *
 * `savedAnswers` is empty for a fresh create and filled for a resume, so the runner restores
 * a selection without a second request; the key is still never selected here.
 */
async function loadStudentQuestions(
  db: Executor,
  attemptId: string,
  savedAnswers: SavedAnswer[] = [],
): Promise<StudentQuestion[]> {
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

  const media = await loadMediaMap(
    db,
    items.flatMap((item) => (item.mediaId === null ? [] : [item.mediaId])),
  );

  const answers = new Map(savedAnswers.map((saved) => [saved.questionId, saved.answer]));

  return items.map((item) => ({
    id: item.questionId,
    position: item.position,
    type: item.questionType as QuestionType,
    difficulty: item.difficulty,
    stemHtml: markdownTextToHtml(item.stemMd),
    media: item.mediaId === null ? null : (media.get(item.mediaId) ?? null),
    options: optionsByQuestion.get(item.questionId) ?? [],
    pointsMax: POINTS(item.pointsX100Max),
    answer: answers.get(item.questionId) ?? null,
  }));
}

/** The saved selections of an attempt, in item order. A cleared answer has no row. */
async function loadSavedAnswers(db: Executor, attemptId: string): Promise<SavedAnswer[]> {
  const rows = await db
    .selectFrom("attempt_items")
    .select([
      "question_id as questionId",
      "selected_answer as selectedAnswer",
      "response_ms as responseMs",
    ])
    .where("attempt_id", "=", attemptId)
    .where("selected_answer", "is not", null)
    .orderBy("position")
    .execute();

  return rows.flatMap((row) => {
    const answer = parseStudentAnswer(row.selectedAnswer);
    return answer === null
      ? []
      : [{ questionId: row.questionId, answer, responseMs: row.responseMs }];
  });
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

export type ResumeAttemptResult = {
  attempt: ResumeAttemptDto;
  questions: StudentQuestion[];
  savedAnswers: SavedAnswer[];
};

/**
 * `GET /api/v1/attempts/{id}` (`API_CONTRACTS.md` §5.2).
 *
 * The runner's restore path: the snapshotted questions, the answers already saved and a
 * server-decided `canResume`. Reading an attempt past its window performs the same lazy
 * expiry as `submitAttempt`, so the status a client reads is the status its next write would
 * meet. Nothing here selects `answer_key`, an explanation or per-option feedback.
 *
 * Ownership is part of the query, so another student's id is indistinguishable from a
 * missing one (`404`, never `403`).
 */
export async function resumeAttempt(actor: Actor, attemptId: string): Promise<ResumeAttemptResult> {
  const db = await getDb();
  let attempt = await db
    .selectFrom("assessment_attempts")
    .selectAll()
    .where("id", "=", attemptId)
    .where("user_id", "=", actor.id)
    .executeTakeFirst();

  if (!attempt) throw notFound("attempt");

  if (attempt.status === "in_progress" && Date.now() > attempt.expires_at) {
    const now = Date.now();
    await db
      .updateTable("assessment_attempts")
      .set({ status: "expired", updated_at: now })
      .where("id", "=", attempt.id)
      .where("status", "=", "in_progress")
      .execute();
    attempt = { ...attempt, status: "expired" };
  }

  const savedAnswers = await loadSavedAnswers(db, attempt.id);

  return {
    attempt: {
      ...toAttemptDto(attempt, parseConfig(attempt.config)),
      canResume: attempt.status === "in_progress",
    },
    questions: await loadStudentQuestions(db, attempt.id, savedAnswers),
    savedAnswers,
  };
}

export type SaveAnswersResult = {
  saved: number;
  answeredCount: number;
  expiresAt: string;
  reveal?: RevealDto;
};

/**
 * `PATCH /api/v1/attempts/{id}/answers` (`API_CONTRACTS.md` §5.3).
 *
 * A save is one transaction: the activity timestamp and every item are written together, so
 * a partial batch cannot leave `answeredCount` disagreeing with the stored selections. The
 * activity update claims the row with `status = 'in_progress'`, which is also how a save
 * that raced a submit learns it lost instead of editing a graded attempt.
 *
 * Grading does not happen here. Only the practice reveal needs a verdict, so it is computed
 * for the single newly-answered item and never written: `submitAttempt` remains the one
 * place a score is stored.
 */
export async function saveAnswers(
  actor: Actor,
  attemptId: string,
  input: SaveAnswersInput,
): Promise<SaveAnswersResult> {
  const db = await getDb();
  const attempt = await db
    .selectFrom("assessment_attempts")
    .selectAll()
    .where("id", "=", attemptId)
    .where("user_id", "=", actor.id)
    .executeTakeFirst();

  if (!attempt) throw notFound("attempt");

  const now = Date.now();
  if (attempt.status === "in_progress" && now > attempt.expires_at) {
    await db
      .updateTable("assessment_attempts")
      .set({ status: "expired", updated_at: now })
      .where("id", "=", attempt.id)
      .where("status", "=", "in_progress")
      .execute();
    throw new HttpError(409, "ATTEMPT_EXPIRED", "This attempt expired before those answers were saved.");
  }
  if (attempt.status === "expired") {
    throw new HttpError(409, "ATTEMPT_EXPIRED", "This attempt expired before those answers were saved.");
  }
  if (attempt.status !== "in_progress") {
    throw new HttpError(
      422,
      "ATTEMPT_NOT_EDITABLE",
      "A submitted or abandoned attempt cannot be edited.",
    );
  }

  const config = parseConfig(attempt.config);
  const mode = config.mode === "test" || config.mode === "mock" ? config.mode : "practice";
  const questionIds = input.answers.map((entry) => entry.questionId);

  const items = await db
    .selectFrom("attempt_items as ai")
    .innerJoin("questions as q", "q.id", "ai.question_id")
    .select([
      "ai.id as id",
      "ai.question_id as questionId",
      "ai.selected_answer as selectedAnswer",
      "ai.points_x100_max as pointsX100Max",
      "q.question_type as questionType",
      "q.answer_key as answerKey",
      "q.explanation_md as explanationMd",
    ])
    .where("ai.attempt_id", "=", attempt.id)
    .where("ai.question_id", "in", questionIds)
    .execute();

  const byQuestion = new Map(items.map((item) => [item.questionId, item]));
  const missing = questionIds.filter((questionId) => !byQuestion.has(questionId));
  if (missing.length > 0) {
    throw new HttpError(
      422,
      "QUESTION_NOT_IN_ATTEMPT",
      "Those questions are not part of this attempt.",
      missing.map((questionId) => ({
        path: `answers.${questionIds.indexOf(questionId)}.questionId`,
        code: "QUESTION_NOT_IN_ATTEMPT",
        message: `${questionId} is not part of this attempt.`,
      })),
    );
  }

  const changes = input.answers.map((entry) => {
    const item = byQuestion.get(entry.questionId)!;
    if (entry.answer !== null && entry.answer.type !== item.questionType) {
      throw new HttpError(422, "VALIDATION_ERROR", "An answer does not match its question type.", [
        {
          path: `answers.${questionIds.indexOf(entry.questionId)}.answer`,
          code: "ANSWER_TYPE_MISMATCH",
          message: `Expected a ${item.questionType} answer for ${entry.questionId}.`,
        },
      ]);
    }

    return {
      entry,
      item,
      // A re-save of the same selection is not "just answered": §5.3 withholds the reveal.
      changed:
        JSON.stringify(parseStudentAnswer(item.selectedAnswer)) !== JSON.stringify(entry.answer),
    };
  });

  const limit = typeof config.durationSeconds === "number" ? config.durationSeconds : null;
  // 24 h of inactivity, tightened to a timed attempt's fixed deadline.
  const expiresAt =
    limit === null ? now + DAY_MS : Math.min(attempt.started_at + limit * 1_000, now + DAY_MS);

  await db.transaction().execute(async (trx) => {
    const claim = await trx
      .updateTable("assessment_attempts")
      .set({ last_activity_at: now, expires_at: expiresAt, updated_at: now })
      .where("id", "=", attempt.id)
      .where("user_id", "=", actor.id)
      .where("status", "=", "in_progress")
      .executeTakeFirst();

    if (Number(claim.numUpdatedRows) === 0) {
      throw new HttpError(422, "ATTEMPT_NOT_EDITABLE", "This attempt is no longer editable.");
    }

    for (const change of changes) {
      await trx
        .updateTable("attempt_items")
        .set({
          selected_answer:
            change.entry.answer === null ? null : JSON.stringify(change.entry.answer),
          response_ms: change.entry.answer === null ? null : (change.entry.responseMs ?? null),
          answered_at: change.entry.answer === null ? null : now,
        })
        .where("id", "=", change.item.id)
        .execute();
    }
  });

  const answered = await db
    .selectFrom("attempt_items")
    .select("id")
    .where("attempt_id", "=", attempt.id)
    .where("selected_answer", "is not", null)
    .execute();

  // §5.3: a practice save that newly answers exactly one item is the immediate-feedback path.
  const answeredChanges = changes.filter(
    (change) => change.changed && change.entry.answer !== null,
  );
  let reveal: RevealDto | undefined;
  if (mode === "practice" && answeredChanges.length === 1) {
    const { entry, item } = answeredChanges[0]!;
    const key = parseAnswerKey(item.answerKey);
    const graded = gradeAttempt([
      {
        questionId: item.questionId,
        pointsMax: item.pointsX100Max,
        answer: entry.answer,
        question: key === null ? null : { id: item.questionId, answerKey: key },
      },
    ]);

    reveal = {
      questionId: item.questionId,
      isCorrect: graded.items[0]!.isCorrect,
      correctAnswer: key === null ? null : toCorrectAnswerView(key),
      explanationHtml: markdownTextToHtml(item.explanationMd),
    };
  }

  return {
    saved: input.answers.length,
    answeredCount: answered.length,
    expiresAt: ISO(expiresAt),
    ...(reveal === undefined ? {} : { reveal }),
  };
}

/**
 * `POST /api/v1/attempts/{id}/submit` (`API_CONTRACTS.md` §5.4).
 *
 * Submission is a state change, not a computation the client may repeat: the attempt row is
 * claimed with `UPDATE … WHERE status = 'in_progress'`, so two concurrent calls cannot grade
 * twice, and the loser reads back the winner's result. Grading, the totals and the per-item
 * outcomes are written in one transaction — a failure leaves the attempt in progress rather
 * than half-scored.
 *
 * `duration_seconds` is the elapsed time, and a timed attempt that ran over its limit is
 * accepted with `overTimeSeconds` reported; nothing is silently invalidated.
 */

function toSubmitDto(
  row: Database["assessment_attempts"],
  config: Record<string, unknown>,
): SubmitAttemptDto {
  const submittedAt = row.submitted_at ?? row.updated_at;
  const durationSeconds =
    row.duration_seconds ?? Math.max(0, Math.round((submittedAt - row.started_at) / 1_000));
  const limit = typeof config.durationSeconds === "number" ? config.durationSeconds : null;

  return {
    id: row.id,
    status: "submitted",
    startedAt: ISO(row.started_at),
    submittedAt: ISO(submittedAt),
    durationSeconds,
    answeredCount: row.answered_count,
    correctCount: row.correct_count,
    scorePoints: POINTS(row.score_x100),
    maxPoints: POINTS(row.max_score_x100),
    scorePercent: row.score_percent_x100 === null ? null : row.score_percent_x100 / 100,
    overTimeSeconds: limit !== null && durationSeconds > limit ? durationSeconds - limit : null,
  };
}

export type SubmitAttemptResult = { attempt: SubmitAttemptDto; results: ReviewItem[] };

export async function submitAttempt(actor: Actor, attemptId: string): Promise<SubmitAttemptResult> {
  const db = await getDb();
  const attempt = await db
    .selectFrom("assessment_attempts")
    .selectAll()
    .where("id", "=", attemptId)
    .where("user_id", "=", actor.id)
    .executeTakeFirst();

  // Another user's id is a `404`, never a `403`: the contract does not confirm existence.
  if (!attempt) throw notFound("attempt");

  if (attempt.status === "abandoned") {
    throw new HttpError(
      409,
      "INVALID_TRANSITION",
      "This attempt was abandoned, so it cannot be submitted.",
    );
  }

  if (attempt.status === "submitted") {
    return {
      attempt: toSubmitDto(attempt, parseConfig(attempt.config)),
      results: await loadAttemptReview(db, attempt.id),
    };
  }

  const now = Date.now();
  if (attempt.status === "expired" || now > attempt.expires_at) {
    if (attempt.status === "in_progress") {
      await db
        .updateTable("assessment_attempts")
        .set({ status: "expired", updated_at: now })
        .where("id", "=", attempt.id)
        .where("status", "=", "in_progress")
        .execute();
    }
    throw new HttpError(409, "ATTEMPT_EXPIRED", "This attempt expired before it was submitted.");
  }

  let claimed = false;

  await db.transaction().execute(async (trx) => {
    const claim = await trx
      .updateTable("assessment_attempts")
      .set({ status: "submitted", submitted_at: now, last_activity_at: now, updated_at: now })
      .where("id", "=", attempt.id)
      .where("user_id", "=", actor.id)
      .where("status", "=", "in_progress")
      .executeTakeFirst();

    // A concurrent submit won the row; its result is this request's answer.
    if (Number(claim.numUpdatedRows) === 0) return;
    claimed = true;

    const items = await trx
      .selectFrom("attempt_items as ai")
      .innerJoin("questions as q", "q.id", "ai.question_id")
      .select([
        "ai.id as id",
        "ai.question_id as questionId",
        "ai.points_x100_max as pointsX100Max",
        "ai.selected_answer as selectedAnswer",
        "q.answer_key as answerKey",
      ])
      .where("ai.attempt_id", "=", attempt.id)
      .orderBy("ai.position")
      .execute();

    const grade = gradeAttempt(
      items.map((item) => {
        const answerKey = parseAnswerKey(item.answerKey);
        return {
          questionId: item.questionId,
          pointsMax: item.pointsX100Max,
          answer: parseStudentAnswer(item.selectedAnswer),
          question: answerKey === null ? null : { id: item.questionId, answerKey },
        };
      }),
    );

    await trx
      .updateTable("assessment_attempts")
      .set({
        answered_count: grade.answeredCount,
        correct_count: grade.correctCount,
        score_x100: grade.scoreX100,
        max_score_x100: grade.maxScoreX100,
        score_percent_x100: grade.scorePercentX100,
        duration_seconds: Math.max(0, Math.round((now - attempt.started_at) / 1_000)),
        updated_at: now,
      })
      .where("id", "=", attempt.id)
      .execute();

    for (const [index, item] of items.entries()) {
      const result = grade.items[index]!;
      await trx
        .updateTable("attempt_items")
        .set({
          is_correct: result.isCorrect === null ? null : result.isCorrect ? 1 : 0,
          points_x100_awarded: result.points,
          feedback: JSON.stringify(result.feedback),
        })
        .where("id", "=", item.id)
        .execute();
    }
  });

  const row = await db
    .selectFrom("assessment_attempts")
    .selectAll()
    .where("id", "=", attempt.id)
    .executeTakeFirstOrThrow();

  if (!claimed && row.status !== "submitted") {
    throw new HttpError(409, "ATTEMPT_EXPIRED", "This attempt can no longer be submitted.");
  }

  return {
    attempt: toSubmitDto(row, parseConfig(row.config)),
    results: await loadAttemptReview(db, attempt.id),
  };
}

/**
 * `POST /api/v1/attempts/{id}/abandon` (`API_CONTRACTS.md` §5.5).
 *
 * Idempotent by design: abandoning an abandoned attempt answers the same body, so a retried
 * request is not an error. The update claims the row with `status = 'in_progress'`, so an
 * attempt submitted in the meantime is refused instead of being relabelled.
 */
export async function abandonAttempt(actor: Actor, attemptId: string): Promise<{ status: "abandoned" }> {
  const db = await getDb();
  const attempt = await db
    .selectFrom("assessment_attempts")
    .select(["id", "status", "expires_at"])
    .where("id", "=", attemptId)
    .where("user_id", "=", actor.id)
    .executeTakeFirst();

  if (!attempt) throw notFound("attempt");
  if (attempt.status === "abandoned") return { status: "abandoned" };

  const now = Date.now();
  // A submitted attempt is not editable whatever its old window says, so it is checked first.
  if (attempt.status === "submitted") {
    throw new HttpError(422, "ATTEMPT_NOT_EDITABLE", "A submitted attempt cannot be abandoned.");
  }
  if (attempt.status === "expired" || now > attempt.expires_at) {
    throw new HttpError(409, "ATTEMPT_EXPIRED", "This attempt has already expired.");
  }

  const claimed = await db
    .updateTable("assessment_attempts")
    .set({ status: "abandoned", updated_at: now })
    .where("id", "=", attempt.id)
    .where("user_id", "=", actor.id)
    .where("status", "=", "in_progress")
    .executeTakeFirst();

  if (Number(claimed.numUpdatedRows) === 0) {
    throw new HttpError(422, "ATTEMPT_NOT_EDITABLE", "This attempt is no longer editable.");
  }

  return { status: "abandoned" };
}

/**
 * `GET /api/v1/attempts/{id}/review` (`API_CONTRACTS.md` §5.5).
 *
 * The same payload `submit` returns, read without grading again: the stored totals and the
 * review projection are already the graded answer, so a review request cannot rescore an
 * attempt. Only a submitted attempt has one.
 */
export async function reviewAttempt(actor: Actor, attemptId: string): Promise<SubmitAttemptResult> {
  const db = await getDb();
  const attempt = await db
    .selectFrom("assessment_attempts")
    .selectAll()
    .where("id", "=", attemptId)
    .where("user_id", "=", actor.id)
    .executeTakeFirst();

  if (!attempt) throw notFound("attempt");
  if (attempt.status !== "submitted") {
    throw new HttpError(
      409,
      "INVALID_TRANSITION",
      "Only a submitted attempt has a review.",
    );
  }

  return {
    attempt: toSubmitDto(attempt, parseConfig(attempt.config)),
    results: await loadAttemptReview(db, attempt.id),
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
