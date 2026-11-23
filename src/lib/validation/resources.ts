import { z } from "zod";

import { blockPayloadSchema, type BlockKind } from "./blocks";
import { contentStatusSchema, difficultySchema, slugSchema } from "./taxonomy";

/**
 * Resource and block request/response shapes (`API_CONTRACTS.md` §7.2,
 * `CONTENT_MODEL.md` §4.6, §5).
 *
 * Block payloads are validated by `lib/validation/blocks`, the same union the renderer and
 * the publish gate use. `kind` stays a plain string here so an unknown kind is the
 * documented `422 INVALID_BLOCK` with the offending path, not a generic Zod failure
 * (API-19); the service runs the union parse.
 */

export const BLOCK_KINDS = [
  "rich_text",
  "heading",
  "image",
  "formula",
  "table",
  "callout",
  "video",
  "download",
  "question_section",
  "related_material",
] as const satisfies readonly BlockKind[];

const id = z.string().min(1).max(64);
const position = z.number().int().min(0).max(10_000);
const isoTimestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), "Send the `updatedAt` you last read.");

export const resourceCreateSchema = z
  .object({
    slug: slugSchema.optional(),
    title: z.string().trim().min(1).max(120),
    subtitle: z.string().trim().max(160).nullish(),
    summary: z.string().trim().max(240).nullish(),
    difficulty: difficultySchema.optional(),
    position: position.optional(),
  })
  .strict();

export const resourceUpdateSchema = z
  .object({
    slug: slugSchema.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    subtitle: z.string().trim().max(160).nullish(),
    summary: z.string().trim().max(240).nullish(),
    difficulty: difficultySchema.optional(),
    position: position.optional(),
    expectedUpdatedAt: isoTimestamp,
  })
  .strict();

/** `POST …/blocks`: whole payload, validated against the union by the service. */
export const blockCreateSchema = z
  .object({
    kind: z.string().min(1).max(40),
    payload: z.unknown(),
    position: position.optional(),
  })
  .strict();

/** `PATCH /studio/blocks/{id}`: the payload is replaced wholesale, never patched (§7.2). */
export const blockUpdateSchema = z
  .object({
    payload: z.unknown(),
    expectedUpdatedAt: isoTimestamp,
  })
  .strict();

export const blockReorderSchema = z
  .object({ orderedIds: z.array(id).min(1).max(80) })
  .strict();

export const resourceAssessmentSchema = z
  .object({
    assessmentId: id,
    placement: z.enum(["inline", "end", "optional"]).default("end"),
    position: position.optional(),
  })
  .strict();

/** The `validate` dry run: the publish gate's blocking list plus editorial warnings. */
export const gateDetailSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
});

export const gateResultSchema = z.object({
  passing: z.boolean(),
  blocking: z.array(gateDetailSchema),
  warnings: z.array(gateDetailSchema),
});

export const resourceDtoSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  summary: z.string().nullable(),
  readingMinutes: z.number().int(),
  difficulty: difficultySchema,
  format: z.enum(["study_material", "lesson_with_practice"]),
  position: z.number().int(),
  status: contentStatusSchema,
  publishedAt: z.string().nullable(),
  version: z.number().int(),
  updatedAt: z.string(),
});

export const blockDtoSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  kind: z.string(),
  payload: z.record(z.string(), z.unknown()),
  position: z.number().int(),
  updatedAt: z.string(),
});

export const resourceEnvelopeSchema = z.object({
  data: resourceDtoSchema.extend({ blocks: z.array(blockDtoSchema) }),
});
export const resourceItemEnvelopeSchema = z.object({ data: resourceDtoSchema });
export const previewEnvelopeSchema = z.object({
  data: z.object({
    resource: resourceDtoSchema,
    blocks: z.array(z.unknown()),
    media: z.record(z.string(), z.object({ url: z.string(), alt: z.string() })),
    noindex: z.boolean(),
  }),
});
export const resourceListSchema = z.object({ data: z.array(resourceDtoSchema) });
export const blockEnvelopeSchema = z.object({ data: blockDtoSchema });
export const blockListSchema = z.object({ data: z.array(blockDtoSchema) });
export const gateEnvelopeSchema = z.object({ data: gateResultSchema });

export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;
export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>;
export type BlockCreateInput = z.infer<typeof blockCreateSchema>;
export type BlockUpdateInput = z.infer<typeof blockUpdateSchema>;
export type BlockReorderInput = z.infer<typeof blockReorderSchema>;
export type ResourceAssessmentInput = z.infer<typeof resourceAssessmentSchema>;
export type ResourceDto = z.infer<typeof resourceDtoSchema>;
export type BlockDto = z.infer<typeof blockDtoSchema>;
export type GateResult = z.infer<typeof gateResultSchema>;
export type GateDetail = z.infer<typeof gateDetailSchema>;
export type BlockPayloadValue = z.infer<typeof blockPayloadSchema>["payload"];
