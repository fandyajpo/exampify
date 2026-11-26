import { NextResponse } from "next/server";

import { student } from "@/lib/http/student";
import { submitAttempt } from "@/lib/services/attempts";

/**
 * `POST /api/v1/attempts/{attemptId}/submit` (`API_CONTRACTS.md` §5.4).
 *
 * No body. Grading is server-side and the call is idempotent: a second submit returns the
 * first one's payload with `200`, so a retried request cannot score an attempt twice.
 * Another user's attempt is a `404`; an expired attempt is a `409 ATTEMPT_EXPIRED`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = student<{ attemptId: string }>(async ({ actor, params }) => {
  const result = await submitAttempt(actor, params.attemptId);
  return NextResponse.json({ data: { attempt: result.attempt, results: result.results } });
});
