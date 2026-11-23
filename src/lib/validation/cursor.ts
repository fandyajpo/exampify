import { HttpError } from "@/lib/http/errors";

/**
 * Opaque cursor pagination (`API_CONTRACTS.md` §10): base64url of `{ k, id }`, where `k` is
 * the sort value of the last row and `id` breaks ties.
 *
 * The payload is opaque to clients but not secret, so it is parsed defensively: a corrupt or
 * truncated cursor is a `422 INVALID_CURSOR`, never a crash and never a silent first page.
 */

export type Cursor = {
  /** The sort value of the last row on the previous page. */
  k: string | number;
  id: string;
};

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): Cursor {
  const invalid = new HttpError(422, "INVALID_CURSOR", "That pagination cursor is not valid.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw invalid;
  }

  if (typeof parsed !== "object" || parsed === null) throw invalid;
  const { k, id } = parsed as Record<string, unknown>;
  if ((typeof k !== "string" && typeof k !== "number") || typeof id !== "string") throw invalid;

  return { k, id };
}
