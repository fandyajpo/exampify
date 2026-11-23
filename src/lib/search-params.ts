/**
 * `searchParams` reaches a page as a promise of `string | string[] | undefined` values
 * (`TECHNICAL_STANDARDS.md` §5). These screens read at most one value per key, so take the
 * first and treat anything else as absent.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

export function searchParam(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}
