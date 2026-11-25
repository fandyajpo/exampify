import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";

import { requireCapability } from "@/lib/auth/actor";
import type { Actor, Capability } from "@/lib/rbac";

import { HttpError } from "./errors";
import { isSameOriginRequest } from "./origin";
import { failure, validationFailure, type RouteParams } from "./respond";

export type { RouteParams } from "./respond";

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

export type StudioContext<P extends RouteParams = RouteParams> = {
  actor: Actor;
  params: P;
  request: NextRequest;
};

type RouteContext<P> = { params: Promise<P> };

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
