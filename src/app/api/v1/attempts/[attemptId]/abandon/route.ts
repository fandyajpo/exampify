import { NextResponse } from "next/server";

import { student } from "@/lib/http/student";
import { abandonAttempt } from "@/lib/services/attempts";

/**
 * `POST /api/v1/attempts/{attemptId}/abandon` (`API_CONTRACTS.md` §5.5).
 *
 * No body. Idempotent: abandoning an abandoned attempt answers the same body. A submitted
 * attempt is `422 ATTEMPT_NOT_EDITABLE`, and one past its window is `409 ATTEMPT_EXPIRED`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = student<{ attemptId: string }>(async ({ actor, params }) => {
  const result = await abandonAttempt(actor, params.attemptId);
  return NextResponse.json({ data: result });
});
