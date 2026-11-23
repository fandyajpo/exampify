/**
 * Slug generation and validation (`DATABASE_SCHEMA.md` §6.1: `CHECK (slug GLOB '[a-z0-9]*'
 * AND slug NOT GLOB '*[^a-z0-9-]*')`).
 *
 * A slug is part of a public URL, so it is derived here once rather than by each editor:
 * lower case, ASCII, single hyphens, no leading or trailing hyphen.
 */

export const SLUG_MAX = 80;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, "");
}
