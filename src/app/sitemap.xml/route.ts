import { publicEnv } from "@/lib/env";
import { sitemapIndexXml, SITEMAP_XML_HEADERS } from "@/lib/seo/sitemap";

/**
 * Sitemap index (`SEO_AND_CONTENT_STRATEGY.md` §3.5): `/sitemap.xml` lists the segment files
 * that `sitemap/[segment]` serves. No `lastmod` here — it would be the request time, and
 * `lastmod` must reflect real content change.
 */
export function GET(): Response {
  return new Response(sitemapIndexXml(publicEnv.NEXT_PUBLIC_SITE_URL), {
    headers: SITEMAP_XML_HEADERS,
  });
}
