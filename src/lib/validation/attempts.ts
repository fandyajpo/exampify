import { z } from "zod";

import { difficultySchema } from "./taxonomy";
import { optionLabelSchema, questionTypeSchema } from "./questions";

/**
 * Attempt request shapes (`API_CONTRACTS.md` §5, `QUESTION_ENGINE.md` §3).
 *
 * A `StudentAnswer` is the mirror of `AnswerKey` without the correctness: the same `v` and
 * `type` discriminator, a nullable selection because an unanswered item is still a valid
 * save, and no scoring rule. Grading compares the two unions and nothing else
 * (`lib/practice/grading.ts`), so a client cannot smuggle a scoring hint into a save.
 *
 * `questionId` is not part of the answer: the route reads it from the item path, which is
 * what keeps a batch save from writing one attempt's answer onto another's question.
 */

export const STUDENT_ANSWER_MAX_TEXT = 500;

export const studentAnswerSchema = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("multiple_choice"), option: optionLabelSchema.nullable() }).strict(),
  z
    .object({
      v: z.literal(1),
      type: z.literal("multiple_select"),
      options: z.array(optionLabelSchema).max(8),
    })
    .strict(),
  z.object({ v: z.literal(1), type: z.literal("true_false"), value: z.boolean().nullable() }).strict(),
  z
    .object({
      v: z.literal(1),
      type: z.literal("short_answer"),
      text: z.string().max(STUDENT_ANSWER_MAX_TEXT),
    })
    .strict(),
]);

export type StudentAnswer = z.infer<typeof studentAnswerSchema>;

// ---------------------------------------------------------------------------
// POST /api/v1/attempts (§5.1)
// ---------------------------------------------------------------------------

// 128, like the question schemas: a seeded id such as `seed-topic-…-carbohydrates` is longer
// than a UUID and is still a valid scope id.
const id = z.string().trim().min(1).max(128);

/** §5.1 closes the set: 5, 10, 20 or 40, never an arbitrary count (API-01). */
export const ATTEMPT_QUESTION_COUNTS = [5, 10, 20, 40] as const;
export const attemptQuestionCountSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(20),
  z.literal(40),
]);

const practiceSelection = {
  questionCount: attemptQuestionCountSchema,
  difficulty: z.union([z.literal("any"), difficultySchema]),
  questionTypes: z.array(questionTypeSchema).max(4),
  order: z.enum(["random", "fixed"]).optional(),
};

/**
 * The scope ids are part of each branch, not optional on a shared body, so "exactly the ids
 * implied by `source`" is a parse rule rather than a check the service has to remember:
 * a `topic` body carrying `subjectId` is an unknown field and is refused before any query.
 */
export const createAttemptSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("assessment"), assessmentId: id }).strict(),
  z.object({ source: z.literal("topic"), topicId: id, ...practiceSelection }).strict(),
  z.object({ source: z.literal("chapter"), chapterId: id, ...practiceSelection }).strict(),
  z.object({ source: z.literal("subject"), subjectId: id, ...practiceSelection }).strict(),
  z.object({ source: z.literal("resource"), resourceId: id, assessmentId: id }).strict(),
]);

export const attemptModeSchema = z.enum(["practice", "test", "mock"]);
export const attemptStatusSchema = z.enum(["in_progress", "submitted", "abandoned", "expired"]);

/** The `§5.1` student question: text, options and points — never the key or the explanation. */
export const studentQuestionSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  type: questionTypeSchema,
  difficulty: difficultySchema,
  stemHtml: z.string(),
  media: z
    .object({ url: z.string(), alt: z.string(), width: z.number().int(), height: z.number().int() })
    .nullable(),
  options: z.array(z.object({ label: optionLabelSchema, html: z.string() })),
  pointsMax: z.number(),
  answer: studentAnswerSchema.nullable(),
});

export const attemptConfigSchema = z.record(z.string(), z.unknown());

export const attemptDtoSchema = z.object({
  id: z.string(),
  status: attemptStatusSchema,
  startedAt: z.string(),
  expiresAt: z.string(),
  mode: attemptModeSchema,
  questionCount: z.number().int(),
  requestedCount: z.number().int(),
  durationSeconds: z.number().int().nullable(),
  config: attemptConfigSchema,
});

export const attemptEnvelopeSchema = z.object({
  data: z.object({ attempt: attemptDtoSchema, questions: z.array(studentQuestionSchema) }),
});

export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
export type AttemptDto = z.infer<typeof attemptDtoSchema>;
export type StudentQuestion = z.infer<typeof studentQuestionSchema>;
export type AttemptEnvelope = z.infer<typeof attemptEnvelopeSchema>;
