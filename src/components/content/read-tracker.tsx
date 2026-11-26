"use client";

import { useEffect } from "react";

/**
 * Reports a reader's visit so study progress can count it (`FR-PROG-07`).
 *
 * The reader is an ISR page with no session, so this is the only place a signed-in reader
 * can be attributed. The request is fire-and-forget: the endpoint answers `204` for a
 * signed-out visitor, and a failure is swallowed, because a progress row must never cost a
 * student the material they came for (API-13).
 *
 * `recorded` is module scope so React's development double-mount — and a client-side
 * remount — cannot send the same read twice in one page view.
 */

const recorded = new Set<string>();

export function ReadTracker({ resourceId }: { resourceId: string }): null {
  useEffect(() => {
    if (recorded.has(resourceId)) return;
    recorded.add(resourceId);

    void fetch(`/api/v1/resources/${encodeURIComponent(resourceId)}/view`, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {});
  }, [resourceId]);

  return null;
}
