import { NextResponse } from "next/server";

import { readJson, readQuery } from "@/lib/http/studio";
import { student } from "@/lib/http/student";
import { createAttempt, listAttempts } from "@/lib/services/attempts";
import { attemptListQuerySchema, createAttemptSchema } from "@/lib/validation/attempts";

/**
 * `POST /api/v1/attempts` (`API_CONTRACTS.md` §5.1).
 *
 * Any signed-in, email-verified student. The body names a scope and a selection rule; the
 * service resolves the questions, snapshots the items and returns the student view — text
 * and options only, never a key or an explanation. A `201` is a new attempt, a `200` is the
 * attempt an `Idempotency-Key` already produced.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/v1/attempts` (`API_CONTRACTS.md` §5.5): the caller's history, newest first.
 * Filters `status`, `subjectId`, `topicId`, `from` and `to` (on `startedAt`); `limit` is
 * 1–50 with an opaque `cursor`, and the page carries the §10 envelope.
 */
export const GET = student(async ({ actor, request }) => {
  const page = await listAttempts(actor, readQuery(attemptListQuerySchema, request));
  return NextResponse.json(page);
});

export const POST = student(async ({ actor, request }) => {
  const input = await readJson(createAttemptSchema, request);
  const key = request.headers.get("idempotency-key")?.trim() ?? "";

  const result = await createAttempt(actor, input, key === "" ? null : key);

  return NextResponse.json(
    { data: { attempt: result.attempt, questions: result.questions } },
    { status: result.replayed ? 200 : 201 },
  );
});
