import { NextResponse } from "next/server";

import { readJson, readQuery, studio } from "@/lib/http/studio";
import { createAssessment, listAssessments } from "@/lib/services/assessments-admin";
import { assessmentCreateSchema, assessmentListQuerySchema } from "@/lib/validation/assessments";

/**
 * `GET`/`POST /api/v1/studio/assessments` (`API_CONTRACTS.md` §7.3).
 *
 * The list is filtered and keyset-paginated; a new assessment starts as a draft with the
 * items it was created with (possibly none — the composer fills them, and the publish gate
 * requires 1–60).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio("content:read:studio", async ({ request }) =>
  NextResponse.json(await listAssessments(readQuery(assessmentListQuerySchema, request))),
);

export const POST = studio("content:write", async ({ actor, request }) => {
  const input = await readJson(assessmentCreateSchema, request);
  return NextResponse.json({ data: await createAssessment(actor, input) }, { status: 201 });
});
