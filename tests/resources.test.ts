import { describe, expect, it } from "vitest";

import { readingMinutesFromBlocks } from "@/lib/content/reading-time";
import { formulaParses, headingAnchor, evaluateResourceGates } from "@/lib/content/resource-gates";

/**
 * `CONTENT_MODEL.md` §4.6 gates and the reading-time rule. These are the same functions the
 * `validate` endpoint and the publish transition run, so a passing test here is a passing
 * dry run there.
 */

const LONG_PROSE = "Photosynthesis converts light energy into chemical energy. ".repeat(5);

const ASSESSMENT_ID = "33333333-3333-4333-8333-333333333333";

function prose(markdown = LONG_PROSE, position = 0) {
  return { position, kind: "rich_text", payload: JSON.stringify({ v: 1, markdown }) };
}

/** Several rich_text blocks, each under the 40 kB per-payload limit, to test the total cap. */
function manyProse(count: number) {
  return Array.from({ length: count }, (_, index) => prose(`${LONG_PROSE}${"x".repeat(30_000)}`, index));
}

function gate(overrides: Partial<Parameters<typeof evaluateResourceGates>[0]> = {}) {
  return evaluateResourceGates({
    resourceId: "resource-1",
    resourceTopicId: "topic-1",
    resourceSubjectId: "subject-1",
    blocks: [prose()],
    assessments: {},
    resources: {},
    media: {},
    ...overrides,
  });
}

function codes(result: ReturnType<typeof gate>): string[] {
  return result.blocking.map((item) => item.code);
}

describe("evaluateResourceGates", () => {
  it("passes a resource with enough prose", () => {
    expect(gate().blocking).toEqual([]);
  });

  it("blocks a resource with no prose", () => {
    expect(codes(gate({ blocks: [] }))).toContain("no_prose");
    expect(codes(gate({ blocks: [prose("Too short.")] }))).toContain("no_prose");
  });

  it("blocks a page that opens on a level-3 heading", () => {
    const heading = {
      position: 0,
      kind: "heading",
      payload: JSON.stringify({ v: 1, level: 3, text: "Sub section" }),
    };
    expect(codes(gate({ blocks: [heading, prose()] }))).toContain("opens_on_subheading");
  });

  it("blocks an unparseable formula with its exact path", () => {
    const formula = {
      position: 1,
      kind: "formula",
      payload: JSON.stringify({ v: 1, latex: "\\frac{1}{", displayMode: true }),
    };
    const result = gate({ blocks: [prose(), formula] });
    expect(result.blocking).toContainEqual(
      expect.objectContaining({ path: "blocks.1.latex", code: "invalid_formula" }),
    );
  });

  it("blocks a question section whose assessment is not published", () => {
    const section = {
      position: 1,
      kind: "question_section",
      payload: JSON.stringify({ v: 1, assessmentId: ASSESSMENT_ID }),
    };
    const result = gate({
      blocks: [prose(), section],
      assessments: {
        [ASSESSMENT_ID]: { status: "draft", topicId: "topic-1", subjectId: "subject-1" },
      },
    });
    expect(codes(result)).toContain("assessment_not_published");
  });

  it("blocks an assessment from another topic", () => {
    const section = {
      position: 1,
      kind: "question_section",
      payload: JSON.stringify({ v: 1, assessmentId: ASSESSMENT_ID }),
    };
    const result = gate({
      blocks: [prose(), section],
      assessments: {
        [ASSESSMENT_ID]: { status: "published", topicId: "topic-2", subjectId: "subject-1" },
      },
    });
    expect(codes(result)).toContain("assessment_out_of_scope");
  });

  it("blocks an image without a ready asset or alt text", () => {
    const image = {
      position: 1,
      kind: "image",
      payload: JSON.stringify({ v: 1, mediaId: "11111111-1111-4111-8111-111111111111", width: 10, height: 10 }),
    };
    expect(codes(gate({ blocks: [prose(), image] }))).toContain("media_not_ready");
    expect(
      codes(
        gate({
          blocks: [prose(), image],
          media: { "11111111-1111-4111-8111-111111111111": { status: "ready", altText: "" } },
        }),
      ),
    ).toContain("alt_text_required");
  });

  it("blocks duplicate heading anchors", () => {
    const heading = {
      position: 1,
      kind: "heading",
      payload: JSON.stringify({ v: 1, level: 2, text: "The same heading" }),
    };
    expect(codes(gate({ blocks: [prose(), heading, { ...heading, position: 2 }] }))).toContain(
      "duplicate_anchor",
    );
  });

  it("blocks related material that is not a published sibling", () => {
    const related = {
      position: 1,
      kind: "related_material",
      payload: JSON.stringify({ v: 1, resourceIds: ["22222222-2222-4222-8222-222222222222"] }),
    };
    expect(codes(gate({ blocks: [prose(), related] }))).toContain("related_not_publishable");
    expect(
      codes(
        gate({
          blocks: [prose(), related],
          resources: { "22222222-2222-4222-8222-222222222222": { status: "published", subjectId: "subject-1" } },
        }),
      ),
    ).not.toContain("related_not_publishable");
  });

  it("warns above 64 kB and blocks above 256 kB", () => {
    const large = gate({ blocks: manyProse(3) });
    expect(large.blocking).toEqual([]);
    expect(large.warnings.map((item) => item.code)).toContain("payload_large");

    const huge = gate({ blocks: manyProse(9) });
    expect(codes(huge)).toContain("payload_too_large");
  });

  it("warns about the editorial shape without blocking", () => {
    expect(gate().warnings.map((item) => item.code)).toContain("no_worked_example");
  });
});

describe("formula and anchor helpers", () => {
  it("parses valid TeX and rejects a broken group", () => {
    expect(formulaParses("E = mc^2")).toBe(true);
    expect(formulaParses("\\frac{1}{")).toBe(false);
  });

  it("derives an anchor from the heading text", () => {
    expect(headingAnchor({ kind: "heading", payload: { v: 1, level: 2, text: "Cell Structure!" } })).toBe(
      "cell-structure",
    );
  });
});

describe("readingMinutesFromBlocks", () => {
  it("is at least one minute and rounds up at 200 words", () => {
    expect(readingMinutesFromBlocks([])).toBe(1);
    expect(readingMinutesFromBlocks([{ payload: { markdown: "word ".repeat(200) } }])).toBe(1);
    expect(readingMinutesFromBlocks([{ payload: { markdown: "word ".repeat(201) } }])).toBe(2);
  });

  it("does not count markdown syntax as words", () => {
    const markdown = `## Heading\n\n${"word ".repeat(200)}`;
    expect(readingMinutesFromBlocks([{ payload: { markdown } }])).toBe(2);
  });
});
