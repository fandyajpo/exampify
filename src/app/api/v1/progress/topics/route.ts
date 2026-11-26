import { NextResponse } from "next/server";

import { readQuery } from "@/lib/http/studio";
import { student } from "@/lib/http/student";
import { listTopicPerformance } from "@/lib/services/progress";
import { topicPerformanceQuerySchema } from "@/lib/validation/progress";

/**
 * `GET /api/v1/progress/topics` (`API_CONTRACTS.md` §6).
 *
 * The topic performance table: attempts, accuracy and last practised per topic, filtered by
 * subject and sorted by `accuracy` or `lastPracticed`. Cursor-paginated in the §10 envelope.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = student(async ({ actor, request }) => {
  const page = await listTopicPerformance(actor, readQuery(topicPerformanceQuerySchema, request));

  return NextResponse.json(page);
});
