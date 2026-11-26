import { NextResponse } from "next/server";

import { readQuery } from "@/lib/http/studio";
import { student } from "@/lib/http/student";
import { listStudyProgress } from "@/lib/services/progress";
import { studyProgressQuerySchema } from "@/lib/validation/progress";

/**
 * `GET /api/v1/progress/study` (`API_CONTRACTS.md` §6, `FR-PROG-07`).
 *
 * Reading against practice, per topic: published resources opened, the minutes they
 * represent, and whether the topic has been practised. Unpaginated by contract — a
 * student's topics are bounded by the catalogue — and filtered by `subjectId`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = student(async ({ actor, request }) => {
  const page = await listStudyProgress(actor, readQuery(studyProgressQuerySchema, request));

  return NextResponse.json(page);
});
