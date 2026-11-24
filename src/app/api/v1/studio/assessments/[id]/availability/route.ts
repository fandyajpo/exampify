import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { getAssessmentAvailability } from "@/lib/services/assessments-admin";

/**
 * `GET /api/v1/studio/assessments/{id}/availability` (`API_CONTRACTS.md` §7.3): the live
 * question counts the composer shows, grouped by type and difficulty. One grouped query.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio<{ id: string }>("content:read:studio", async ({ params }) =>
  NextResponse.json({ data: await getAssessmentAvailability(params.id) }),
);
