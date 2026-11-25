import { NextResponse, type NextRequest } from "next/server";

import { requireVerifiedActor } from "@/lib/auth/actor";
import type { Actor } from "@/lib/rbac";

import { HttpError } from "./errors";
import { isSameOriginRequest } from "./origin";
import { failure, type RouteParams } from "./respond";

/**
 * The guard for student-facing route handlers (`API_CONTRACTS.md` §5).
 *
 * Every `/api/v1/attempts*` handler needs the same four things: a same-origin check before
 * the body is read (`SEC §8`), an authenticated **and verified** actor (`SEC §4.3`: practice
 * waits for verification even though sign-in does not), the documented error envelope, and
 * `Cache-Control: no-store` because the body is one student's attempt.
 *
 * Kept separate from `studio()` because that one gates on a role capability; here any
 * signed-in, verified student passes and ownership is enforced by the service.
 */

export type StudentContext<P extends RouteParams = RouteParams> = {
  actor: Actor;
  params: P;
  request: NextRequest;
};

type RouteContext<P> = { params: Promise<P> };

export function student<P extends RouteParams = RouteParams>(
  handler: (context: StudentContext<P>) => Promise<NextResponse>,
): (request: NextRequest, context: RouteContext<P>) => Promise<NextResponse> {
  return async (request, context) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

    try {
      if (request.method !== "GET" && !isSameOriginRequest(request)) {
        throw new HttpError(403, "CROSS_ORIGIN_BLOCKED", "Cross-origin requests are rejected.");
      }

      const actor = await requireVerifiedActor();
      const params = await context.params;
      const response = await handler({ actor, params, request });

      response.headers.set("Cache-Control", "no-store");
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      return failure(error, requestId);
    }
  };
}
