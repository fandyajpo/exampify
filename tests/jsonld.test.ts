import { describe, expect, it } from "vitest";

import { breadcrumbList, course, learningResource, pageGraph, siteGraph } from "@/lib/seo/jsonld";

const FORBIDDEN = ["aggregateRating", "offers", "price", "priceCurrency", "CourseInstance"];

describe("breadcrumbList", () => {
  it("numbers positions from one and absolutises every item", () => {
    const list = breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Subjects", path: "/subjects" },
    ]);
    const items = list.itemListElement as Array<Record<string, unknown>>;

    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items[1]?.item).toBe("https://exampify.test/subjects");
  });
});

describe("course and learningResource", () => {
  it("carries the provider reference and no schedule or price", () => {
    const node = course({
      name: "Biology",
      description: "Cells and transport.",
      educationalLevel: "IGCSE",
      path: "/cambridge-international/igcse/biology",
    });

    expect(node.provider).toEqual({
      "@id": "https://exampify.test#organization",
    });
    const serialized = JSON.stringify(node);
    for (const key of FORBIDDEN) expect(serialized).not.toContain(`"${key}"`);
  });

  it("never emits a zero-minute duration", () => {
    const node = learningResource({
      name: "Cell structure",
      description: "Study notes.",
      learningResourceType: "article",
      educationalLevel: "IGCSE",
      teaches: "Cell structure",
      isPartOf: { name: "Biology", path: "/cambridge-international/igcse/biology" },
      readingMinutes: 0,
      path: "/cambridge-international/igcse/biology/cells-and-transport/cell-structure/learn/study-notes",
    });

    expect(node.timeRequired).toBe("PT1M");
  });
});

describe("graphs", () => {
  it("wraps nodes in one schema.org context with a single organization node", () => {
    const graph = pageGraph([])["@graph"] as Array<Record<string, unknown>>;

    expect(graph).toHaveLength(1);
    expect(graph[0]?.["@type"]).toBe("Organization");
  });

  it("gives the homepage a WebSite node and a SearchAction", () => {
    const graph = siteGraph()["@graph"] as Array<Record<string, unknown>>;
    const website = graph.find((node) => node["@type"] === "WebSite");

    expect(website).toBeDefined();
    expect(JSON.stringify(website)).toContain("SearchAction");
    expect(JSON.stringify(website)).toContain("https://exampify.test/search?q=");
  });
});
