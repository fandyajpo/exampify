/**
 * `HttpError` — the one way a handler or service refuses a request
 * ([API_CONTRACTS.md](../../../docs/API_CONTRACTS.md) §2.1).
 *
 * Services throw it instead of returning result unions, so a refusal cannot be ignored by
 * forgetting to check a return value, and the HTTP layer turns it into the documented error
 * envelope. `details` exists only for `422`-shaped problems: one entry per offending field.
 */

export type ErrorDetail = {
  /** JSON path of the offending field, e.g. `items.0.points`. */
  path: string;
  code: string;
  message: string;
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetail[],
    /** Extra documented top-level error fields, e.g. the conflict payload of §12. */
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function unauthenticated(): HttpError {
  return new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
}

export function notFound(resource = "record"): HttpError {
  return new HttpError(404, "NOT_FOUND", `That ${resource} does not exist.`);
}

/**
 * `expectedUpdatedAt` mismatch (§2, "Concurrency"). The conflict payload of §12 rides in
 * `meta` so the studio can offer "Reload theirs" or "Overwrite" instead of guessing.
 */
export function contentConflict(meta?: {
  currentUpdatedAt?: string;
  currentUpdatedBy?: string | null;
  changedFields?: string[];
}): HttpError {
  return new HttpError(
    409,
    "CONTENT_CONFLICT",
    "Someone else changed this while you were editing. Reload to see their version.",
    undefined,
    meta,
  );
}

export function slugTaken(): HttpError {
  return new HttpError(409, "SLUG_TAKEN", "That slug is already used by a sibling.");
}
