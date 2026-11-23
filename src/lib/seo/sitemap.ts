import "server-only";

import { getDb } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo/metadata";
import { url } from "@/lib/urls";

/**
 * Sitemap segments (`SEO_AND_CONTENT_STRATEGY.md` §3.5, `INFORMATION_ARCHITECTURE.md` §4.4):
 * `/sitemap/<segment>.xml`, one per entity type. Only published rows are selected, so an
 * archived entity disappears on the next regeneration.
 *
 * `lastModified` is the entity's own `updated_at` — publishing updates it — rather than the
 * request time. A precise per-subtree maximum arrives with the studio's publish
 * invalidation; until then this never claims a page changed when it did not.
 */

export const SITEMAP_SEGMENTS = [
  "static",
  "subjects",
  "chapters",
  "topics",
  "resources",
  "assessments",
] as const;

export type SitemapSegment = (typeof SITEMAP_SEGMENTS)[number];

export type SitemapEntry = { url: string; lastModified?: Date };

const PUBLISHED = "published" as const;

async function staticSegment(): Promise<SitemapEntry[]> {
  const db = await getDb();
  const curricula = await db
    .selectFrom("curricula")
    .select(["slug", "updated_at"])
    .where("status", "=", PUBLISHED)
    .execute();
  const levels = await db
    .selectFrom("education_levels as l")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select(["l.slug as level_slug", "c.slug as curriculum_slug", "l.updated_at as updated_at"])
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .execute();

  // An empty catalogue has no honest timestamp to publish, so the index pages carry none.
  const newest = Math.max(
    0,
    ...curricula.map((row) => row.updated_at),
    ...levels.map((row) => row.updated_at),
  );
  const indexLastModified = newest > 0 ? { lastModified: new Date(newest) } : {};

  return [
    { url: absoluteUrl("/"), ...indexLastModified },
    { url: absoluteUrl("/subjects"), ...indexLastModified },
    ...curricula.map((row) => ({
      url: absoluteUrl(url.curriculum(row.slug)),
      lastModified: new Date(row.updated_at),
    })),
    ...levels.map((row) => ({
      url: absoluteUrl(url.level(row.curriculum_slug, row.level_slug)),
      lastModified: new Date(row.updated_at),
    })),
  ];
}

async function subjectSegment(): Promise<SitemapEntry[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("subjects as s")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      "s.slug as subject_slug",
      "l.slug as level_slug",
      "c.slug as curriculum_slug",
      "s.updated_at as updated_at",
    ])
    .where("s.status", "=", PUBLISHED)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .execute();

  return rows.map((row) => ({
    url: absoluteUrl(url.subject(row.curriculum_slug, row.level_slug, row.subject_slug)),
    lastModified: new Date(row.updated_at),
  }));
}

async function chapterSegment(): Promise<SitemapEntry[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("chapters as ch")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      "ch.slug as chapter_slug",
      "s.slug as subject_slug",
      "l.slug as level_slug",
      "c.slug as curriculum_slug",
      "ch.updated_at as updated_at",
    ])
    .where("ch.status", "=", PUBLISHED)
    .where("s.status", "=", PUBLISHED)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .execute();

  return rows.map((row) => ({
    url: absoluteUrl(
      url.chapter(row.curriculum_slug, row.level_slug, row.subject_slug, row.chapter_slug),
    ),
    lastModified: new Date(row.updated_at),
  }));
}

async function topicSegment(): Promise<SitemapEntry[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("topics as t")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      "t.slug as topic_slug",
      "ch.slug as chapter_slug",
      "s.slug as subject_slug",
      "l.slug as level_slug",
      "c.slug as curriculum_slug",
      "t.updated_at as updated_at",
    ])
    .where("t.status", "=", PUBLISHED)
    .where("ch.status", "=", PUBLISHED)
    .where("s.status", "=", PUBLISHED)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .execute();

  return rows.map((row) => ({
    url: absoluteUrl(
      url.topic(
        row.curriculum_slug,
        row.level_slug,
        row.subject_slug,
        row.chapter_slug,
        row.topic_slug,
      ),
    ),
    lastModified: new Date(row.updated_at),
  }));
}

async function resourceSegment(): Promise<SitemapEntry[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("learning_resources as r")
    .innerJoin("topics as t", "t.id", "r.topic_id")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      "r.slug as resource_slug",
      "t.slug as topic_slug",
      "ch.slug as chapter_slug",
      "s.slug as subject_slug",
      "l.slug as level_slug",
      "c.slug as curriculum_slug",
      "r.updated_at as updated_at",
    ])
    .where("r.status", "=", PUBLISHED)
    .where("t.status", "=", PUBLISHED)
    .where("ch.status", "=", PUBLISHED)
    .where("s.status", "=", PUBLISHED)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .execute();

  return rows.map((row) => ({
    url: absoluteUrl(
      url.resource(
        row.curriculum_slug,
        row.level_slug,
        row.subject_slug,
        row.chapter_slug,
        row.topic_slug,
        row.resource_slug,
      ),
    ),
    lastModified: new Date(row.updated_at),
  }));
}

/** Entries for one segment. `assessments` is empty until Phase 3 publishes assessments. */
export async function sitemapEntries(segment: SitemapSegment): Promise<SitemapEntry[]> {
  switch (segment) {
    case "static":
      return staticSegment();
    case "subjects":
      return subjectSegment();
    case "chapters":
      return chapterSegment();
    case "topics":
      return topicSegment();
    case "resources":
      return resourceSegment();
    case "assessments":
      return [];
  }
}

export const SITEMAP_XML_HEADERS = {
  "content-type": "application/xml; charset=utf-8",
  "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
} as const;

/**
 * Serializers live beside the queries so both routes stay a few lines long. No XML escaping:
 * every value here is an absolute URL built from slug segments and the configured origin.
 */
export function sitemapIndexXml(origin: string): string {
  const entries = SITEMAP_SEGMENTS.map(
    (segment) => `  <sitemap><loc>${origin}/sitemap/${segment}.xml</loc></sitemap>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

export function sitemapUrlsetXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (entry) =>
        `  <url><loc>${entry.url}</loc>` +
        `${entry.lastModified ? `<lastmod>${entry.lastModified.toISOString()}</lastmod>` : ""}</url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
