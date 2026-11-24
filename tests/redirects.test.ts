import { describe, expect, it } from "vitest";

import { collapseTarget, matchRedirect } from "@/lib/content/redirects";

/**
 * Redirect resolution (`INFORMATION_ARCHITECTURE.md` §5.4, `SEO_AND_CONTENT_STRATEGY.md` §6).
 *
 * These are the rules the public pages rely on: an exact hit wins, a renamed ancestor covers
 * its subtree by prefix, and a new row never creates a chain or a loop.
 */

const rows = [
  { source_path: "/cambridge/igcse/biology", target_path: "/cambridge/igcse/biology-0610" },
  { source_path: "/cambridge/igcse/biology/chapters/cells", target_path: "/cambridge/igcse/biology/chapters/cell-biology" },
  { source_path: "/old-resource", target_path: "/new-resource" },
];

describe("matchRedirect", () => {
  it("returns the exact target when the path matches a row", () => {
    expect(matchRedirect(rows, "/old-resource")).toBe("/new-resource");
  });

  it("keeps the remainder of the path under a renamed ancestor", () => {
    // The chapter row carries the old subject prefix, so the result matches the subject row
    // again; resolution follows both and the browser makes one hop.
    expect(
      matchRedirect(rows, "/cambridge/igcse/biology/chapters/cells/systems/learn/osmosis"),
    ).toBe("/cambridge/igcse/biology-0610/chapters/cell-biology/systems/learn/osmosis");
  });

  it("prefers the longest prefix over a shorter ancestor", () => {
    expect(matchRedirect(rows, "/cambridge/igcse/biology/chapters/cells/topics/transport")).toBe(
      "/cambridge/igcse/biology-0610/chapters/cell-biology/topics/transport",
    );
  });

  it("follows a prefix row whose target matches another row to a fixed point", () => {
    const composed = [
      { source_path: "/a", target_path: "/b" },
      { source_path: "/a/chapters/one", target_path: "/a/chapters/two" },
    ];
    expect(matchRedirect(composed, "/a/chapters/one/topics/x")).toBe("/b/chapters/two/topics/x");
  });

  it("does not treat a shorter string as a prefix of a longer segment", () => {
    expect(matchRedirect(rows, "/old-resource-2")).toBeNull();
  });

  it("returns null when nothing was moved", () => {
    expect(matchRedirect(rows, "/cambridge/igcse/chemistry")).toBeNull();
    expect(matchRedirect([], "/anything")).toBeNull();
  });
});

describe("collapseTarget", () => {
  it("keeps a target that is not itself redirected", () => {
    expect(collapseTarget([], "/from", "/to")).toBe("/to");
  });

  it("follows a target that already redirects, so the row never chains", () => {
    const existing = [{ source_path: "/a", target_path: "/b" }];
    expect(collapseTarget(existing, "/new", "/a")).toBe("/b");
  });

  it("refuses a move that would point at itself", () => {
    expect(collapseTarget([], "/same", "/same")).toBeNull();
  });

  it("refuses a cycle back to the source", () => {
    const existing = [{ source_path: "/b", target_path: "/a" }];
    expect(collapseTarget(existing, "/a", "/b")).toBeNull();
  });
});
