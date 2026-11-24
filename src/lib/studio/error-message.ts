/**
 * A studio API error envelope (`API_CONTRACTS.md` §2), reduced to the sentence an author can
 * act on: the first field detail when there is one, then the general message, then a fallback
 * the caller writes for its own control.
 */

type ErrorBody = { error?: { message?: string; details?: { message: string }[] } };

export function apiErrorMessage(body: unknown, fallback: string): string {
  const envelope = body as ErrorBody | null;
  return envelope?.error?.details?.[0]?.message ?? envelope?.error?.message ?? fallback;
}
