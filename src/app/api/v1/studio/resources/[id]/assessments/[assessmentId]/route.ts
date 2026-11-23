import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { unlinkAssessment } from "@/lib/services/resources-admin";

/**
 * `DELETE /api/v1/studio/resources/{id}/assessments/{assessmentId}` (`API_CONTRACTS.md`
 * §7.2). Unlinking the last assessment reverts the derived `format` to `study_material`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = studio<{ id: string; assessmentId: string }>(
  "content:write",
  async ({ actor, params }) => {
    await unlinkAssessment(actor, params.id, params.assessmentId);
    return new NextResponse(null, { status: 204 });
  },
);
