import { NextResponse } from "next/server";

import { student } from "@/lib/http/student";
import { resumeAttempt } from "@/lib/services/attempts";

/**
 * `GET /api/v1/attempts/{attemptId}` (`API_CONTRACTS.md` §5.2).
 *
 * Owner only: another student's id is a `404`, never a `403`. The reply restores the
 * runner — questions, the answers already saved and whether the attempt can continue — and
 * never carries a key or an explanation. An attempt read after its window is marked expired
 * first, so `canResume` is false and the status matches what a write would see.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = student<{ attemptId: string }>(async ({ actor, params }) => {
  const result = await resumeAttempt(actor, params.attemptId);

  return NextResponse.json({
    data: {
      attempt: result.attempt,
      questions: result.questions,
      savedAnswers: result.savedAnswers,
    },
  });
});
