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
