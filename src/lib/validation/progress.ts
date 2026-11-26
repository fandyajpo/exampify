import { z } from "zod";

import { difficultySchema } from "./taxonomy";
import { questionTypeSchema } from "./questions";

/**
 * Progress request and response shapes (`API_CONTRACTS.md` §6).
 *
 * Every number here is derived from submitted attempts, never stored: `user_topic_stats`
 * stays unbuilt until `OQ-DB3` says a live aggregate is too slow, so the contract is the
 * same whether or not a cache exists later (`DATABASE_SCHEMA.md` §9.3).
 *
 * `accuracy` is a percentage rounded to two decimals, and `null` — not `0` — when nothing
 * has been graded. `lastPracticedAt` is `null` on a topic detail the student never
 * practised; a list row always has one, because a topic only appears there once practised.
 */

export const PROGRESS_WINDOWS = [7, 30, 90] as const;
export type ProgressWindow = (typeof PROGRESS_WINDOWS)[number];

const id = z.string().trim().min(1).max(128);

/** `?days=7|30|90`; anything outside the set is a `422`, not a silent default (§6). */
export const progressSummaryQuerySchema = z
  .object({
    days: z
      .enum(["7", "30", "90"])
      .default("30")
      .transform((value) => Number(value) as ProgressWindow),
  })
  .strict();

export type ProgressSummaryQuery = z.infer<typeof progressSummaryQuerySchema>;

export const progressTopicSortSchema = z.enum(["accuracy", "lastPracticed"]);

/**
 * `dir` is optional because the useful default differs: `accuracy` reads weakest first,
 * `lastPracticed` reads most recent first. Omitting it is the documented behaviour, not an
 * accident of sort order.
 */
export const topicPerformanceQuerySchema = z
  .object({
    subjectId: id.optional(),
    sort: progressTopicSortSchema.default("lastPracticed"),
    dir: z.enum(["asc", "desc"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(512).optional(),
  })
  .strict();

export type TopicPerformanceQuery = z.infer<typeof topicPerformanceQuerySchema>;

export const topicPerformanceSchema = z.object({
  topic: z.object({ id: z.string(), title: z.string(), href: z.string() }),
  subject: z.object({ id: z.string(), name: z.string() }),
  attempts: z.number().int(),
  answered: z.number().int(),
  correct: z.number().int(),
  accuracy: z.number().nullable(),
  lastPracticedAt: z.string().nullable(),
});

export const topicPerformanceListSchema = z.object({
  data: z.array(topicPerformanceSchema),
  pagination: z.object({
    limit: z.number().int(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});

/** One row of a breakdown: the same accuracy rule, over a narrower slice of the items. */
const accuracyRow = {
  answered: z.number().int(),
  correct: z.number().int(),
  accuracy: z.number().nullable(),
};

export const topicPerformanceDetailSchema = topicPerformanceSchema.extend({
  byDifficulty: z.array(z.object({ difficulty: difficultySchema, ...accuracyRow })),
  byType: z.array(z.object({ type: questionTypeSchema, ...accuracyRow })),
  /** The latest submitted attempts that included this topic, newest first; ≤ 5. */
  recentAttempts: z.array(
    z.object({
      id: z.string(),
      startedAt: z.string(),
      submittedAt: z.string().nullable(),
      ...accuracyRow,
    }),
  ),
});

export const topicPerformanceDetailEnvelopeSchema = z.object({
  data: topicPerformanceDetailSchema,
});

export const progressSummarySchema = z.object({
  totals: z.object({
    attempts: z.number().int(),
    answered: z.number().int(),
    correct: z.number().int(),
    accuracy: z.number().nullable(),
    /** Minutes spent inside submitted attempts, from their recorded durations. */
    studyMinutes: z.number().int(),
    /** Distinct resources the student has opened (`resource_reads`), not a 90-day count. */
    resourcesRead: z.number().int(),
  }),
  window: z.object({
    days: z.number().int(),
    attempts: z.number().int(),
    answered: z.number().int(),
    accuracy: z.number().nullable(),
  }),
  /** ≤ 5, weakest first: at least 5 answers and under 60 % accuracy (`FR-PROG-03`). */
  focusTopics: z.array(topicPerformanceSchema),
  /** One bucket per day of the window, oldest first, UTC dates. */
  activity: z.array(z.object({ date: z.string(), answered: z.number().int() })),
});

export const progressSummaryEnvelopeSchema = z.object({
  data: progressSummarySchema,
});

// ---------------------------------------------------------------------------
// GET /api/v1/progress/study (§6, FR-PROG-07)
// ---------------------------------------------------------------------------

/** `?subjectId=` only: the study table is small enough to return whole (§6). */
export const studyProgressQuerySchema = z
  .object({ subjectId: id.optional() })
  .strict();

export type StudyProgressQuery = z.infer<typeof studyProgressQuerySchema>;

/** One topic's reading against its practice: the two halves of `FR-PROG-07`. */
export const studyProgressSchema = z.object({
  subject: z.object({ id: z.string(), name: z.string() }),
  topic: z.object({ id: z.string(), title: z.string(), href: z.string() }),
  resourcesRead: z.number().int(),
  resourcesTotal: z.number().int(),
  /** Reading minutes of the distinct resources read, never of repeat visits. */
  minutesRead: z.number().int(),
  practised: z.boolean(),
  lastReadAt: z.string().nullable(),
});

export const studyProgressListSchema = z.object({ data: z.array(studyProgressSchema) });

export type TopicPerformance = z.infer<typeof topicPerformanceSchema>;
export type TopicPerformancePage = z.infer<typeof topicPerformanceListSchema>;
export type TopicPerformanceDetail = z.infer<typeof topicPerformanceDetailSchema>;
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
export type StudyProgress = z.infer<typeof studyProgressSchema>;
export type StudyProgressList = z.infer<typeof studyProgressListSchema>;
