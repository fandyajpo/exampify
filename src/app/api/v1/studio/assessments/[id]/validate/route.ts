import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { validateAssessment } from "@/lib/services/assessments-admin";

/**
 * `POST /api/v1/studio/assessments/{id}/validate` (`API_CONTRACTS.md` §7.3): the `§10.2`
 * gates as a dry run, sharing the publish transition's evaluation.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("content:read:studio", async ({ params }) =>
  NextResponse.json({ data: await validateAssessment(params.id) }),
);
