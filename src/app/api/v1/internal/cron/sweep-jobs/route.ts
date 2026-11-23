import { NextResponse, type NextRequest } from "next/server";

import { verifyCronRequest } from "@/lib/jobs/cron";
import { sweepEmailJobs } from "@/lib/jobs/email";

/**
 * `POST /api/v1/internal/cron/sweep-jobs` (`BACKGROUND_JOBS.md` §8, J-01, J-09).
 *
 * The backstop for the outbox: a publish that never happened, or a worker that died
 * holding a claim, leaves a row nobody will look at. This sweep re-enqueues those rows and
 * answers with the counts the internal-endpoint contract requires (§5.2) — never row
 * contents, never an email address.
 *
 * Runs on a schedule in production and by hand locally (`bun run jobs:drain`).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or missing cron credentials.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await sweepEmailJobs();
    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // A database outage is retryable: leave the rows alone and let the next run take them.
    console.error(JSON.stringify({ level: "error", event: "job_sweep_failed", error: String(error) }));
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "The sweep did not complete.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
