import { z } from "zod";

import { MEDIA_PURPOSES } from "@/lib/content/media";

/**
 * Media request/response shapes (`API_CONTRACTS.md` §7.6).
 *
 * `byteSize` is what the uploader declares and what the presigned `PUT` is signed for; the
 * confirm step re-reads it from the bucket, so a lie is caught before the row is `ready`.
 */

export const mediaPurposeSchema = z.enum(MEDIA_PURPOSES);
export const mediaStatusSchema = z.enum(["pending", "ready", "deleted"]);

export const mediaUploadUrlSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(120),
    byteSize: z.number().int().positive(),
    purpose: mediaPurposeSchema,
  })
  .strict();

export const mediaAltTextSchema = z.object({ altText: z.string().trim().max(240) }).strict();

export const mediaListQuerySchema = z
  .object({
    /** Alt text is the only human-readable field on the row, so it is what `q` searches. */
    q: z.string().trim().max(120).optional(),
    purpose: mediaPurposeSchema.optional(),
    status: mediaStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(512).optional(),
  })
  .strict();

export const mediaDtoSchema = z.object({
  id: z.string(),
  url: z.string().nullable(),
  mimeType: z.string(),
  byteSize: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  altText: z.string(),
  visibility: z.enum(["public", "private"]),
  status: mediaStatusSchema,
  createdAt: z.string(),
});

export const mediaUploadTicketSchema = z.object({
  mediaId: z.string(),
  uploadUrl: z.string(),
  method: z.literal("PUT"),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
});

export const mediaDownloadTicketSchema = z.object({
  url: z.string(),
  expiresAt: z.string(),
});

export const mediaEnvelopeSchema = z.object({ data: mediaDtoSchema });
export const mediaTicketEnvelopeSchema = z.object({ data: mediaUploadTicketSchema });
export const mediaDownloadEnvelopeSchema = z.object({ data: mediaDownloadTicketSchema });
export const mediaListSchema = z.object({
  data: z.array(mediaDtoSchema),
  nextCursor: z.string().nullable(),
});

export type MediaUploadUrlInput = z.infer<typeof mediaUploadUrlSchema>;
export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;
export type MediaDto = z.infer<typeof mediaDtoSchema>;
export type MediaUploadTicket = z.infer<typeof mediaUploadTicketSchema>;
export type MediaDownloadTicket = z.infer<typeof mediaDownloadTicketSchema>;
export type MediaListPage = z.infer<typeof mediaListSchema>;
