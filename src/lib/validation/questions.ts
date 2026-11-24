import { z } from "zod";

import { gateResultSchema } from "./resources";
import { contentStatusSchema, difficultySchema } from "./taxonomy";

/**
 * Question request and response shapes (`API_CONTRACTS.md` §7.4, `QUESTION_ENGINE.md` §3).
 *
 * `answerKey` is the single scoring payload (ADR-004), so it is a closed discriminated union
 * keyed on `type`: an option label for a single choice, labels plus a scoring rule for a
 * multiple select, a boolean for true/false, and accepted strings for a short answer. Every
 * read parses the stored JSON with this schema; a row that no longer parses fails closed.
 *
 * `points` is whole points on the wire and hundredths in the database, converted in exactly
 * one mapper (`QUESTION_ENGINE.md` §4).
 */

export const QUESTION_TYPES = [
  "multiple_choice",
  "multiple_select",
  "true_false",
  "short_answer",
] as const;

export const OPTION_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export const questionTypeSchema = z.enum(QUESTION_TYPES);
export const optionLabelSchema = z.enum(OPTION_LABELS);

export const answerKeySchema = z.discriminatedUnion("type", [
  z.object({ v: z.literal(1), type: z.literal("multiple_choice"), correct: optionLabelSchema }).strict(),
  z
    .object({
      v: z.literal(1),
      type: z.literal("multiple_select"),
      correct: z.array(optionLabelSchema).min(1).max(8),
      scoring: z.enum(["all_or_nothing", "partial"]),
    })
    .strict(),
  z.object({ v: z.literal(1), type: z.literal("true_false"), correct: z.boolean() }).strict(),
  z
    .object({
      v: z.literal(1),
      type: z.literal("short_answer"),
      accepted: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
      keywords: z
        .object({ all: z.array(z.string().trim().min(1).max(80)).min(1).max(10) })
        .strict()
        .optional(),
    })
    .strict(),
]);

const id = z.string().trim().min(1).max(128);
const isoTimestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), "Send the `updatedAt` you last read.");

const stem = z.string().trim().min(10).max(4_000);
const explanation = z.string().trim().max(4_000);
const points = z.number().int().min(1).max(10);

export const questionOptionSchema = z
  .object({
    label: optionLabelSchema,
    contentMd: z.string().trim().min(1).max(2_000),
    feedbackMd: z.string().trim().max(1_000).nullish(),
  })
  .strict();

/**
 * `POST /studio/questions`. A draft may be incomplete — the editor saves the stem before the
 * options exist — so `options` and `answerKey` are optional here and the service fills a
 * skeleton for the chosen type. Every §10.1 gate still applies at publish.
 */
export const questionCreateSchema = z
  .object({
    topicId: id,
    secondaryTopicIds: z.array(id).max(7).optional(),
    type: questionTypeSchema,
    stemMd: stem,
    difficulty: difficultySchema.optional(),
    explanationMd: explanation.optional(),
    points: points.optional(),
    mediaId: id.nullish(),
    options: z.array(questionOptionSchema).max(8).optional(),
    answerKey: answerKeySchema.optional(),
  })
  .strict();

/** `PATCH /studio/questions/{id}`: partial; a sent `options`/`answerKey` is replaced whole. */
export const questionUpdateSchema = z
  .object({
    type: questionTypeSchema.optional(),
    stemMd: stem.optional(),
    difficulty: difficultySchema.optional(),
    explanationMd: explanation.optional(),
    points: points.optional(),
    mediaId: id.nullish(),
    secondaryTopicIds: z.array(id).max(7).optional(),
    options: z.array(questionOptionSchema).max(8).optional(),
    answerKey: answerKeySchema.optional(),
    expectedUpdatedAt: isoTimestamp,
  })
  .strict();

/** The `§7.4 validate` dry run names the row it should evaluate. */
export const questionValidateSchema = z.object({ id }).strict();

/** `GET /studio/questions` filters (§7.4, §10: allow-listed and cursor paginated). */
export const questionListQuerySchema = z
  .object({
    topicId: id.optional(),
    subjectId: id.optional(),
    type: questionTypeSchema.optional(),
    difficulty: difficultySchema.optional(),
    status: contentStatusSchema.optional(),
    q: z.string().trim().max(120).optional(),
    authorId: id.optional(),
    sort: z.enum(["updatedAt", "createdAt"]).optional(),
    dir: z.enum(["asc", "desc"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    cursor: z.string().max(500).optional(),
  })
  .strict();

export const questionDtoSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  type: questionTypeSchema,
  stemMd: z.string(),
  difficulty: difficultySchema,
  points: z.number().int(),
  status: contentStatusSchema,
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const questionOptionDtoSchema = z.object({
  label: optionLabelSchema,
  contentMd: z.string(),
  feedbackMd: z.string().nullable(),
});

/** The studio read includes `answerKey`; list responses never do (`QUESTION_ENGINE.md` §12). */
export const questionDetailDtoSchema = questionDtoSchema.extend({
  secondaryTopicIds: z.array(z.string()),
  explanationMd: z.string(),
  mediaId: z.string().nullable(),
  options: z.array(questionOptionDtoSchema),
  answerKey: answerKeySchema,
});

export const questionEnvelopeSchema = z.object({ data: questionDetailDtoSchema });
export const questionListSchema = z.object({
  data: z.array(questionDtoSchema),
  pagination: z.object({
    limit: z.number().int(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});
export const questionGateEnvelopeSchema = z.object({ data: gateResultSchema });

export type AnswerKey = z.infer<typeof answerKeySchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type OptionLabel = z.infer<typeof optionLabelSchema>;
export type QuestionOptionInput = z.infer<typeof questionOptionSchema>;
export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;
export type QuestionUpdateInput = z.infer<typeof questionUpdateSchema>;
export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;
export type QuestionDto = z.infer<typeof questionDtoSchema>;
export type QuestionOptionDto = z.infer<typeof questionOptionDtoSchema>;
export type QuestionDetailDto = z.infer<typeof questionDetailDtoSchema>;
