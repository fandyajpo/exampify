import { NextResponse } from "next/server";

import { readQuery } from "@/lib/http/studio";
import { student } from "@/lib/http/student";
import { getProgressSummary } from "@/lib/services/progress";
import { progressSummaryQuerySchema } from "@/lib/validation/progress";

/**
 * `GET /api/v1/progress/summary` (`API_CONTRACTS.md` §6).
 *
 * The dashboard's numbers: totals, the requested window, up to five focus topics and one
 * activity bucket per day. Every figure is computed live from submitted attempts, so a
 * re-grade changes the dashboard the moment it is read.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = student(async ({ actor, request }) => {
  const summary = await getProgressSummary(
    actor,
    readQuery(progressSummaryQuerySchema, request),
  );

  return NextResponse.json({ data: summary });
});
