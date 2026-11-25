import { NextResponse } from "next/server";
import type { z } from "zod";

import { HttpError, type ErrorDetail } from "./errors";

/**
 * The shared failure envelope (`API_CONTRACTS.md` §2.1), used by every route guard.
 *
 * `details` rides only on a validation failure and the extra documented top-level fields
 * (a studio conflict payload) ride in `meta`; an unexpected error is a generic `500` whose
 * cause goes to the log, never to the client (`SEC §7.2`).
 */

export type RouteParams = Record<string, string>;

export function errorResponse(status: number, body: Record<string, unknown>, requestId: string): NextResponse {
  return NextResponse.json(
    { error: { ...body, requestId } },
    { status, headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
  );
}

export function failure(error: unknown, requestId: string): NextResponse {
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

  console.error(
    JSON.stringify({
      level: "error",
      event: "route_failed",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return errorResponse(500, { code: "INTERNAL_ERROR", message: "Something went wrong." }, requestId);
}

/**
 * The one mapping from a failed `.strict()` parse to the documented refusal: a body or query
 * made entirely of unknown keys is `UNKNOWN_FIELD`, anything else is a field-level
 * `VALIDATION_ERROR` (§10).
 */
export function validationFailure(error: z.ZodError, root: "body" | "query"): HttpError {
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
