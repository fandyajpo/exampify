import { NextResponse } from "next/server";

import { notFound } from "@/lib/http/errors";
import { readJson, studio } from "@/lib/http/studio";
import { getAssessmentAdmin, updateAssessment } from "@/lib/services/assessments-admin";
import { assessmentUpdateSchema } from "@/lib/validation/assessments";

/**
 * `GET`/`PATCH /api/v1/studio/assessments/{id}` (`API_CONTRACTS.md` §7.3).
 *
 * The read includes the ordered items with their full questions (the studio may see
 * `answerKey`); the write replaces `items` wholesale and needs `expectedUpdatedAt`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = studio<{ id: string }>("content:read:studio", async ({ params }) => {
  const assessment = await getAssessmentAdmin(params.id);
  if (!assessment) throw notFound("assessment");
  return NextResponse.json({ data: assessment });
});

export const PATCH = studio<{ id: string }>("content:write", async ({ actor, params, request }) => {
  const input = await readJson(assessmentUpdateSchema, request);
  return NextResponse.json({ data: await updateAssessment(actor, params.id, input) });
});
