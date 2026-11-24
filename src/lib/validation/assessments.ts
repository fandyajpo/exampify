import { z } from "zod";

import { questionDetailDtoSchema } from "./questions";
import { gateResultSchema } from "./resources";
import { contentStatusSchema, difficultySchema, slugSchema } from "./taxonomy";

/**
 * Assessment request and response shapes (`API_CONTRACTS.md` §7.3,
 * `QUESTION_ENGINE.md` §10.2).
 *
 * Scope is `topicId` (a topic's practice set) or `subjectId` alone (a course-wide practice
 * test), and the stored `scope_key` is whichever of the two identifies the slug scope. An
 * item is a question reference plus an optional points override; the composer replaces the
 * whole list on save, never patches one item, because the order is part of the contract.
 */

export const ASSESSMENT_MODES = ["practice", "test", "mock"] as const;
export const assessmentModeSchema = z.enum(ASSESSMENT_MODES);

const id = z.string().trim().min(1).max(128);
const points = z.number().int().min(1).max(10);
const isoTimestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), "Send the `updatedAt` you last read.");

export const assessmentItemInputSchema = z
  .object({ questionId: id, pointsOverride: points.optional() })
  .strict();

const assessmentFields = {
  slug: slugSchema.optional(),
  title: z.string().trim().min(3).max(120),
  descriptionMd: z.string().trim().max(4_000).nullish(),
  difficulty: difficultySchema.optional(),
  durationSeconds: z.number().int().min(60).max(10_800).nullish(),
};

/**
 * `POST /studio/assessments`. `items` may be empty so the composer can create the shell
 * first; the publish gate is what requires 1–60 items (`QUESTION_ENGINE.md` §10.2 item 1).
 */
export const assessmentCreateSchema = z
  .object({
    topicId: id.nullish(),
    subjectId: id,
    ...assessmentFields,
    mode: assessmentModeSchema.optional(),
    items: z.array(assessmentItemInputSchema).max(60),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.mode === "practice" && input.durationSeconds != null) {
      ctx.addIssue({
        code: "custom",
        path: ["durationSeconds"],
        message: "A practice set is untimed. Leave the duration blank or choose a timed mode.",
      });
    }
    if (input.mode !== "practice" && input.durationSeconds == null) {
      ctx.addIssue({
        code: "custom",
        path: ["durationSeconds"],
        message: "A timed set needs a duration between 60 and 10 800 seconds.",
      });
    }
  });

/** `PATCH /studio/assessments/{id}`: `items` is replaced wholesale when sent. */
export const assessmentUpdateSchema = z
  .object({
    slug: slugSchema.optional(),
    title: assessmentFields.title.optional(),
    descriptionMd: assessmentFields.descriptionMd,
    mode: assessmentModeSchema.optional(),
    difficulty: difficultySchema.optional(),
    durationSeconds: assessmentFields.durationSeconds,
    items: z.array(assessmentItemInputSchema).max(60).optional(),
    expectedUpdatedAt: isoTimestamp,
  })
  .strict();

/** `GET /studio/assessments` filters (§7.3). */
export const assessmentListQuerySchema = z
  .object({
    topicId: id.optional(),
    subjectId: id.optional(),
    mode: assessmentModeSchema.optional(),
    status: contentStatusSchema.optional(),
    q: z.string().trim().max(120).optional(),
    sort: z.enum(["updatedAt", "createdAt"]).optional(),
    dir: z.enum(["asc", "desc"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    cursor: z.string().max(500).optional(),
  })
  .strict();

export const assessmentDtoSchema = z.object({
  id: z.string(),
  topicId: z.string().nullable(),
  subjectId: z.string(),
  slug: z.string(),
  title: z.string(),
  mode: assessmentModeSchema,
  difficulty: difficultySchema,
  durationSeconds: z.number().int().nullable(),
  questionCount: z.number().int(),
  status: contentStatusSchema,
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const assessmentItemDtoSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  position: z.number().int(),
  pointsOverride: z.number().int().nullable(),
  question: questionDetailDtoSchema,
});

export const assessmentDetailDtoSchema = assessmentDtoSchema.extend({
  descriptionMd: z.string().nullable(),
  items: z.array(assessmentItemDtoSchema),
});

/** `GET …/availability`: the composer's live pool counts for the assessment's scope. */
export const assessmentAvailabilitySchema = z.object({
  scope: z.object({ topicId: z.string().nullable(), subjectId: z.string() }),
  total: z.number().int(),
  published: z.number().int(),
  draft: z.number().int(),
  byType: z.record(z.string(), z.number().int()),
  byDifficulty: z.record(z.string(), z.number().int()),
});

export const assessmentEnvelopeSchema = z.object({ data: assessmentDtoSchema });
export const assessmentDetailEnvelopeSchema = z.object({ data: assessmentDetailDtoSchema });
export const assessmentListSchema = z.object({
  data: z.array(assessmentDtoSchema),
  pagination: z.object({
    limit: z.number().int(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});
export const assessmentAvailabilityEnvelopeSchema = z.object({
  data: assessmentAvailabilitySchema,
});
export const assessmentGateEnvelopeSchema = z.object({ data: gateResultSchema });

export type AssessmentMode = z.infer<typeof assessmentModeSchema>;
export type AssessmentItemInput = z.infer<typeof assessmentItemInputSchema>;
export type AssessmentCreateInput = z.infer<typeof assessmentCreateSchema>;
export type AssessmentUpdateInput = z.infer<typeof assessmentUpdateSchema>;
export type AssessmentListQuery = z.infer<typeof assessmentListQuerySchema>;
export type AssessmentDto = z.infer<typeof assessmentDtoSchema>;
export type AssessmentItemDto = z.infer<typeof assessmentItemDtoSchema>;
export type AssessmentDetailDto = z.infer<typeof assessmentDetailDtoSchema>;
export type AssessmentAvailability = z.infer<typeof assessmentAvailabilitySchema>;
