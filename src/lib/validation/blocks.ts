/**
 * Block payload contract (`CONTENT_MODEL.md` §5): one Zod discriminated union, used by the
 * renderer here and reused by the editor and route handlers in Phase 2. Unknown `kind` or
 * unknown keys are rejected, never passed through.
 *
 * Payloads come from the database as JSON text, so the renderer parses before rendering:
 * a malformed row fails loudly in development instead of rendering half a page.
 */
import { z } from "zod";

const richText = z.object({
  v: z.literal(1),
  markdown: z.string().min(1).max(40_000),
});

const heading = z.object({
  v: z.literal(1),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().min(1).max(160),
  anchor: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80)
    .optional(),
});

const image = z.object({
  v: z.literal(1),
  mediaId: z.string().uuid(),
  caption: z.string().max(240).optional(),
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
});

const formula = z.object({
  v: z.literal(1),
  latex: z.string().min(1).max(2_000),
  displayMode: z.boolean(),
});

const table = z.object({
  v: z.literal(1),
  caption: z.string().max(240).optional(),
  header: z.array(z.string().max(120)).min(2).max(12),
  rows: z.array(z.array(z.string().max(500)).min(2).max(12)).max(50),
});

const callout = z.object({
  v: z.literal(1),
  tone: z.enum(["tip", "warning", "example", "examtip", "definition"]),
  markdown: z.string().min(1).max(8_000),
});

const video = z.object({
  v: z.literal(1),
  provider: z.enum(["youtube", "vimeo"]),
  providerId: z.string().min(3).max(64),
  title: z.string().min(1).max(160),
  durationSeconds: z.number().int().positive().max(14_400).optional(),
});

const download = z.object({
  v: z.literal(1),
  mediaId: z.string().uuid(),
  label: z.string().min(1).max(120),
  byteSize: z.number().int().positive(),
});

const questionSection = z.object({
  v: z.literal(1),
  assessmentId: z.string().uuid(),
  heading: z.string().max(160).optional(),
});

const relatedMaterial = z.object({
  v: z.literal(1),
  resourceIds: z.array(z.string().uuid()).min(1).max(6),
  heading: z.string().max(160).optional(),
});

export const blockPayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rich_text"), payload: richText }),
  z.object({ kind: z.literal("heading"), payload: heading }),
  z.object({ kind: z.literal("image"), payload: image }),
  z.object({ kind: z.literal("formula"), payload: formula }),
  z.object({ kind: z.literal("table"), payload: table }),
  z.object({ kind: z.literal("callout"), payload: callout }),
  z.object({ kind: z.literal("video"), payload: video }),
  z.object({ kind: z.literal("download"), payload: download }),
  z.object({ kind: z.literal("question_section"), payload: questionSection }),
  z.object({ kind: z.literal("related_material"), payload: relatedMaterial }),
]);

export type BlockPayload = z.infer<typeof blockPayloadSchema>;
export type BlockKind = BlockPayload["kind"];

/** Parses a stored payload; `null` means the row is invalid and must not be rendered. */
export function parseBlock(kind: string, payload: string): BlockPayload | null {
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return null;
  }
  const result = blockPayloadSchema.safeParse({ kind, payload: json });
  return result.success ? result.data : null;
}
