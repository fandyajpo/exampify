import { uuidv7 } from "@/lib/ids";

/**
 * Media upload rules (`CONTENT_MODEL.md` §4.9, `API_CONTRACTS.md` §7.6).
 *
 * Pure functions only: the allow-lists, the extension a mime type implies, the storage key,
 * magic-byte detection and the SVG sanitiser. The service composes them; the unit suite
 * exercises them without a bucket or a database.
 */

export const MEDIA_PURPOSES = ["image", "document"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** The database `CHECK` ceiling; the per-purpose cap is what actually blocks an upload. */
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/svg+xml",
] as const;

export const DOCUMENT_MIME_TYPES = ["application/pdf", DOCX, PPTX, "application/zip"] as const;

/** The three types that are really a ZIP container; their magic bytes are identical. */
const ZIP_MIME_TYPES = [DOCX, PPTX, "application/zip"] as const;

export const PURPOSE_RULES: Record<
  MediaPurpose,
  { mimes: readonly string[]; maxBytes: number }
> = {
  image: { mimes: IMAGE_MIME_TYPES, maxBytes: MAX_IMAGE_BYTES },
  document: { mimes: DOCUMENT_MIME_TYPES, maxBytes: MAX_MEDIA_BYTES },
};

/** The extension each accepted mime type accepts. `jpeg` may arrive as `.jpg` or `.jpeg`. */
const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "image/svg+xml": ["svg"],
  "application/pdf": ["pdf"],
  [DOCX]: ["docx"],
  [PPTX]: ["pptx"],
  // A browser may report a `.docx` or `.pptx` as a plain ZIP; the extension is what
  // distinguishes the three, so the generic type accepts all of them.
  "application/zip": ["zip", "docx", "pptx"],
};

export type MediaUploadProblem = {
  path: "mimeType" | "byteSize" | "filename";
  code: string;
  message: string;
};

/** The purpose a mime type belongs to, or `null` when it is on neither allow-list. */
export function purposeForMime(mimeType: string): MediaPurpose | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return "image";
  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType)) return "document";
  return null;
}

/** `photo.JPG` → `jpg`; no extension is an empty string. */
export function extensionOf(filename: string): string {
  const base = filename.trim().toLowerCase().split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot === -1 || dot === base.length - 1 ? "" : base.slice(dot + 1);
}

/** The first rule the upload breaks, or `null` when it is acceptable. */
export function mediaUploadProblem(input: {
  filename: string;
  mimeType: string;
  byteSize: number;
  purpose: MediaPurpose;
}): MediaUploadProblem | null {
  const rules = PURPOSE_RULES[input.purpose];
  if (!rules.mimes.includes(input.mimeType)) {
    return {
      path: "mimeType",
      code: "MEDIA_TYPE_NOT_ALLOWED",
      message: `A ${input.purpose} accepts ${rules.mimes.join(", ")}.`,
    };
  }
  if (input.byteSize > rules.maxBytes) {
    return {
      path: "byteSize",
      code: "MEDIA_TOO_LARGE",
      message: `The limit for a ${input.purpose} is ${Math.round(rules.maxBytes / (1024 * 1024))} MB.`,
    };
  }
  const accepted = MIME_EXTENSIONS[input.mimeType] ?? [];
  const extension = extensionOf(input.filename);
  if (!accepted.includes(extension)) {
    return {
      path: "filename",
      code: "MEDIA_EXTENSION_MISMATCH",
      message: `A ${input.mimeType} file ends in ${accepted.map((value) => `.${value}`).join(" or ")}.`,
    };
  }
  return null;
}

/** `content/<yyyy>/<mm>/<uuid>.<ext>` (§7.6); the month is UTC so the prefix is stable. */
export function buildStorageKey(now: number, extension: string): string {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `content/${year}/${month}/${uuidv7(now)}.${extension}`;
}



const ascii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.slice(start, end));

/**
 * Magic-byte detection for the accepted types. A `HEAD` reports what the uploader claimed;
 * this is what the bytes actually are, so a `.png` that is really an HTML page is refused.
 * `zip` covers docx and pptx, which are zips with a different extension.
 */
export function detectMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8) {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (png.every((value, index) => bytes[index] === value)) return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12))) {
    return "image/avif";
  }
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "application/zip";
  }
  // SVG is text, so a declared `image/svg+xml` is only credible when the file looks like XML.
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 512)).trimStart();
  if (text.startsWith("<?xml") || text.startsWith("<svg")) return "image/svg+xml";
  return null;
}

/** The pixel dimensions an image header states. */
export type ImageSize = { width: number; height: number };

const u16be = (bytes: Uint8Array, at: number): number => (bytes[at]! << 8) | bytes[at + 1]!;
const u16le = (bytes: Uint8Array, at: number): number => bytes[at]! | (bytes[at + 1]! << 8);
const u24le = (bytes: Uint8Array, at: number): number =>
  bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16);
const u32be = (bytes: Uint8Array, at: number): number =>
  bytes[at]! * 0x1000000 + (bytes[at + 1]! << 16) + (bytes[at + 2]! << 8) + bytes[at + 3]!;
const u32le = (bytes: Uint8Array, at: number): number =>
  bytes[at]! + (bytes[at + 1]! << 8) + (bytes[at + 2]! << 16) + bytes[at + 3]! * 0x1000000;

function pngImageSize(bytes: Uint8Array): ImageSize | null {
  const signature = [0x89, 0x50, 0x4e, 0x47];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  if (ascii(bytes, 12, 16) !== "IHDR") return null;
  return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

/** Walks the marker segments; a `SOFn` holds the frame's height and width after its precision. */
function jpegImageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1]!;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    at += 2;
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
    const length = u16be(bytes, at);
    if (length < 2 || at + length > bytes.length) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      return { width: u16be(bytes, at + 5), height: u16be(bytes, at + 3) };
    }
    at += length;
  }
  return null;
}

/** Three chunk layouts: extended (`VP8X`), lossy (`VP8 `) and lossless (`VP8L`). */
function webpImageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 25 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") return null;
  const chunk = ascii(bytes, 12, 16);
  if (chunk === "VP8X") {
    if (bytes.length < 30) return null;
    return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
  }
  if (chunk === "VP8 ") {
    if (bytes.length < 30) return null;
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const bits = u32le(bytes, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

/**
 * The pixel dimensions an image header states, for the formats where reading it is a fixed
 * offset or a marker walk: PNG, JPEG and WebP. An SVG and an AVIF declare their size in a form
 * that needs a real parser, so they stay `null` and the caller keeps its fallback.
 */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  const size = pngImageSize(bytes) ?? jpegImageSize(bytes) ?? webpImageSize(bytes);
  return size && size.width > 0 && size.height > 0 ? size : null;
}

/** Whether the detected type is the one the row claims. The three zip formats share a magic. */
export function matchesDeclaredMime(declared: string, detected: string | null): boolean {
  if (!detected) return false;
  if (declared === detected) return true;
  return detected === "application/zip" && (ZIP_MIME_TYPES as readonly string[]).includes(declared);
}

/**
 * Strip the parts of an SVG that make it a script container: `<script>`, `<foreignObject>`,
 * `<style>`, event-handler attributes, `javascript:` targets and external references. Returns
 * `null` for a document that cannot be made safe (a `DOCTYPE` or entity declaration is an
 * XXE and billion-laughs vector, so the upload is refused rather than scrubbed).
 *
 * This is a conservative text sanitiser for a closed upload path, not a general-purpose
 * HTML parser: content that needs more than these removals should not be an SVG.
 */
export function sanitizeSvg(source: string): string | null {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) return null;

  let output = source
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/<foreignObject\b[^>]*\/>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");

  // A link or image that points at another origin is a tracking pixel or an exfiltration path.
  output = output.replace(
    /\s(?:xlink:href|href)\s*=\s*(?:"\s*(?:https?:|javascript:|data:text\/html)[^"]*"|'\s*(?:https?:|javascript:|data:text\/html)[^']*')/gi,
    "",
  );

  return output;
}
