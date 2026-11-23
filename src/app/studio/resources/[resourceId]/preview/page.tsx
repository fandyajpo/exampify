/**
 * Staff preview (`API_CONTRACTS.md` §7.2, `GET /studio/resources/{id}/preview`): rendered
 * blocks with `noindex`, so an unpublished draft is never crawled even if its URL leaks.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/content/block-renderer";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { getResourcePreview } from "@/lib/services/resources-admin";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default async function ResourcePreviewPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}): Promise<React.JSX.Element> {
  const { resourceId } = await params;
  const preview = await getResourcePreview(resourceId);
  if (!preview) notFound();

  return (
    <article className="mx-auto max-w-[720px]">
      <Link
        href={`/studio/resources/${resourceId}`}
        className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        ← Editor
      </Link>

      <header className="mt-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Draft preview</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">
          {preview.resource.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-3">
          <ContentStatusBadge status={preview.resource.status} />
          <span>{preview.resource.readingMinutes} min read</span>
          <span>{preview.resource.format.replace(/_/g, " ")}</span>
        </div>
        {preview.resource.subtitle ? <p className="mt-3 text-ink-2">{preview.resource.subtitle}</p> : null}
      </header>

      <div className="mt-8">
        <BlockRenderer blocks={preview.blocks} media={preview.media} />
      </div>
    </article>
  );
}
