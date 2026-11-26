import { NextResponse } from "next/server";

import { student } from "@/lib/http/student";
import { getTopicPerformance } from "@/lib/services/progress";

/**
 * `GET /api/v1/progress/topics/{topicId}` (`API_CONTRACTS.md` §6).
 *
 * One topic's performance with its difficulty and question-type breakdown and its latest
 * submitted attempts. A topic the student never practised answers zeroes and a `null`
 * accuracy — only an unknown topic id is a `404`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = student<{ topicId: string }>(async ({ actor, params }) => {
  const detail = await getTopicPerformance(actor, params.topicId);

  return NextResponse.json({ data: detail });
});
