import { NextResponse } from "next/server";

import { readJson } from "@/lib/http/studio";
import { student } from "@/lib/http/student";
import { saveAnswers } from "@/lib/services/attempts";
import { saveAnswersSchema } from "@/lib/validation/attempts";

/**
 * `PATCH /api/v1/attempts/{attemptId}/answers` (`API_CONTRACTS.md` §5.3).
 *
 * A batch of one to four answers, each with the question it belongs to. `answer: null`
 * clears an item. The reply carries the answered count and the refreshed expiry, plus
 * `reveal` only when a practice save newly answers exactly one item — the immediate-feedback
 * path; `test` and `mock` never see a key here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = student<{ attemptId: string }>(async ({ actor, params, request }) => {
  const input = await readJson(saveAnswersSchema, request);
  const result = await saveAnswers(actor, params.attemptId, input);

  return NextResponse.json({ data: result });
});
