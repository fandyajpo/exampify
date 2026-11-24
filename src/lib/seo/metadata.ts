import type { Metadata } from "next";

import { publicEnv } from "@/lib/env";

/**
 * Metadata builders (`SEO_AND_CONTENT_STRATEGY.md` §3.2). Titles and descriptions are built
 * here from resolved entities — no page assembles a title inline, and an author override
 * only ever comes from the documented `seo_title` / `seo_description` fields.
 *
 * Every public page sets `robots` explicitly: `index, follow` by default, `noindex, follow`
 * for filtered views and thin pages. Omitting it is a defect in §3.2.
 */

const BRAND = "Exampify";

/**
 * A title that already names the brand must not go through the root layout's
 * `%s | Exampify` template, or the browser renders the brand twice.
 */
function namesBrand(title: string): boolean {
  return title.startsWith(BRAND) || title.endsWith(`— ${BRAND}`);
}

export function absoluteUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}${path === "/" ? "" : path}`;
}

export const titles = {
  home: () => `${BRAND} — Study notes, lessons & practice questions`,
  subjects: () => `Subjects: study notes, lessons & practice — ${BRAND}`,
  curriculum: (curriculum: string) => `${curriculum} revision notes & practice — ${BRAND}`,
  level: (curriculum: string, level: string) =>
    `${curriculum} ${level} revision notes & practice — ${BRAND}`,
  subject: (subject: string, level: string, curriculumShort: string, override?: string | null) =>
    override ?? `${subject} ${level} ${curriculumShort} — Notes, lessons & practice`,
  chapter: (chapter: string, subject: string, level: string) =>
    `${chapter} — ${subject} ${level}`,
  topic: (topic: string, subject: string) =>
    `${topic}: study notes & practice questions — ${subject}`,
  resource: (resourceTitle: string, topic: string) => `${resourceTitle} — ${topic}`,
} as const;

/** First non-empty candidate, trimmed to the 158-character ceiling on a word boundary. */
export function description(
  candidates: Array<string | null | undefined>,
  fallback: string,
): string {
  const chosen = candidates.find((candidate) => candidate && candidate.trim().length > 0) ?? fallback;
  const text = chosen.replace(/\s+/g, " ").trim();
  if (text.length <= 158) return text;

  const cut = text.slice(0, 155);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

type MetadataInput = {
  title: string;
  description: string;
  /** Canonical path, e.g. `/subjects`; the metadata base makes it absolute. */
  path: string;
  noindex?: boolean;
};

export function buildMetadata({ title, description: metaDescription, path, noindex }: MetadataInput): Metadata {
  const canonical = absoluteUrl(path);

  return {
    title: namesBrand(title) ? { absolute: title } : title,
    description: metaDescription,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      title,
      description: metaDescription,
      url: canonical,
      siteName: BRAND,
      locale: "en",
      // The card is generated once at `app/opengraph-image.tsx`; naming it here keeps the
      // image on every page even though pages set their own `openGraph` object.
      images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: BRAND }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription,
      images: [absoluteUrl("/opengraph-image")],
    },
  };
}
