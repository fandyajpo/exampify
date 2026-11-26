import { NextResponse } from "next/server";

import { student } from "@/lib/http/student";
import { reviewAttempt } from "@/lib/services/attempts";

/**
 * `GET /api/v1/attempts/{attemptId}/review` (`API_CONTRACTS.md` §5.5).
 *
 * The same payload `submit` returns, read from the stored totals without grading again.
 * Only a submitted attempt has a review; anything else is `409 INVALID_TRANSITION`, and
 * another student's id stays a `404`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = student<{ attemptId: string }>(async ({ actor, params }) => {
  const result = await reviewAttempt(actor, params.attemptId);
  return NextResponse.json({ data: { attempt: result.attempt, results: result.results } });
});
