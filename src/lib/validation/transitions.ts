import { z } from "zod";

import { contentStatusSchema } from "./taxonomy";

/**
 * The `§7.5` transition request and response (`API_CONTRACTS.md` §7.5).
 *
 * `reason` is optional because only one edge needs it; the lifecycle module enforces the
 * requirement, so a caller cannot smuggle an empty reason past a send-back by omitting it.
 * When it is sent it is 10–500 characters, the same range the audit row keeps.
 */

export const transitionSchema = z
  .object({
    to: contentStatusSchema,
    reason: z.string().trim().min(10).max(500).optional(),
  })
  .strict();

export const transitionResultSchema = z.object({
  entity: z.string(),
  id: z.string(),
  status: contentStatusSchema,
  publishedAt: z.string().nullable(),
  cacheInvalidated: z.boolean(),
  searchEnqueued: z.boolean(),
});

export const transitionEnvelopeSchema = z.object({ data: transitionResultSchema });

/** Every entity with a lifecycle (`CONTENT_MODEL.md` §6); questions and assessments since Phase 3. */
export const TRANSITION_ENTITIES = [
  "curricula",
  "levels",
  "subjects",
  "chapters",
  "topics",
  "resources",
  "questions",
  "assessments",
] as const;

export type TransitionEntity = (typeof TRANSITION_ENTITIES)[number];
export type TransitionInput = z.infer<typeof transitionSchema>;
export type TransitionResult = z.infer<typeof transitionResultSchema>;
