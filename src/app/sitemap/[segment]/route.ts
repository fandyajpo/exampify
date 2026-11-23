import {
  SITEMAP_SEGMENTS,
  sitemapEntries,
  sitemapUrlsetXml,
  SITEMAP_XML_HEADERS,
  type SitemapSegment,
} from "@/lib/seo/sitemap";

/**
 * Sitemap segments (`SEO_AND_CONTENT_STRATEGY.md` §3.5): `/sitemap/<segment>.xml`.
 *
 * A route handler rather than the `sitemap.ts` convention, because the index and the
 * segments are sibling paths with a literal `.xml` suffix that the convention cannot
 * express without colliding with the index.
 */
export const revalidate = 3600;

function isSegment(value: string): value is SitemapSegment {
  return (SITEMAP_SEGMENTS as readonly string[]).includes(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ segment: string }> },
): Promise<Response> {
  const { segment: file } = await params;
  const segment = file.endsWith(".xml") ? file.slice(0, -4) : null;

  if (segment === null || !isSegment(segment)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(sitemapUrlsetXml(await sitemapEntries(segment)), {
    headers: SITEMAP_XML_HEADERS,
  });
}
