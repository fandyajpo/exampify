import "server-only";

import { sql, type Kysely, type Transaction } from "kysely";

import { recordAudit } from "@/lib/audit";
import {
  buildStorageKey,
  detectMime,
  DOCUMENT_MIME_TYPES,
  extensionOf,
  IMAGE_MIME_TYPES,
  imageSize,
  matchesDeclaredMime,
  mediaUploadProblem,
  sanitizeSvg,
} from "@/lib/content/media";
import { getDb } from "@/lib/db";
import type { Database, MediaAssetsTable } from "@/lib/db/schema";
import { HttpError, notFound } from "@/lib/http/errors";
import { uuidv7 } from "@/lib/ids";
import type { Actor } from "@/lib/rbac";
import {
  headObject,
  presignDownload,
  presignUpload,
  publicUrlFor,
  putObject,
  readPrefix,
  readText,
} from "@/lib/storage";
import { decodeCursor, encodeCursor } from "@/lib/validation/cursor";
import type {
  MediaDownloadTicket,
  MediaDto,
  MediaListPage,
  MediaListQuery,
  MediaUploadTicket,
  MediaUploadUrlInput,
} from "@/lib/validation/media";

/**
 * Studio media metadata (`API_CONTRACTS.md` §7.6, `CONTENT_MODEL.md` §4.9).
 *
 * The two-step upload: the presigned `PUT` is signed first, then a `pending` row is written,
 * and confirm re-reads the object from the bucket before the row becomes `ready`. A `pending`
 * row that is never confirmed is swept later, so the studio never shows an asset that points
 * at nothing.
 *
 * Deletes are soft and reference-checked: a `ready` asset referenced by any resource block,
 * subject hero or question answers `409 MEDIA_IN_USE`, because a published page must not
 * lose its diagram underneath it.
 */

type Db = Kysely<Database>;
type Executor = Db | Transaction<Database>;

const ISO = (ms: number): string => new Date(ms).toISOString();

const MEDIA_COLUMNS = [
  "id",
  "storage_key",
  "public_url",
  "mime_type",
  "byte_size",
  "width",
  "height",
  "alt_text",
  "visibility",
  "status",
  "created_at",
] as const;

type MediaRow = Pick<MediaAssetsTable, (typeof MEDIA_COLUMNS)[number]>;

function toDto(row: MediaRow): MediaDto {
  return {
    id: row.id,
    url: row.public_url,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    altText: row.alt_text,
    visibility: row.visibility,
    status: row.status,
    createdAt: ISO(row.created_at),
  };
}

/** A bucket failure is a dependency failure, not a bug in the request. */
async function storage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "media_storage_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw new HttpError(503, "STORAGE_UNAVAILABLE", "Media storage is unavailable. Try again.");
  }
}

/** `POST /studio/media/upload-url`: a pending row and a signed `PUT`. */
export async function createMediaUpload(
  actor: Actor,
  input: MediaUploadUrlInput,
): Promise<MediaUploadTicket> {
  const problem = mediaUploadProblem(input);
  if (problem) {
    throw new HttpError(422, problem.code, problem.message, [problem]);
  }

  const db = await getDb();
  const now = Date.now();
  const key = buildStorageKey(now, extensionOf(input.filename));
  const id = uuidv7(now);

  // Sign first: if the bucket is unreachable there is no row to sweep up afterwards, only a
  // URL the caller never receives.
  const upload = await storage(() =>
    presignUpload(key, { contentType: input.mimeType, contentLength: input.byteSize }),
  );

  await db
    .insertInto("media_assets")
    .values({
      id,
      provider: "tigris",
      storage_key: key,
      public_url: null,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      width: null,
      height: null,
      alt_text: "",
      checksum_sha256: null,
      visibility: "public",
      status: "pending",
      uploaded_by: actor.id,
      created_at: now,
      updated_at: now,
    })
    .execute();

  await recordAudit({
    actorId: actor.id,
    action: "media.upload",
    entityType: "media",
    entityId: id,
    metadata: { purpose: input.purpose, mimeType: input.mimeType, byteSize: input.byteSize },
  });

  return {
    mediaId: id,
    uploadUrl: upload.url,
    method: "PUT",
    headers: { "Content-Type": input.mimeType },
    expiresAt: ISO(upload.expiresAt),
  };
}

/**
 * `POST /studio/media/{mediaId}/confirm`: verify the object, then mark it `ready`.
 *
 * Idempotent: confirming a `ready` row returns it unchanged rather than re-reading the bucket,
 * which is what makes a retried confirm after a network drop safe.
 */
export async function confirmMedia(actor: Actor, mediaId: string): Promise<MediaDto> {
  const db = await getDb();
  const existing = await db
    .selectFrom("media_assets")
    .select(MEDIA_COLUMNS)
    .where("id", "=", mediaId)
    .executeTakeFirst();
  if (!existing || existing.status === "deleted") throw notFound("media asset");
  if (existing.status === "ready") return toDto(existing);

  const contentLength = await storage(() => headObject(existing.storage_key));
  if (contentLength === null) {
    throw new HttpError(
      422,
      "MEDIA_UPLOAD_MISSING",
      "The file was never uploaded. Upload it to the signed URL, then confirm.",
    );
  }
  if (contentLength !== existing.byte_size) {
    throw new HttpError(422, "MEDIA_SIZE_MISMATCH", "The uploaded size does not match the signed upload.", [
      {
        path: "byteSize",
        code: "MEDIA_SIZE_MISMATCH",
        message: `Signed for ${existing.byte_size} bytes, the object is ${contentLength}.`,
      },
    ]);
  }

  const prefix = await storage(() => readPrefix(existing.storage_key));
  const detected = detectMime(prefix);
  if (!matchesDeclaredMime(existing.mime_type, detected)) {
    throw new HttpError(422, "MEDIA_TYPE_MISMATCH", "The file's contents are not the type it claims.", [
      {
        path: "mimeType",
        code: "MEDIA_TYPE_MISMATCH",
        message: `Declared ${existing.mime_type}, the bytes look like ${detected ?? "an unknown type"}.`,
      },
    ]);
  }

  // An image block needs explicit dimensions before the browser loads the file. PNG, JPEG and
  // WebP state them in their header; an SVG or AVIF keeps `null`.
  const size = imageSize(prefix);

  // An SVG is served from the bucket as-is, so it is scrubbed before it is ever addressable.
  // The rewrite changes the object's length, so the row takes the new one with it: the stored
  // size is the only column that claims something about the bytes.
  let byteSize = existing.byte_size;
  if (existing.mime_type === "image/svg+xml") {
    const source = await storage(() => readText(existing.storage_key));
    const clean = sanitizeSvg(source);
    if (clean === null) {
      throw new HttpError(422, "SVG_UNSAFE", "That SVG declares a doctype or entity and is not accepted.");
    }
    byteSize = await storage(() => putObject(existing.storage_key, clean, "image/svg+xml"));
  }

  const now = Date.now();
  const publicUrl = existing.visibility === "public" ? publicUrlFor(existing.storage_key) : null;

  await db
    .updateTable("media_assets")
    .set({
      status: "ready",
      public_url: publicUrl,
      byte_size: byteSize,
      width: size?.width ?? existing.width,
      height: size?.height ?? existing.height,
      updated_at: now,
    })
    .where("id", "=", mediaId)
    .execute();

  await recordAudit({
    actorId: actor.id,
    action: "media.confirm",
    entityType: "media",
    entityId: mediaId,
    metadata: { mimeType: existing.mime_type, byteSize },
  });

  return toDto({
    ...existing,
    status: "ready",
    public_url: publicUrl,
    byte_size: byteSize,
    width: size?.width ?? existing.width,
    height: size?.height ?? existing.height,
  });
}

/** `GET /studio/media`: newest first, `deleted` rows excluded unless asked for. */
export async function listMedia(query: MediaListQuery): Promise<MediaListPage> {
  const db = await getDb();
  const limit = query.limit;

  let builder = db.selectFrom("media_assets").select(MEDIA_COLUMNS);

  if (query.status) {
    builder = builder.where("status", "=", query.status);
  } else {
    builder = builder.where("status", "!=", "deleted");
  }

  if (query.purpose) {
    builder = builder.where(
      "mime_type",
      "in",
      query.purpose === "image" ? [...IMAGE_MIME_TYPES] : [...DOCUMENT_MIME_TYPES],
    );
  }

  if (query.q) builder = builder.where("alt_text", "like", `%${query.q}%`);

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    const createdAt = Number(cursor.k);
    builder = builder.where((eb) =>
      eb.or([
        eb("created_at", "<", createdAt),
        eb.and([eb("created_at", "=", createdAt), eb("id", "<", cursor.id)]),
      ]),
    );
  }

  const rows = await builder
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1)
    .execute();

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    data: page.map(toDto),
    nextCursor:
      rows.length > limit && last ? encodeCursor({ k: last.created_at, id: last.id }) : null,
  };
}

/**
 * The assets a screen already references, by id, so an editor can show a thumbnail and alt
 * text without a request per block. Unknown, deleted or absent ids are simply missing.
 */
export async function getMediaMany(ids: string[]): Promise<Record<string, MediaDto>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};

  const db = await getDb();
  const rows = await db
    .selectFrom("media_assets")
    .select(MEDIA_COLUMNS)
    .where("id", "in", unique)
    .where("status", "!=", "deleted")
    .execute();

  return Object.fromEntries(rows.map((row) => [row.id, toDto(row)]));
}

export async function updateMediaAltText(actor: Actor, id: string, altText: string): Promise<MediaDto> {
  const db = await getDb();
  const existing = await db
    .selectFrom("media_assets")
    .select(MEDIA_COLUMNS)
    .where("id", "=", id)
    .executeTakeFirst();
  if (!existing || existing.status === "deleted") throw notFound("media asset");

  const now = Date.now();
  await db
    .updateTable("media_assets")
    .set({ alt_text: altText, updated_at: now })
    .where("id", "=", id)
    .execute();

  await recordAudit({
    actorId: actor.id,
    action: "media.update",
    entityType: "media",
    entityId: id,
    metadata: { fields: ["altText"] },
  });

  return toDto({ ...existing, alt_text: altText });
}

/** Where a `ready` asset is referenced; any hit blocks a delete (`409 MEDIA_IN_USE`). */
async function mediaReferences(executor: Executor, id: string): Promise<string[]> {
  // `payload` is `json_valid` by CHECK, so the id is matched where it is stored instead of by
  // substring and a re-parse of every block that mentions it.
  const blocks = await executor
    .selectFrom("content_blocks")
    .select("resource_id")
    .where("kind", "in", ["image", "download"])
    .where(sql<string>`json_extract(payload, '$.mediaId')`, "=", id)
    .execute();

  if (blocks.length > 0) {
    return [...new Set(blocks.map((block) => `resource:${block.resource_id}`))];
  }

  const subject = await executor
    .selectFrom("subjects")
    .select("id")
    .where("hero_media_id", "=", id)
    .executeTakeFirst();
  if (subject) return [`subject:${subject.id}`];

  // Question images arrive with the question bank (Phase 3); this check grows a `questions`
  // branch when that table is in the typed schema.
  return [];
}

/** `DELETE /studio/media/{id}`: soft delete, refused while content still references it. */
export async function deleteMedia(actor: Actor, id: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("media_assets")
      .select(MEDIA_COLUMNS)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing || existing.status === "deleted") throw notFound("media asset");

    const references = await mediaReferences(trx, id);
    if (references.length > 0) {
      throw new HttpError(409, "MEDIA_IN_USE", "This asset is used by content that still points at it.", [
        {
          path: "id",
          code: "MEDIA_IN_USE",
          message: `Referenced by ${references.slice(0, 5).join(", ")}.`,
        },
      ]);
    }

    await trx
      .updateTable("media_assets")
      .set({ status: "deleted", deleted_at: now, public_url: null, updated_at: now })
      .where("id", "=", id)
      .execute();

    await recordAudit(
      {
        actorId: actor.id,
        action: "media.delete",
        entityType: "media",
        entityId: id,
        metadata: { mimeType: existing.mime_type },
      },
      trx,
    );
  });
}

/** `GET /studio/media/{id}/download-url`: a ≤ 10 minute signed read for the stored object. */
export async function getMediaDownloadUrl(id: string): Promise<MediaDownloadTicket> {
  const db = await getDb();
  const existing = await db
    .selectFrom("media_assets")
    .select(["storage_key", "status"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!existing || existing.status !== "ready") throw notFound("media asset");

  const download = await storage(() => presignDownload(existing.storage_key));
  return { url: download.url, expiresAt: ISO(download.expiresAt) };
}

