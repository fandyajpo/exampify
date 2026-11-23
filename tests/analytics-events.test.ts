import { describe, expect, it } from "vitest";

import {
  CLIENT_EVENT_NAMES,
  EVENT_NAMES,
  clientEventBatchSchema,
  isClientEventName,
  redactProps,
} from "@/lib/analytics/events";

describe("event vocabulary", () => {
  it("keeps server facts out of the client-safe subset", () => {
    expect(CLIENT_EVENT_NAMES).toEqual(["suggestion_selected", "search_result_clicked"]);
    expect(isClientEventName("resource_viewed")).toBe(false);
    expect(isClientEventName("attempt_submitted")).toBe(false);
    expect(EVENT_NAMES).toContain("resource_viewed");
  });

  it("rejects a batch that asserts a server-side fact", () => {
    const result = clientEventBatchSchema.safeParse({
      events: [
        {
          name: "attempt_submitted",
          occurredAt: Date.now(),
          props: { attemptId: "x", scoreX100: 9000 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects free text where an enum or number is required", () => {
    const result = clientEventBatchSchema.safeParse({
      events: [
        {
          name: "search_result_clicked",
          occurredAt: Date.now(),
          props: { position: 1, queryLength: 11, entityType: "photo of my passport" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed client event and strips unknown properties", () => {
    const result = clientEventBatchSchema.safeParse({
      events: [
        {
          name: "search_result_clicked",
          occurredAt: Date.now(),
          props: {
            position: 3,
            queryLength: 11,
            entityType: "learning_resource",
            email: "student@example.com",
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.events[0]?.props).toEqual({
        position: 3,
        queryLength: 11,
        entityType: "learning_resource",
      });
    }
  });

  it("enforces the 1–20 event batch bounds", () => {
    expect(clientEventBatchSchema.safeParse({ events: [] }).success).toBe(false);

    const tooMany = Array.from({ length: 21 }, () => ({
      name: "suggestion_selected" as const,
      occurredAt: 1,
      props: { position: 1, queryLength: 2, type: "topic" as const },
    }));
    expect(clientEventBatchSchema.safeParse({ events: tooMany }).success).toBe(false);
  });
});

describe("redactProps", () => {
  it("keeps scalars and short strings only", () => {
    expect(
      redactProps({
        resourceId: "0192f0c0-0000-7000-8000-000000000000",
        format: "study",
        minutes: 12,
        draft: true,
        nested: { query: "photosynthesis notes" },
        list: ["a", "b"],
        "bad key": "x",
      }),
    ).toEqual({
      resourceId: "0192f0c0-0000-7000-8000-000000000000",
      format: "study",
      minutes: 12,
      draft: true,
    });
  });

  it("drops a long free-text value", () => {
    const redacted = redactProps({ note: "a".repeat(65) });
    expect(redacted).toEqual({});
  });

  it("returns an empty object for non-objects", () => {
    expect(redactProps(null)).toEqual({});
    expect(redactProps("resourceId=x")).toEqual({});
    expect(redactProps(["a"])).toEqual({});
    expect(redactProps({ value: Number.NaN })).toEqual({});
  });
});
