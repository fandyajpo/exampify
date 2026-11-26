import { NextResponse } from "next/server";

import { student } from "@/lib/http/student";
import { retryAttempt } from "@/lib/services/attempts";

/**
 * `POST /api/v1/attempts/{attemptId}/retry` (`API_CONTRACTS.md` §5.5).
 *
 * No body. Creates a new attempt from the original's stored config against today's
 * published content — a fresh selection, never the old snapshot. An attempt still in
 * progress must be finished or abandoned first (`409 INVALID_TRANSITION`).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = student<{ attemptId: string }>(async ({ actor, params }) => {
  const result = await retryAttempt(actor, params.attemptId);

  return NextResponse.json(
    { data: { attempt: result.attempt, questions: result.questions } },
    { status: 201 },
  );
});
