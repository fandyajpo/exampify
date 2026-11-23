import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { runEmailJob, type EmailJobOutcome } from "@/lib/jobs/email";
import { verifyQstashSignature } from "@/lib/jobs/qstash";
import { jobRunRequestSchema } from "@/lib/validation/jobs";

/**
 * `POST /api/v1/internal/jobs/send-email` (`BACKGROUND_JOBS.md` §5,
 * `EMAIL_AND_NOTIFICATIONS.md` §4).
 *
 * The only route that sends auth mail. QStash signs the request and is the sole caller in
 * a deployed environment; the local bypass exists because QStash cannot reach `localhost`
 * (§11) and is refused in production by both the `NODE_ENV` check and the boot assertion
 * in `lib/env.ts`.
 *
 * Status semantics (§5.2): `200` means delivered or intentionally skipped — never retry;
 * `500` means the attempt did not reach the relay and QStash should redeliver. A refusal
 * or an `unknown` disposition is a `200` because repeating it would repeat the same
 * outcome, and the row already records which one it was.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAuthorized(request: NextRequest, raw: string): Promise<boolean> {
  const bypass = env.JOBS_DEV_BYPASS;
  if (process.env.NODE_ENV !== "production" && bypass) {
    return request.headers.get("x-jobs-bypass") === bypass;
  }
  return verifyQstashSignature(request.headers.get("upstash-signature") ?? "", raw);
}

function counts(outcome: EmailJobOutcome): { processed: number; skipped: number; failed: number } {
  if (outcome === "sent") return { processed: 1, skipped: 0, failed: 0 };
  if (outcome === "skipped") return { processed: 0, skipped: 1, failed: 0 };
  if (outcome === "retry") return { processed: 0, skipped: 0, failed: 1 };
  // `failed` and `uncertain` both mean no message was handed over; the row says which.
  return { processed: 0, skipped: 0, failed: 1 };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const raw = await request.text();

  if (!(await isAuthorized(request, raw))) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or missing job signature.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 401 },
    );
  }

  let jobRunId: string;
  try {
    jobRunId = jobRunRequestSchema.parse(JSON.parse(raw)).jobRunId;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "Expected { jobRunId }.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 400 },
    );
  }

  try {
    const outcome = await runEmailJob(jobRunId);
    console.log(
      JSON.stringify({ level: "info", event: "job_run", job: "send-email", jobRunId, outcome }),
    );
    return NextResponse.json({ data: counts(outcome) }, { status: outcome === "retry" ? 500 : 200 });
  } catch (error) {
    // An unexpected failure (a database outage, say) is retryable; the row still holds the
    // claim, and the stale-claim window lets the next delivery take it over.
    console.error(
      JSON.stringify({ level: "error", event: "job_crashed", job: "send-email", jobRunId, error: String(error) }),
    );
    return NextResponse.json(
      {
        error: {
          code: "JOB_FAILED",
          message: "The job did not complete.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 500 },
    );
  }
}
