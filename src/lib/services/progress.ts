import "server-only";

import type { Kysely } from "kysely";
import { sql } from "kysely";

import { getDb } from "@/lib/db";
import type { Database, Difficulty } from "@/lib/db/schema";
import { notFound } from "@/lib/http/errors";
import type { Actor } from "@/lib/rbac";
import { url } from "@/lib/urls";
import { decodeCursor, encodeCursor } from "@/lib/validation/cursor";
import type { QuestionType } from "@/lib/validation/questions";
import type {
  ProgressSummary,
  ProgressSummaryQuery,
  StudyProgressList,
  StudyProgressQuery,
  TopicPerformance,
  TopicPerformanceDetail,
  TopicPerformancePage,
  TopicPerformanceQuery,
} from "@/lib/validation/progress";

/**
 * The progress surface (`API_CONTRACTS.md` §6, `FR-PROG-01…03`).
 *
 * The source of truth is the attempts themselves: `attempt_items` joined back to the
 * question's primary topic, restricted to `submitted` attempts. Nothing is read from a
 * derived table, because none exists — `user_topic_stats` stays a documented cache with an
 * open decision (`OQ-DB3`), and a live aggregate cannot disagree with the attempts it is
 * built from. If the cache arrives, this module keeps its shape and swaps its query.
 *
 * Two counting rules carry the whole module:
 *
 * - `answered` is an item with a stored answer (`answered_at`), `correct` is one graded
 *   right, and `accuracy` divides by **graded** items — an item whose key no longer parses
 *   is neither right nor wrong, so it cannot drag a percentage down.
 * - an attempt that was abandoned or expired contributes nothing; it is still visible in
 *   history (`§5.5`), just not in progress.
 */

type Db = Kysely<Database>;

const DAY_MS = 86_400_000;
const FOCUS_MIN_ANSWERED = 5;
const FOCUS_BELOW_PERCENT = 60;
const FOCUS_LIMIT = 5;

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard", "very_hard"];
const QUESTION_TYPES: readonly QuestionType[] = [
  "multiple_choice",
  "multiple_select",
  "true_false",
  "short_answer",
];

const ISO = (ms: number): string => new Date(ms).toISOString();
/** libsql may hand back a `bigint` for an aggregate; every count here is small. */
const NUM = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));

/** A percentage rounded to two decimals, or `null` when nothing was graded. */
function percent(correct: number, graded: number): number | null {
  return graded === 0 ? null : Math.round((correct / graded) * 10_000) / 100;
}

type TopicAggregate = {
  topicId: string;
  topicTitle: string;
  topicSlug: string;
  chapterSlug: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  levelSlug: string;
  curriculumSlug: string;
  attempts: number;
  answered: number;
  correct: number;
  graded: number;
  lastPracticedAt: number;
};

/**
 * One row per practised topic, with the counts the table and the focus list both need.
 * `topicId` narrows the same aggregate to a single topic for the detail endpoint, so the
 * detail's headline numbers can never be computed by a different rule than the list's.
 */
async function loadTopicAggregates(
  db: Db,
  userId: string,
  topicId?: string,
): Promise<TopicAggregate[]> {
  const base = db
    .selectFrom("attempt_items as ai")
    .innerJoin("assessment_attempts as a", "a.id", "ai.attempt_id")
    .innerJoin("questions as q", "q.id", "ai.question_id")
    .innerJoin("topics as t", "t.id", "q.topic_id")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .where("a.user_id", "=", userId)
    .where("a.status", "=", "submitted")
    .where("ai.answered_at", "is not", null);

  const filtered = topicId === undefined ? base : base.where("t.id", "=", topicId);

  const rows = await filtered
    .select([
      "t.id as topicId",
      "t.title as topicTitle",
      "t.slug as topicSlug",
      "ch.slug as chapterSlug",
      "s.id as subjectId",
      "s.name as subjectName",
      "s.slug as subjectSlug",
      "l.slug as levelSlug",
      "c.slug as curriculumSlug",
      sql<number>`count(distinct ai.attempt_id)`.as("attempts"),
      sql<number>`count(ai.id)`.as("answered"),
      sql<number>`coalesce(sum(case when ai.is_correct = 1 then 1 else 0 end), 0)`.as("correct"),
      sql<number>`count(ai.is_correct)`.as("graded"),
      sql<number>`max(ai.answered_at)`.as("lastPracticedAt"),
    ])
    .groupBy([
      "t.id",
      "t.title",
      "t.slug",
      "ch.slug",
      "s.id",
      "s.name",
      "s.slug",
      "l.slug",
      "c.slug",
    ])
    .execute();

  return rows.map((row) => ({
    ...row,
    attempts: NUM(row.attempts),
    answered: NUM(row.answered),
    correct: NUM(row.correct),
    graded: NUM(row.graded),
    lastPracticedAt: NUM(row.lastPracticedAt),
  }));
}

function toPerformance(row: TopicAggregate): TopicPerformance {
  return {
    topic: {
      id: row.topicId,
      title: row.topicTitle,
      href: url.topic(
        row.curriculumSlug,
        row.levelSlug,
        row.subjectSlug,
        row.chapterSlug,
        row.topicSlug,
      ),
    },
    subject: { id: row.subjectId, name: row.subjectName },
    attempts: row.attempts,
    answered: row.answered,
    correct: row.correct,
    accuracy: percent(row.correct, row.graded),
    lastPracticedAt: ISO(row.lastPracticedAt),
  };
}

type Sort = TopicPerformanceQuery["sort"];
type Dir = "asc" | "desc";

const defaultDir = (sort: Sort): Dir => (sort === "accuracy" ? "asc" : "desc");

function sortValue(row: TopicPerformance, sort: Sort): number {
  if (sort === "accuracy") return row.accuracy ?? -1;
  return row.lastPracticedAt === null ? -1 : Date.parse(row.lastPracticedAt);
}

/**
 * A topic with nothing graded is not "the worst topic" — it is a topic with no data, so it
 * sorts last in either direction. Ties always break on the id ascending, which is what makes
 * the cursor stable across pages.
 */
function compare(a: TopicPerformance, b: TopicPerformance, sort: Sort, dir: Dir): number {
  if (sort === "accuracy" && (a.accuracy === null) !== (b.accuracy === null)) {
    return a.accuracy === null ? 1 : -1;
  }

  const ka = sortValue(a, sort);
  const kb = sortValue(b, sort);
  if (ka !== kb) return dir === "asc" ? ka - kb : kb - ka;

  return a.topic.id.localeCompare(b.topic.id);
}

function afterCursor(
  row: TopicPerformance,
  cursor: { k: string | number; id: string },
  sort: Sort,
  dir: Dir,
): boolean {
  const key = Number(cursor.k);

  if (sort === "accuracy") {
    const rowNull = row.accuracy === null;
    const cursorNull = key < 0;
    if (rowNull !== cursorNull) return rowNull;
    if (rowNull && cursorNull) return row.topic.id > cursor.id;
  }

  const value = sortValue(row, sort);
  if (value !== key) return dir === "asc" ? value > key : value < key;
  return row.topic.id > cursor.id;
}

/**
 * `GET /api/v1/progress/topics` (§6).
 *
 * Sorted and paginated in the service: `accuracy` is a ratio of two aggregates, and a
 * student's practised topics are bounded by the published catalogue, so a second query with
 * a `HAVING` clause would buy nothing but a second definition of the same ordering.
 */
export async function listTopicPerformance(
  actor: Actor,
  query: TopicPerformanceQuery,
): Promise<TopicPerformancePage> {
  const db = await getDb();
  const dir = query.dir ?? defaultDir(query.sort);

  const rows = (await loadTopicAggregates(db, actor.id))
    .map(toPerformance)
    .filter((row) => query.subjectId === undefined || row.subject.id === query.subjectId)
    .sort((a, b) => compare(a, b, query.sort, dir));

  const start = query.cursor
    ? rows.findIndex((row) => afterCursor(row, decodeCursor(query.cursor!), query.sort, dir))
    : 0;

  const page = start === -1 ? [] : rows.slice(start, start + query.limit);
  const last = page.at(-1);
  const hasMore = start !== -1 && start + query.limit < rows.length;

  return {
    data: page,
    pagination: {
      limit: query.limit,
      hasMore,
      // §10: the last page carries no cursor, so a client cannot loop past the end.
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor({ k: sortValue(last, query.sort), id: last.topic.id })
          : null,
    },
  };
}

/** Midnight UTC of the first day in the window: `days` buckets, today included. */
function windowStart(days: number, now = Date.now()): number {
  const today = new Date(now);
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return midnight - (days - 1) * DAY_MS;
}

/**
 * `GET /api/v1/progress/summary` (§6).
 *
 * Four queries, each an aggregate the database can answer without loading rows: attempt
 * totals and durations, item outcomes (all time and windowed), the daily activity strip,
 * and the per-topic aggregate the focus list is filtered from.
 */
export async function getProgressSummary(
  actor: Actor,
  query: ProgressSummaryQuery,
): Promise<ProgressSummary> {
  const db = await getDb();
  const start = windowStart(query.days);

  const attempts = await db
    .selectFrom("assessment_attempts as a")
    .select([
      sql<number>`count(*)`.as("attempts"),
      sql<number>`coalesce(sum(a.duration_seconds), 0)`.as("durationSeconds"),
      sql<number>`coalesce(sum(case when a.started_at >= ${start} then 1 else 0 end), 0)`.as(
        "windowAttempts",
      ),
    ])
    .where("a.user_id", "=", actor.id)
    .where("a.status", "=", "submitted")
    .executeTakeFirst();

  const items = await db
    .selectFrom("attempt_items as ai")
    .innerJoin("assessment_attempts as a", "a.id", "ai.attempt_id")
    .select([
      sql<number>`count(ai.id)`.as("answered"),
      sql<number>`coalesce(sum(case when ai.is_correct = 1 then 1 else 0 end), 0)`.as("correct"),
      sql<number>`count(ai.is_correct)`.as("graded"),
      sql<number>`coalesce(sum(case when ai.answered_at >= ${start} then 1 else 0 end), 0)`.as(
        "windowAnswered",
      ),
      sql<number>`coalesce(sum(case when ai.answered_at >= ${start} and ai.is_correct = 1 then 1 else 0 end), 0)`.as(
        "windowCorrect",
      ),
      sql<number>`coalesce(sum(case when ai.answered_at >= ${start} and ai.is_correct is not null then 1 else 0 end), 0)`.as(
        "windowGraded",
      ),
    ])
    .where("a.user_id", "=", actor.id)
    .where("a.status", "=", "submitted")
    .where("ai.answered_at", "is not", null)
    .executeTakeFirst();

  const buckets = await db
    .selectFrom("attempt_items as ai")
    .innerJoin("assessment_attempts as a", "a.id", "ai.attempt_id")
    .select([
      sql<string>`strftime('%Y-%m-%d', ai.answered_at / 1000, 'unixepoch')`.as("date"),
      sql<number>`count(*)`.as("answered"),
    ])
    .where("a.user_id", "=", actor.id)
    .where("a.status", "=", "submitted")
    .where("ai.answered_at", ">=", start)
    .groupBy(sql`strftime('%Y-%m-%d', ai.answered_at / 1000, 'unixepoch')`)
    .execute();

  const byDate = new Map(buckets.map((bucket) => [bucket.date, NUM(bucket.answered)]));
  const activity = Array.from({ length: query.days }, (_, index) => {
    const date = new Date(start + index * DAY_MS).toISOString().slice(0, 10);
    return { date, answered: byDate.get(date) ?? 0 };
  });

  const focusTopics = (await loadTopicAggregates(db, actor.id))
    .map(toPerformance)
    .filter(
      (row) =>
        row.answered >= FOCUS_MIN_ANSWERED &&
        row.accuracy !== null &&
        row.accuracy < FOCUS_BELOW_PERCENT,
    )
    .sort(
      (a, b) =>
        a.accuracy! - b.accuracy! ||
        b.answered - a.answered ||
        a.topic.id.localeCompare(b.topic.id),
    )
    .slice(0, FOCUS_LIMIT);

  const reads = await db
    .selectFrom("resource_reads")
    .select(sql<number>`count(*)`.as("n"))
    .where("user_id", "=", actor.id)
    .executeTakeFirst();

  const answered = NUM(items?.answered);
  const correct = NUM(items?.correct);
  const graded = NUM(items?.graded);
  const windowCorrect = NUM(items?.windowCorrect);
  const windowGraded = NUM(items?.windowGraded);

  return {
    totals: {
      attempts: NUM(attempts?.attempts),
      answered,
      correct,
      accuracy: percent(correct, graded),
      studyMinutes: Math.round(NUM(attempts?.durationSeconds) / 60),
      resourcesRead: NUM(reads?.n),
    },
    window: {
      days: query.days,
      attempts: NUM(attempts?.windowAttempts),
      answered: NUM(items?.windowAnswered),
      accuracy: percent(windowCorrect, windowGraded),
    },
    focusTopics,
    activity,
  };
}

/**
 * `GET /api/v1/progress/topics/{topicId}` (§6).
 *
 * A topic the student never practised is not a `404`: it is a row of zeroes with a `null`
 * accuracy, which is what the topic page needs to show an honest "no practice yet". Only an
 * unknown topic id is refused.
 */
export async function getTopicPerformance(
  actor: Actor,
  topicId: string,
): Promise<TopicPerformanceDetail> {
  const db = await getDb();

  const topic = await db
    .selectFrom("topics as t")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      "t.id as id",
      "t.title as title",
      "t.slug as slug",
      "ch.slug as chapterSlug",
      "s.id as subjectId",
      "s.name as subjectName",
      "s.slug as subjectSlug",
      "l.slug as levelSlug",
      "c.slug as curriculumSlug",
    ])
    .where("t.id", "=", topicId)
    .executeTakeFirst();

  if (!topic) throw notFound("topic");

  const aggregate = (await loadTopicAggregates(db, actor.id, topicId))[0];
  const performance: TopicPerformance = aggregate
    ? toPerformance(aggregate)
    : {
        topic: {
          id: topic.id,
          title: topic.title,
          href: url.topic(
            topic.curriculumSlug,
            topic.levelSlug,
            topic.subjectSlug,
            topic.chapterSlug,
            topic.slug,
          ),
        },
        subject: { id: topic.subjectId, name: topic.subjectName },
        attempts: 0,
        answered: 0,
        correct: 0,
        accuracy: null,
        lastPracticedAt: null,
      };

  const slices = await db
    .selectFrom("attempt_items as ai")
    .innerJoin("assessment_attempts as a", "a.id", "ai.attempt_id")
    .innerJoin("questions as q", "q.id", "ai.question_id")
    .select([
      "q.difficulty as difficulty",
      "q.question_type as questionType",
      sql<number>`count(ai.id)`.as("answered"),
      sql<number>`coalesce(sum(case when ai.is_correct = 1 then 1 else 0 end), 0)`.as("correct"),
      sql<number>`count(ai.is_correct)`.as("graded"),
    ])
    .where("a.user_id", "=", actor.id)
    .where("a.status", "=", "submitted")
    .where("q.topic_id", "=", topicId)
    .where("ai.answered_at", "is not", null)
    .groupBy(["q.difficulty", "q.question_type"])
    .execute();

  const rollUp = (
    rows: { answered: unknown; correct: unknown; graded: unknown }[],
  ): { answered: number; correct: number; accuracy: number | null } => {
    const answered = rows.reduce((sum, row) => sum + NUM(row.answered), 0);
    const correct = rows.reduce((sum, row) => sum + NUM(row.correct), 0);
    const graded = rows.reduce((sum, row) => sum + NUM(row.graded), 0);
    return { answered, correct, accuracy: percent(correct, graded) };
  };

  const byDifficulty = DIFFICULTIES.map((difficulty) => ({
    difficulty,
    ...rollUp(slices.filter((row) => row.difficulty === difficulty)),
  }));

  const byType = QUESTION_TYPES.map((type) => ({
    type,
    ...rollUp(slices.filter((row) => row.questionType === type)),
  }));

  const recent = await db
    .selectFrom("attempt_items as ai")
    .innerJoin("assessment_attempts as a", "a.id", "ai.attempt_id")
    .innerJoin("questions as q", "q.id", "ai.question_id")
    .select([
      "a.id as id",
      "a.started_at as startedAt",
      "a.submitted_at as submittedAt",
      sql<number>`count(ai.id)`.as("answered"),
      sql<number>`coalesce(sum(case when ai.is_correct = 1 then 1 else 0 end), 0)`.as("correct"),
      sql<number>`count(ai.is_correct)`.as("graded"),
    ])
    .where("a.user_id", "=", actor.id)
    .where("a.status", "=", "submitted")
    .where("q.topic_id", "=", topicId)
    .where("ai.answered_at", "is not", null)
    .groupBy(["a.id", "a.started_at", "a.submitted_at"])
    .orderBy("a.started_at", "desc")
    .orderBy("a.id", "desc")
    .limit(5)
    .execute();

  return {
    ...performance,
    byDifficulty,
    byType,
    recentAttempts: recent.map((row) => {
      const answered = NUM(row.answered);
      const correct = NUM(row.correct);
      return {
        id: row.id,
        startedAt: ISO(row.startedAt),
        submittedAt: row.submittedAt === null ? null : ISO(row.submittedAt),
        answered,
        correct,
        accuracy: percent(correct, NUM(row.graded)),
      };
    }),
  };
}

/**
 * `POST /api/v1/resources/{resourceId}/view` — the read record behind `FR-PROG-07`.
 *
 * The reader page is cached per page, so the session is not available where the render
 * happens; the browser reports the visit and this is the one place the fact is written.
 * Only a published resource is recorded, and an unknown id is a silent no-op: the route
 * answers `204` whatever happens, so progress can never cost a student the material.
 *
 * A repeat visit updates the existing row rather than adding one, which is what keeps
 * "resources read" a row count instead of a `DISTINCT` over a log.
 */
export async function recordResourceRead(actor: Actor, resourceId: string): Promise<boolean> {
  const db = await getDb();

  const resource = await db
    .selectFrom("learning_resources")
    .select("id")
    .where("id", "=", resourceId)
    .where("status", "=", "published")
    .executeTakeFirst();

  if (!resource) return false;

  const now = Date.now();

  await db
    .insertInto("resource_reads")
    .values({
      user_id: actor.id,
      resource_id: resourceId,
      first_read_at: now,
      last_read_at: now,
      read_count: 1,
    })
    .onConflict((oc) =>
      oc.columns(["user_id", "resource_id"]).doUpdateSet({
        last_read_at: now,
        read_count: sql<number>`resource_reads.read_count + 1`,
      }),
    )
    .execute();

  return true;
}

/**
 * `GET /api/v1/progress/study` (`API_CONTRACTS.md` §6, `FR-PROG-07`).
 *
 * Reading and practising, side by side per topic: how many of a topic's published
 * resources the student has opened, the minutes those represent, and whether they have
 * practised it at all. The two halves come from different tables on purpose — practice is
 * derived from `submitted` attempts, reading from `resource_reads` — so neither number can
 * be inflated by the other.
 *
 * Only topics with at least one published resource appear: a topic with nothing to read is
 * not a gap in study progress. A topic that was read but never practised is the interesting
 * row, and it is here.
 */
export async function listStudyProgress(
  actor: Actor,
  query: StudyProgressQuery,
): Promise<StudyProgressList> {
  const db = await getDb();

  const base = db
    .selectFrom("learning_resources as r")
    .innerJoin("topics as t", "t.id", "r.topic_id")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .leftJoin("resource_reads as rr", (join) =>
      join.onRef("rr.resource_id", "=", "r.id").on("rr.user_id", "=", actor.id),
    )
    .where("r.status", "=", "published")
    .where("t.status", "=", "published");

  const filtered = query.subjectId === undefined ? base : base.where("s.id", "=", query.subjectId);

  const rows = await filtered
    .select([
      "t.id as topicId",
      "t.title as topicTitle",
      "t.slug as topicSlug",
      "ch.slug as chapterSlug",
      "s.id as subjectId",
      "s.name as subjectName",
      "s.slug as subjectSlug",
      "l.slug as levelSlug",
      "c.slug as curriculumSlug",
      sql<number>`count(r.id)`.as("resourcesTotal"),
      sql<number>`count(rr.resource_id)`.as("resourcesRead"),
      sql<number>`coalesce(sum(case when rr.resource_id is null then 0 else r.reading_minutes end), 0)`.as(
        "minutesRead",
      ),
      sql<number>`max(rr.last_read_at)`.as("lastReadAt"),
    ])
    .groupBy([
      "t.id",
      "t.title",
      "t.slug",
      "ch.slug",
      "s.id",
      "s.name",
      "s.slug",
      "l.slug",
      "c.slug",
    ])
    .execute();

  const practised = new Set((await loadTopicAggregates(db, actor.id)).map((row) => row.topicId));

  const data = rows
    .map((row) => ({
      subject: { id: row.subjectId, name: row.subjectName },
      topic: {
        id: row.topicId,
        title: row.topicTitle,
        href: url.topic(
          row.curriculumSlug,
          row.levelSlug,
          row.subjectSlug,
          row.chapterSlug,
          row.topicSlug,
        ),
      },
      resourcesRead: NUM(row.resourcesRead),
      resourcesTotal: NUM(row.resourcesTotal),
      minutesRead: NUM(row.minutesRead),
      practised: practised.has(row.topicId),
      lastReadAt: row.lastReadAt === null ? null : ISO(NUM(row.lastReadAt)),
    }))
    // Most recently read first, never-read last: the top of the list is where the student
    // left off, and the bottom is what is still untouched. Ties break on the title.
    .sort((a, b) => {
      const at = a.lastReadAt === null ? -1 : Date.parse(a.lastReadAt);
      const bt = b.lastReadAt === null ? -1 : Date.parse(b.lastReadAt);
      if (at !== bt) return bt - at;
      return a.topic.title.localeCompare(b.topic.title) || a.topic.id.localeCompare(b.topic.id);
    });

  return { data };
}
