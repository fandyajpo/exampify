import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/lib/validation/cursor";
import { slugify } from "@/lib/slug";

/** Slugs and cursors are both opaque things a client sends back; both must be safe to parse. */

describe("slugify", () => {
  it("makes a database-valid slug from a display name", () => {
    expect(slugify("Cambridge International")).toBe("cambridge-international");
    expect(slugify("  AS & A Level  ")).toBe("as-a-level");
    expect(slugify("Physique-Chimie")).toBe("physique-chimie");
  });

  it("folds accents and strips everything outside the CHECK constraint", () => {
    expect(slugify("Économie Générale")).toBe("economie-generale");
    expect(slugify("C++ / Rust?")).toBe("c-rust");
  });

  it("never leaves a leading, trailing or doubled hyphen", () => {
    expect(slugify("--Biology--")).toBe("biology");
    expect(slugify("a   b")).toBe("a-b");
  });
});

describe("cursor", () => {
  it("round-trips the sort value and id", () => {
    const encoded = encodeCursor({ k: 42, id: "018f3c1e-0000-7000-8000-000000000000" });
    expect(decodeCursor(encoded)).toEqual({ k: 42, id: "018f3c1e-0000-7000-8000-000000000000" });
  });

  it("is opaque base64url, not readable JSON", () => {
    const encoded = encodeCursor({ k: "Biology", id: "x" });
    expect(encoded).not.toContain("{");
    expect(encodeCursor({ k: "é", id: "x" })).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("refuses a corrupt cursor with 422 INVALID_CURSOR", () => {
    for (const bad of ["", "Zm9v", Buffer.from('{"id":"x"}').toString("base64url"), Buffer.from("[]").toString("base64url")]) {
      expect(() => decodeCursor(bad)).toThrowError(/not valid/i);
    }
  });
});
