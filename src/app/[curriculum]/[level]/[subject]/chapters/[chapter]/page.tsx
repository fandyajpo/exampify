/**
 * Chapter page (IA `/[curriculum]/[level]/[subject]/chapters/[chapter]`): the topics in a
 * chapter, each linking to its hub. The `chapters` segment is explicit in the IA so a
 * chapter cannot be confused with a topic that shares its slug.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";

import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { breadcrumbTrail } from "@/lib/seo/breadcrumbs";
import { breadcrumbList, pageGraph } from "@/lib/seo/jsonld";
import { buildMetadata, description, titles } from "@/lib/seo/metadata";
import { getChapterPage, url } from "@/lib/services/content";
import { resolveRedirect } from "@/lib/services/redirects";

export const revalidate = 300;

type RouteParams = { curriculum: string; level: string; subject: string; chapter: string };

const getChapter = cache(getChapterPage);

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { curriculum, level, subject, chapter } = await params;
  const page = await getChapter(curriculum, level, subject, chapter);
  if (!page) return {};

  return buildMetadata({
    title: titles.chapter(page.chapter.title, page.context.subject.name, page.context.level.name),
    description: description(
      [page.chapter.summary],
      `Topics in ${page.chapter.title}, part of ${page.context.subject.name} ${page.context.level.name}, with study material and practice for each.`,
    ),
    path: url.chapter(curriculum, level, subject, chapter),
  });
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<React.JSX.Element> {
  const { curriculum, level, subject, chapter } = await params;
  const page = await getChapter(curriculum, level, subject, chapter);
  if (!page) {
    const moved = await resolveRedirect(url.chapter(curriculum, level, subject, chapter));
    if (moved) permanentRedirect(moved);
    notFound();
  }

  const trail = breadcrumbTrail({
    curriculum: page.context.curriculum,
    level: page.context.level,
    subject: page.context.subject,
    chapter: { slug: page.chapter.slug, title: page.chapter.title },
  });

  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="border-b border-line-strong bg-paper-accent">
          <div className="shell-narrow py-12 md:py-16">
            <Breadcrumbs items={trail} />

            <h1 className="mt-6 font-display text-4xl font-semibold tracking-[-0.03em]">
              {page.chapter.title}
            </h1>
            {page.chapter.summary ? (
              <p className="mt-4 max-w-[62ch] font-editorial text-2xl leading-[1.35] text-ink-2">
                {page.chapter.summary}
              </p>
            ) : null}
          </div>
        </section>

        <div className="shell-narrow section-y">
          {page.topics.length === 0 ? (
            <p className="text-ink-2">No topics are published in this chapter yet.</p>
          ) : (
            <ol className="divide-y divide-line border-t border-line">
              {page.topics.map((topic, index) => (
                <li key={topic.slug}>
                  <Link
                    href={topic.href}
                    className="flex items-baseline gap-4 py-5 transition-colors hover:text-cobalt"
                  >
                    <span className="font-mono text-xs text-ink-3">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-lg font-semibold tracking-[-0.01em]">
                        {topic.title}
                      </span>
                      {topic.summary ? (
                        <span className="mt-1 block text-sm text-ink-2">{topic.summary}</span>
                      ) : null}
                    </span>
                    {topic.estimatedMinutes ? (
                      <span className="text-sm whitespace-nowrap text-ink-3">
                        {topic.estimatedMinutes} min
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>

      <SiteFooter />

      <JsonLd data={pageGraph([breadcrumbList(trail)])} />
    </>
  );
}
