/**
 * Canonical content paths (`INFORMATION_ARCHITECTURE.md` §4.1) in one place.
 *
 * These are route shapes, not view decisions, so every producer — pages, the content
 * service, the sitemap — reads them from here. Changing a segment is a one-line edit that
 * cannot leave the sitemap advertising a path the router no longer serves.
 *
 * Plain data with no imports so both the server runtime and scripts can use it.
 */
export const url = {
  curriculum: (curriculum: string) => `/${curriculum}`,
  level: (curriculum: string, level: string) => `/${curriculum}/${level}`,
  subject: (curriculum: string, level: string, subject: string) =>
    `/${curriculum}/${level}/${subject}`,
  chapter: (curriculum: string, level: string, subject: string, chapter: string) =>
    `/${curriculum}/${level}/${subject}/chapters/${chapter}`,
  topic: (curriculum: string, level: string, subject: string, chapter: string, topic: string) =>
    `/${curriculum}/${level}/${subject}/${chapter}/${topic}`,
  resource: (
    curriculum: string,
    level: string,
    subject: string,
    chapter: string,
    topic: string,
    resource: string,
  ) => `/${curriculum}/${level}/${subject}/${chapter}/${topic}/learn/${resource}`,
} as const;
