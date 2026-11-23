/**
 * Server-rendered JSON-LD (`SEO_AND_CONTENT_STRATEGY.md` §3.4). One script per page graph,
 * built in `lib/seo/jsonld`.
 *
 * `<` is escaped so a stored value can never close the script element.
 */
export function JsonLd({ data }: { data: unknown }): React.JSX.Element {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
