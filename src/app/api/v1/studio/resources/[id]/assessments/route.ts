import { NextResponse } from "next/server";

import { readJson, studio } from "@/lib/http/studio";
import { linkAssessment } from "@/lib/services/resources-admin";
import { resourceAssessmentSchema } from "@/lib/validation/resources";

/**
 * `POST /api/v1/studio/resources/{id}/assessments` (`API_CONTRACTS.md` §7.2). An assessment
 * from another topic or subject is `422 ASSESSMENT_SCOPE_MISMATCH` (API-20).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(resourceAssessmentSchema, request);
  await linkAssessment(actor, params.id, input);
  return new NextResponse(null, { status: 204 });
});
