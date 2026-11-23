import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";

import { requireCapability } from "@/lib/auth/actor";
import type { Actor, Capability } from "@/lib/rbac";

import { HttpError, type ErrorDetail } from "./errors";
import { isSameOriginRequest } from "./origin";

/**
 * The studio route guard (`API_CONTRACTS.md` §2, §7; `SECURITY_AND_PERMISSIONS.md` §3.1).
 *
 * Every `/api/v1/studio/**` handler is wrapped in `studio()`, which runs the parts that are
 * identical everywhere and easy to forget in one of them:
 *
 * 1. same-origin refusal for a mutation, before the body is read (§8);
 * 2. the capability check, before any query — a `student` never reaches a service
 *    (`SEC §3.1`: the guard runs before the query, not after);
 * 3. the documented error envelope, with `details` only for a validation failure;
 * 4. `Cache-Control: no-store` and the `x-request-id` echo on every response (§2).
 *
 * Handlers stay thin: parse, call one service, return `{ data }`.
 */

export type RouteParams = Record<string, string>;

export type StudioContext<P extends RouteParams = RouteParams> = {
  actor: Actor;
  params: P;
  request: NextRequest;
};

type RouteContext<P> = { params: Promise<P> };

function errorResponse(
  status: number,
  body: Record<string, unknown>,
  requestId: string,
): NextResponse {
  return NextResponse.json(
    { error: { ...body, requestId } },
    { status, headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
  );
}

function failure(error: unknown, requestId: string): NextResponse {
  if (error instanceof HttpError) {
    return errorResponse(
      error.status,
      {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        ...(error.meta ?? {}),
      },
      requestId,
    );
  }

  // Anything unexpected is a 500 with a generic message: the details go to the log, not to
  // the client (`SEC §7.2`).
  console.error(
    JSON.stringify({
      level: "error",
      event: "studio_route_failed",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return errorResponse(500, { code: "INTERNAL_ERROR", message: "Something went wrong." }, requestId);
}

export function studio<P extends RouteParams = RouteParams>(
  capability: Capability,
  handler: (context: StudioContext<P>) => Promise<NextResponse>,
): (request: NextRequest, context: RouteContext<P>) => Promise<NextResponse> {
  return async (request, context) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

    try {
      if (request.method !== "GET" && !isSameOriginRequest(request)) {
        throw new HttpError(403, "CROSS_ORIGIN_BLOCKED", "Cross-origin requests are rejected.");
      }

      const actor = await requireCapability(capability);
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

/**
 * The one mapping from a failed `.strict()` parse to the documented refusal: a body or query
 * made entirely of unknown keys is `UNKNOWN_FIELD`, anything else is a field-level
 * `VALIDATION_ERROR` (§10).
 */
function validationFailure(error: z.ZodError, root: "body" | "query"): HttpError {
  const details: ErrorDetail[] = error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : root,
    code: issue.code,
    message: issue.message,
  }));

  return new HttpError(
    422,
    error.issues.every((issue) => issue.code === "unrecognized_keys") ? "UNKNOWN_FIELD" : "VALIDATION_ERROR",
    root === "body" ? "Some fields need attention." : "Some query parameters need attention.",
    details,
  );
}

/** A parsed, `.strict()`-validated JSON body, or the documented refusal. */
export async function readJson<T extends z.ZodType>(
  schema: T,
  request: NextRequest,
): Promise<z.output<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "The request body is not valid JSON.");
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) throw validationFailure(parsed.error, "body");

  return parsed.data;
}

/**
 * The allow-listed query string of a list endpoint (§10): unknown params are `422`, and a
 * repeated param keeps its first value rather than becoming an array no schema expects.
 */
export function readQuery<T extends z.ZodType>(schema: T, request: NextRequest): z.output<T> {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw validationFailure(parsed.error, "query");

  return parsed.data;
}
