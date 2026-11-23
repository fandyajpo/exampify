import { describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/ids";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  it("sets version 7 and the RFC variant", () => {
    expect(uuidv7()).toMatch(UUID_V7);
  });

  it("sorts by timestamp when ids are generated in different milliseconds", () => {
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_001_000);

    expect(earlier < later).toBe(true);
  });
});
