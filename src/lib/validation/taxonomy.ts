import { z } from "zod";

import { SLUG_MAX, SLUG_PATTERN } from "@/lib/slug";

/**
 * Taxonomy request and response shapes (`API_CONTRACTS.md` §7.1,
 * `DATABASE_SCHEMA.md` §6.1–6.4).
 *
 * One schema per operation is what the handler parses and what the OpenAPI registry
 * publishes, so a documented field is a validated field. Everything is `.strict()`: an
 * unknown key is `422 UNKNOWN_FIELD`, never silently ignored (§2).
 *
 * These routes are `admin`-only (`taxonomy:write`), which is why `status` is accepted
 * directly: taxonomy carries no publish gates, and the `§7.5` transition endpoint exists for
 * the content entities that do.
 */

export const contentStatusSchema = z.enum(["draft", "in_review", "published", "archived"]);

/** `DATABASE_SCHEMA.md` §6.6: editorial difficulty, shared by resources and questions. */
export const difficultySchema = z.enum(["easy", "medium", "hard", "very_hard"]);

export const slugSchema = z
  .string()
  .min(1)
  .max(SLUG_MAX)
  .regex(SLUG_PATTERN, "Use lower-case letters, numbers and single hyphens.");

// Length limits are `CONTENT_MODEL.md` §4.1–4.5, not one shared "name" rule: a curriculum
// name may be long, a level name may not, and a subject sits between them.
const curriculumName = z.string().trim().min(2).max(80);
const levelName = z.string().trim().min(1).max(40);
const subjectName = z.string().trim().min(1).max(60);
const title = z.string().trim().min(1).max(100);
const shortName = z.string().trim().min(1).max(20);
const descriptionMd = z.string().max(4_000);
const position = z.number().int().min(0).max(10_000);
const isoTimestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), "Send the `updatedAt` you last read.");
const id = z.string().min(1).max(64);

/** The optimistic-concurrency token every studio write carries (§2, §7.2). */
const expectedUpdatedAt = isoTimestamp;

// ---------------------------------------------------------------------------
// Curricula and levels share a shape; they differ only by parent.
// ---------------------------------------------------------------------------

export const curriculumCreateSchema = z
  .object({
    slug: slugSchema.optional(),
    name: curriculumName,
    shortName,
    descriptionMd: descriptionMd.nullish(),
    position: position.optional(),
  })
  .strict();

export const curriculumUpdateSchema = z
  .object({
    slug: slugSchema.optional(),
    name: curriculumName.optional(),
    shortName: shortName.optional(),
    descriptionMd: descriptionMd.nullish(),
    position: position.optional(),
    status: contentStatusSchema.optional(),
    expectedUpdatedAt,
  })
  .strict();

export const levelCreateSchema = z
  .object({
    slug: slugSchema.optional(),
    name: levelName,
    descriptionMd: descriptionMd.nullish(),
    position: position.optional(),
  })
  .strict();

export const levelUpdateSchema = curriculumUpdateSchema;

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export const subjectCreateSchema = z
  .object({
    educationLevelId: id,
    subjectGroupId: id,
    slug: slugSchema.optional(),
    name: subjectName,
    summary: z.string().max(320).nullish(),
    colorToken: z.string().max(20).optional(),
    iconKey: z.string().max(40).optional(),
    seoTitle: z.string().max(60).nullish(),
    seoDescription: z.string().max(160).nullish(),
    position: position.optional(),
  })
  .strict();

export const subjectUpdateSchema = z
  .object({
    slug: slugSchema.optional(),
    name: subjectName.optional(),
    summary: z.string().max(320).nullish(),
    colorToken: z.string().max(20).optional(),
    iconKey: z.string().max(40).optional(),
    seoTitle: z.string().max(60).nullish(),
    seoDescription: z.string().max(160).nullish(),
    position: position.optional(),
    status: contentStatusSchema.optional(),
    expectedUpdatedAt,
  })
  .strict();

/** `POST /studio/{entity}/reorder` (§7.1). The list must be the complete set of siblings. */
export const reorderSchema = z
  .object({
    parentId: id.optional(),
    orderedIds: z.array(id).min(1).max(200),
  })
  .strict();

/** `GET /studio/subjects` filters (§7.1, §10: allow-listed, cursor paginated). */
export const subjectListQuerySchema = z
  .object({
    levelId: id.optional(),
    status: contentStatusSchema.optional(),
    q: z.string().trim().max(120).optional(),
    sort: z.enum(["position", "name", "updatedAt"]).optional(),
    dir: z.enum(["asc", "desc"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    cursor: z.string().max(500).optional(),
  })
  .strict();

/** `GET /studio/chapters` filter (§7.1). Only the parent id is documented here. */
export const chapterListQuerySchema = z.object({ subjectId: id.optional() }).strict();

/** `GET /studio/topics` filters (§7.1). */
export const topicListQuerySchema = z
  .object({
    chapterId: id.optional(),
    status: contentStatusSchema.optional(),
    q: z.string().trim().max(120).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Chapters and topics (`CONTENT_MODEL.md` §4.4–4.5). `status` is deliberately absent: it
// moves through `§7.5 transition`, which is where the publish gates run.
// ---------------------------------------------------------------------------

export const chapterCreateSchema = z
  .object({
    subjectId: id,
    slug: slugSchema.optional(),
    title,
    summary: z.string().trim().max(240).nullish(),
    position: position.optional(),
  })
  .strict();

export const chapterUpdateSchema = z
  .object({
    slug: slugSchema.optional(),
    title: title.optional(),
    summary: z.string().trim().max(240).nullish(),
    position: position.optional(),
    expectedUpdatedAt,
  })
  .strict();

/** 1–12 plain-text strings, 8–160 characters each (`CONTENT_MODEL.md` §4.5). */
export const learningObjectivesSchema = z
  .array(z.string().trim().min(8).max(160))
  .min(1)
  .max(12);

export const topicCreateSchema = z
  .object({
    chapterId: id,
    slug: slugSchema.optional(),
    title,
    summary: z.string().trim().max(320).nullish(),
    learningObjectives: learningObjectivesSchema,
    estimatedMinutes: z.number().int().min(5).max(240).nullish(),
    position: position.optional(),
  })
  .strict();

export const topicUpdateSchema = z
  .object({
    slug: slugSchema.optional(),
    title: title.optional(),
    summary: z.string().trim().max(320).nullish(),
    learningObjectives: learningObjectivesSchema.optional(),
    estimatedMinutes: z.number().int().min(5).max(240).nullish(),
    position: position.optional(),
    expectedUpdatedAt,
  })
  .strict();

// ---------------------------------------------------------------------------
// Response shapes, published in the generated document
// ---------------------------------------------------------------------------

export const curriculumDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  shortName: z.string(),
  descriptionMd: z.string().nullable(),
  status: contentStatusSchema,
  position: z.number().int(),
  updatedAt: z.string(),
});

export const levelDtoSchema = z.object({
  id: z.string(),
  curriculumId: z.string(),
  slug: z.string(),
  name: z.string(),
  descriptionMd: z.string().nullable(),
  status: contentStatusSchema,
  position: z.number().int(),
  updatedAt: z.string(),
});

export const subjectDtoSchema = z.object({
  id: z.string(),
  educationLevelId: z.string(),
  subjectGroupId: z.string(),
  slug: z.string(),
  name: z.string(),
  summary: z.string().nullable(),
  colorToken: z.string(),
  iconKey: z.string(),
  status: contentStatusSchema,
  position: z.number().int(),
  updatedAt: z.string(),
});

/** The studio's taxonomy tree: the list endpoint nests each curriculum's levels (§7.1). */
export const curriculumTreeDtoSchema = curriculumDtoSchema.extend({ levels: z.array(levelDtoSchema) });

export const curriculumListSchema = z.object({ data: z.array(curriculumTreeDtoSchema) });
export const curriculumEnvelopeSchema = z.object({ data: curriculumDtoSchema });
export const levelEnvelopeSchema = z.object({ data: levelDtoSchema });
export const subjectEnvelopeSchema = z.object({ data: subjectDtoSchema });

export const chapterDtoSchema = z.object({
  id: z.string(),
  subjectId: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  status: contentStatusSchema,
  position: z.number().int(),
  updatedAt: z.string(),
});

export const topicDtoSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  learningObjectives: z.array(z.string()),
  estimatedMinutes: z.number().int().nullable(),
  status: contentStatusSchema,
  position: z.number().int(),
  updatedAt: z.string(),
});

export const chapterEnvelopeSchema = z.object({ data: chapterDtoSchema });
export const topicEnvelopeSchema = z.object({ data: topicDtoSchema });
export const chapterListSchema = z.object({ data: z.array(chapterDtoSchema) });
export const topicListSchema = z.object({ data: z.array(topicDtoSchema) });
export const subjectListSchema = z.object({
  data: z.array(subjectDtoSchema),
  pagination: z.object({
    limit: z.number().int(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});

export type CurriculumCreateInput = z.infer<typeof curriculumCreateSchema>;
export type CurriculumUpdateInput = z.infer<typeof curriculumUpdateSchema>;
export type LevelCreateInput = z.infer<typeof levelCreateSchema>;
export type LevelUpdateInput = z.infer<typeof levelUpdateSchema>;
export type SubjectCreateInput = z.infer<typeof subjectCreateSchema>;
export type SubjectUpdateInput = z.infer<typeof subjectUpdateSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
export type CurriculumDto = z.infer<typeof curriculumDtoSchema>;
export type CurriculumTreeDto = z.infer<typeof curriculumTreeDtoSchema>;
export type LevelDto = z.infer<typeof levelDtoSchema>;
export type SubjectDto = z.infer<typeof subjectDtoSchema>;
export type SubjectListQuery = z.infer<typeof subjectListQuerySchema>;
export type ChapterCreateInput = z.infer<typeof chapterCreateSchema>;
export type ChapterUpdateInput = z.infer<typeof chapterUpdateSchema>;
export type TopicCreateInput = z.infer<typeof topicCreateSchema>;
export type TopicUpdateInput = z.infer<typeof topicUpdateSchema>;
export type ChapterDto = z.infer<typeof chapterDtoSchema>;
export type TopicDto = z.infer<typeof topicDtoSchema>;
export type ChapterListQuery = z.infer<typeof chapterListQuerySchema>;
export type TopicListQuery = z.infer<typeof topicListQuerySchema>;
export type ContentStatus = z.infer<typeof contentStatusSchema>;
