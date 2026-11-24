import "server-only";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

/**
 * `lib/storage` — the Tigris adapter (`PRODUCT_ARCHITECTURE.md` §6,
 * `TECHNICAL_STANDARDS.md` §11, ADR-023).
 *
 * Bytes never pass through a request body: the browser uploads to a presigned `PUT` and the
 * server only ever reads back the head of an object to verify it. This module knows nothing
 * about `media_assets` or any other table — it takes a storage key and returns a URL, bytes
 * or nothing. The database is `lib/services/media-admin`.
 *
 * URLs are deliberately short-lived: 5 minutes for an upload and 10 for a private read.
 * Tigris accepts signatures valid for 90 days, and a long-lived URL is a leaked credential.
 */

const UPLOAD_EXPIRY_SECONDS = 5 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 10 * 60;

let client: S3Client | null = null;

/** One client per process: the SDK pools connections and a new client per request leaks them. */
function s3(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: env.TIGRIS_ENDPOINT,
    credentials: {
      accessKeyId: env.TIGRIS_ACCESS_KEY_ID,
      secretAccessKey: env.TIGRIS_SECRET_ACCESS_KEY,
    },
    // The SDK otherwise signs a CRC32 of the *empty* body into a presigned `PUT`, and the
    // browser's real payload then fails the bucket's checksum check.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export type PresignedUpload = {
  url: string;
  expiresAt: number;
};

/** A `PUT` signed for this exact key, content type and content length (§7.6). */
export async function presignUpload(
  key: string,
  input: { contentType: string; contentLength: number },
): Promise<PresignedUpload> {
  const command = new PutObjectCommand({
    Bucket: env.TIGRIS_BUCKET,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });
  const url = await getSignedUrl(s3(), command, { expiresIn: UPLOAD_EXPIRY_SECONDS });
  return { url, expiresAt: Date.now() + UPLOAD_EXPIRY_SECONDS * 1000 };
}

/** A short-lived `GET` for a private asset (§7.6). */
export async function presignDownload(key: string): Promise<PresignedUpload> {
  const command = new GetObjectCommand({ Bucket: env.TIGRIS_BUCKET, Key: key });
  const url = await getSignedUrl(s3(), command, { expiresIn: DOWNLOAD_EXPIRY_SECONDS });
  return { url, expiresAt: Date.now() + DOWNLOAD_EXPIRY_SECONDS * 1000 };
}

/**
 * The object's stored byte length, or `null` when it was never uploaded or has been purged.
 * Confirm compares it with the length its `PUT` was signed for.
 */
export async function headObject(key: string): Promise<number | null> {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: env.TIGRIS_BUCKET, Key: key }));
    return head.ContentLength ?? null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * A `JPEG` may put megabytes of metadata before its frame header, so the read has to be wide
 * enough to reach it; magic bytes and the other image headers fit in the first few dozen.
 */
const PREFIX_BYTES = 128 * 1024;

/** The first bytes of an object: magic-byte verification and image dimensions (§7.6). */
export async function readPrefix(key: string): Promise<Uint8Array> {
  const object = await s3().send(
    new GetObjectCommand({
      Bucket: env.TIGRIS_BUCKET,
      Key: key,
      Range: `bytes=0-${PREFIX_BYTES - 1}`,
    }),
  );
  if (!object.Body) return new Uint8Array();
  return object.Body.transformToByteArray();
}

/** The whole object as text; only SVG sanitisation reads a file in full. */
export async function readText(key: string): Promise<string> {
  const object = await s3().send(new GetObjectCommand({ Bucket: env.TIGRIS_BUCKET, Key: key }));
  if (!object.Body) return "";
  return object.Body.transformToString("utf-8");
}

/** Rewrites an object in place; only the SVG sanitiser uses it. Returns the new byte length. */
export async function putObject(
  key: string,
  body: string,
  contentType: string,
): Promise<number> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.TIGRIS_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return new TextEncoder().encode(body).length;
}

/** The public bucket domain or custom domain from `TIGRIS_PUBLIC_URL`. */
export function publicUrlFor(key: string): string {
  return `${env.TIGRIS_PUBLIC_URL.replace(/\/+$/, "")}/${key}`;
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NotFound" || candidate.$metadata?.httpStatusCode === 404;
}
