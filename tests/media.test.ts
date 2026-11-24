import { describe, expect, it } from "vitest";

import {
  buildStorageKey,
  detectMime,
  extensionOf,
  imageSize,
  matchesDeclaredMime,
  mediaUploadProblem,
  purposeForMime,
  sanitizeSvg,
} from "@/lib/content/media";

/**
 * Media rules (`CONTENT_MODEL.md` §4.9, `API_CONTRACTS.md` §7.6).
 *
 * The allow-lists, the extension a mime type implies, magic-byte detection and the SVG
 * sanitiser are pure, so they are tested without a bucket. The two-step upload path itself is
 * exercised against Tigris, not here.
 */

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("mediaUploadProblem", () => {
  const base = { filename: "diagram.png", mimeType: "image/png", byteSize: 1024, purpose: "image" as const };

  it("accepts an image inside the allow-list and the cap", () => {
    expect(mediaUploadProblem(base)).toBeNull();
  });

  it("accepts an 8 MB image at the boundary and refuses one byte more", () => {
    expect(mediaUploadProblem({ ...base, byteSize: 8 * 1024 * 1024 })).toBeNull();
    expect(mediaUploadProblem({ ...base, byteSize: 8 * 1024 * 1024 + 1 })?.code).toBe("MEDIA_TOO_LARGE");
  });

  it("refuses a document mime type under the image purpose", () => {
    expect(mediaUploadProblem({ ...base, filename: "notes.pdf", mimeType: "application/pdf" })?.path).toBe(
      "mimeType",
    );
  });

  it("refuses an extension that does not belong to the mime type", () => {
    expect(mediaUploadProblem({ ...base, filename: "diagram.txt" })?.code).toBe("MEDIA_EXTENSION_MISMATCH");
    expect(mediaUploadProblem({ ...base, filename: "photo.jpg" })?.path).toBe("filename");
    expect(mediaUploadProblem({ ...base, filename: "photo.jpg", mimeType: "image/jpeg" })).toBeNull();
    expect(mediaUploadProblem({ ...base, filename: "photo.jpeg", mimeType: "image/jpeg" })).toBeNull();
  });

  it("allows the three zip-based documents by extension", () => {
    const zip = "application/zip";
    expect(
      mediaUploadProblem({ filename: "worksheet.docx", mimeType: zip, byteSize: 1024, purpose: "document" }),
    ).toBeNull();
    expect(
      mediaUploadProblem({ filename: "deck.pptx", mimeType: zip, byteSize: 1024, purpose: "document" }),
    ).toBeNull();
  });
});

describe("purposeForMime", () => {
  it("splits the two allow-lists", () => {
    expect(purposeForMime("image/svg+xml")).toBe("image");
    expect(purposeForMime("application/pdf")).toBe("document");
    expect(purposeForMime("text/html")).toBeNull();
  });
});

describe("extensionOf", () => {
  it("lowercases, strips a path and copes with no extension", () => {
    expect(extensionOf("Photo.JPG")).toBe("jpg");
    expect(extensionOf("a/b/c.File.webp")).toBe("webp");
    expect(extensionOf("README")).toBe("");
    expect(extensionOf("trailing.")).toBe("");
  });
});

describe("buildStorageKey", () => {
  it("uses the UTC year and a zero-padded month", () => {
    const key = buildStorageKey(Date.UTC(2026, 0, 5, 12), extensionOf("diagram.png"));
    expect(key).toMatch(/^content\/2026\/01\/[0-9a-f-]{36}\.png$/);
  });

  it("is unique per call", () => {
    const now = Date.UTC(2026, 10, 1);
    expect(buildStorageKey(now, "png")).not.toBe(buildStorageKey(now, "png"));
  });
});

describe("detectMime", () => {
  it("recognises the accepted image formats", () => {
    expect(detectMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe("image/png");
    expect(detectMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectMime(text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
    expect(detectMime(text("\u0000\u0000\u0000\u0018ftypavif"))).toBe("image/avif");
  });

  it("recognises PDF, ZIP and SVG", () => {
    expect(detectMime(text("%PDF-1.7"))).toBe("application/pdf");
    expect(detectMime(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00))).toBe("application/zip");
    expect(detectMime(text('<?xml version="1.0"?><svg></svg>'))).toBe("image/svg+xml");
    expect(detectMime(text("  <svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBe("image/svg+xml");
  });

  it("returns null for an HTML page posing as an image", () => {
    expect(detectMime(text("<!DOCTYPE html><html></html>"))).toBeNull();
  });
});

describe("imageSize", () => {
  const png = (width: number, height: number): Uint8Array => {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.set(text("IHDR"), 12);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
  };

  /** `SOI`, a small `APP0`, then `SOF0` with the frame header. */
  const jpeg = (width: number, height: number): Uint8Array =>
    bytes(
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x08, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x00,
    );

  const webp = (width: number, height: number, lossless = false): Uint8Array => {
    const header = lossless
              ? bytes(
            0x2f,
            (width - 1) & 0xff,
            (((width - 1) >> 8) & 0x3f) | (((height - 1) & 0x03) << 6),
            ((height - 1) >> 2) & 0xff,
            (height - 1) >> 10,
          )
      : bytes(0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a, width & 0xff, width >> 8, height & 0xff, height >> 8);
    return Uint8Array.from([
      ...text("RIFF"),
      ...bytes(0x00, 0x00, 0x00, 0x00),
      ...text("WEBP"),
      ...text(lossless ? "VP8L" : "VP8 "),
      ...bytes(0x00, 0x00, 0x00, 0x00),
      ...header,
    ]);
  };

  it("reads the header of PNG, JPEG and WebP", () => {
    expect(imageSize(png(1024, 768))).toEqual({ width: 1024, height: 768 });
    expect(imageSize(jpeg(1200, 800))).toEqual({ width: 1200, height: 800 });
    expect(imageSize(webp(640, 480))).toEqual({ width: 640, height: 480 });
    expect(imageSize(webp(640, 480, true))).toEqual({ width: 640, height: 480 });
  });

  it("skips a JPEG's metadata segments before the frame header", () => {
    const withExif = Uint8Array.from([
      0xff, 0xd8,
      ...bytes(0xff, 0xe1, 0x00, 0x0a),
      ...new Uint8Array(8),
      ...jpeg(200, 100).slice(2),
    ]);
    expect(imageSize(withExif)).toEqual({ width: 200, height: 100 });
  });

  it("returns null for formats it cannot read and for truncated headers", () => {
    expect(imageSize(text('<?xml version="1.0"?><svg width="10" height="10" />'))).toBeNull();
    expect(imageSize(text("%PDF-1.7"))).toBeNull();
    expect(imageSize(png(1024, 768).slice(0, 20))).toBeNull();
    expect(imageSize(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00))).toBeNull();
    expect(imageSize(webp(0, 0))).toBeNull();
  });
});

describe("matchesDeclaredMime", () => {
  it("accepts the zip family for docx and pptx but not for a PDF", () => {
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const pptx = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    expect(matchesDeclaredMime(docx, "application/zip")).toBe(true);
    expect(matchesDeclaredMime(pptx, "application/zip")).toBe(true);
    expect(matchesDeclaredMime("application/pdf", "application/zip")).toBe(false);
  });

  it("is false when nothing was detected", () => {
    expect(matchesDeclaredMime("image/png", null)).toBe(false);
    expect(matchesDeclaredMime("image/png", "image/jpeg")).toBe(false);
  });
});

describe("sanitizeSvg", () => {
  it("removes scripts, event handlers, foreignObject, style and javascript targets", () => {
    const source = [
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
      "<script>alert(1)</script>",
      "<foreignObject><body><p>hi</p></body></foreignObject>",
      "<style>rect { fill: red }</style>",
      '<a href="javascript:alert(1)"><rect style="fill:red" width="10" height="10" /></a>',
      "</svg>",
    ].join("");

    const clean = sanitizeSvg(source) ?? "";
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/foreignObject/i);
    expect(clean).not.toMatch(/onload/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/<style/i);
    expect(clean).not.toMatch(/style="/i);
    expect(clean).toContain('<rect width="10" height="10" />');
  });

  it("strips an external href", () => {
    const clean = sanitizeSvg(
      '<svg><image href="https://tracker.example/pixel.png" xlink:href="http://x/y.png" /></svg>',
    );
    expect(clean).not.toMatch(/tracker\.example|x\/y\.png/);
  });

  it("refuses a doctype or entity declaration instead of scrubbing it", () => {
    expect(sanitizeSvg('<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg />')).toBeNull();
    expect(sanitizeSvg("<svg><!ENTITY lol 'lol'></svg>")).toBeNull();
  });

  it("leaves a benign drawing intact", () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4" /></svg>';
    expect(sanitizeSvg(source)).toBe(source);
  });
});
