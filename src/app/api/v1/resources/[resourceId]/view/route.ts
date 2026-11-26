import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { errorResponse } from "@/lib/http/respond";
import { isSameOriginRequest } from "@/lib/http/origin";
import { recordResourceRead } from "@/lib/services/progress";

/**
 * `POST /api/v1/resources/{resourceId}/view` (`API_CONTRACTS.md` §4.4, `FR-PROG-07`).
 *
 * The reader page is cached per page, so the server render cannot know who is reading; the
 * browser reports the visit here and the server decides what it means. That keeps the
 * "server records the fact" rule (`OBS §6.1`) while leaving the reader statically cacheable.
 *
 * `204` always — signed out, unknown id, unpublished resource, or a database failure. A
 * progress row is never worth an error in a student's reader, and an unconditional answer
 * cannot tell a signed-out visitor whether a draft resource exists.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ resourceId: string }> },
): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  // A mutation from another origin is a security refusal, not a dropped event (API-11).
  if (!isSameOriginRequest(request)) {
    return errorResponse(
      403,
      { code: "CROSS_ORIGIN_BLOCKED", message: "Cross-origin requests are rejected." },
      requestId,
    );
  }

  try {
    const { resourceId } = await context.params;
    const actor = await getActor();
    if (actor) await recordResourceRead(actor, resourceId);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "resource_read_failed",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "x-request-id": requestId },
  });
}
