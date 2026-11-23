import { describe, expect, it } from "vitest";

import { url } from "@/lib/urls";

describe("canonical paths", () => {
  it("builds the hierarchy from curriculum to resource", () => {
    expect(url.curriculum("cambridge-international")).toBe("/cambridge-international");
    expect(url.level("cambridge-international", "igcse")).toBe(
      "/cambridge-international/igcse",
    );
    expect(url.subject("cambridge-international", "igcse", "biology")).toBe(
      "/cambridge-international/igcse/biology",
    );
    expect(
      url.chapter("cambridge-international", "igcse", "biology", "cells-and-transport"),
    ).toBe("/cambridge-international/igcse/biology/chapters/cells-and-transport");
    expect(
      url.topic("cambridge-international", "igcse", "biology", "cells-and-transport", "cell-structure"),
    ).toBe("/cambridge-international/igcse/biology/cells-and-transport/cell-structure");
  });

  it("puts the learn segment last on a resource path", () => {
    expect(
      url.resource(
        "cambridge-international",
        "igcse",
        "biology",
        "cells-and-transport",
        "cell-structure",
        "study-notes",
      ),
    ).toBe(
      "/cambridge-international/igcse/biology/cells-and-transport/cell-structure/learn/study-notes",
    );
  });

  it("never emits a trailing slash except for the root", () => {
    for (const path of [
      url.curriculum("ib"),
      url.level("ib", "dp"),
      url.subject("ib", "dp", "physics"),
    ]) {
      expect(path).not.toMatch(/\/$/);
      expect(path.startsWith("/")).toBe(true);
    }
  });
});
