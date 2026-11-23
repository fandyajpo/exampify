import { describe, expect, it } from "vitest";

import { absoluteUrl, buildMetadata, description, titles } from "@/lib/seo/metadata";

describe("title formulas", () => {
  it("includes the brand on the homepage", () => {
    expect(titles.home()).toContain("Exampify");
  });

  it("puts the entity first on a subject page and honours an author override", () => {
    expect(titles.subject("Biology", "IGCSE", "CAIE")).toBe(
      "Biology IGCSE CAIE — Notes, lessons & practice",
    );
    expect(titles.subject("Biology", "IGCSE", "CAIE", "Custom title")).toBe("Custom title");
  });
});

describe("description", () => {
  it("takes the first non-empty candidate and collapses whitespace", () => {
    expect(description(["", null, "  Two   spaces  "], "fallback")).toBe("Two spaces");
  });

  it("falls back when every candidate is empty", () => {
    expect(description([undefined, "   "], "fallback")).toBe("fallback");
  });

  it("clamps past the 158-character ceiling on a word boundary with an ellipsis", () => {
    const result = description([`${"word ".repeat(60)}end`], "fallback");
    expect(result.length).toBeLessThanOrEqual(158);
    expect(result.endsWith("…")).toBe(true);
    // The clamp keeps whole words: no space before the ellipsis, no cut mid-word.
    expect(result).not.toContain(" …");
    expect(result).toMatch(/\bword…$/);
  });

  it("leaves a description at the ceiling untouched", () => {
    const exact = "a".repeat(158);
    expect(description([exact], "fallback")).toBe(exact);
  });
});

describe("metadata", () => {
  it("makes the canonical absolute and marks filtered pages noindex", () => {
    const meta = buildMetadata({ title: "T", description: "D", path: "/subjects", noindex: true });

    expect(meta.alternates?.canonical).toBe("/subjects");
    expect(absoluteUrl("/subjects")).toBe("https://exampify.test/subjects");
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.openGraph?.url).toBe("https://exampify.test/subjects");
  });

  it("emits neither a trailing slash nor a doubled origin for the home path", () => {
    expect(absoluteUrl("/")).toBe("https://exampify.test");
  });
});
