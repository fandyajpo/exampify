import { NextResponse } from "next/server";

import { studio } from "@/lib/http/studio";
import { duplicateAssessment } from "@/lib/services/assessments-admin";

/** `POST /api/v1/studio/assessments/{id}/duplicate` (`API_CONTRACTS.md` §7.3). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = studio<{ id: string }>("content:write", async ({ actor, params }) =>
  NextResponse.json({ data: await duplicateAssessment(actor, params.id) }, { status: 201 }),
);
