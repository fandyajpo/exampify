import { describe, expect, it } from "vitest";

import { splitTopicGaps, type TopicGapRow } from "@/lib/content/gaps";

/**
 * The content-gap split (`MVP_ROADMAP.md` Phase 3, `/studio/overview`).
 *
 * A and C have a resource, B and C have an assessment: neither list is "the other side", and
 * a topic can appear in both when it has neither.
 */

const topic = (id: string, status: TopicGapRow["status"] = "draft"): TopicGapRow => ({
  id,
  slug: id,
  title: id.toUpperCase(),
  status,
});

describe("splitTopicGaps", () => {
  it("splits on each missing side independently", () => {
    const gaps = splitTopicGaps(
      [topic("a"), topic("b"), topic("c")],
      new Set(["a", "c"]),
      new Set(["b", "c"]),
    );

    expect(gaps.withoutResource.map((row) => row.id)).toEqual(["b"]);
    expect(gaps.withoutAssessment.map((row) => row.id)).toEqual(["a"]);
  });

  it("lists a topic that has neither in both panels", () => {
    const gaps = splitTopicGaps([topic("d", "published")], new Set(), new Set());

    expect(gaps.withoutResource.map((row) => row.id)).toEqual(["d"]);
    expect(gaps.withoutAssessment.map((row) => row.id)).toEqual(["d"]);
    expect(gaps.withoutResource[0]?.status).toBe("published");
  });

  it("reports nothing when every topic has both", () => {
    const gaps = splitTopicGaps([topic("a")], new Set(["a"]), new Set(["a"]));

    expect(gaps).toEqual({ withoutResource: [], withoutAssessment: [] });
  });
});
