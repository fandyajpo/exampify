/**
 * Subject page (IA `/[curriculum]/[level]/[subject]`, `FR-DISC-02/03`): the chapter list and
 * the topics inside each chapter, read from the published taxonomy.
 *
 * Chapters link to their own page; topics link to the topic hub, which is where resources
 * live. `notFound()` covers drafts as well as missing slugs, because the service filters
 * `status = 'published'` at every level.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";

import { notFound } from "next/navigation";
import { cache } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { breadcrumbTrail } from "@/lib/seo/breadcrumbs";
import { breadcrumbList, course, pageGraph } from "@/lib/seo/jsonld";
import { buildMetadata, description, titles } from "@/lib/seo/metadata";
import { url } from "@/lib/services/content";
import { getSubjectDetail, type SubjectDetail } from "@/lib/services/taxonomy";

export const revalidate = 300;

type RouteParams = { curriculum: string; level: string; subject: string };

const getDetail = cache(
  async (curriculum: string, level: string, subject: string): Promise<SubjectDetail | null> =>
    getSubjectDetail(curriculum, level, subject),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { curriculum, level, subject } = await params;
  const detail = await getDetail(curriculum, level, subject);
  if (!detail) return {};

  return buildMetadata({
    title: titles.subject(detail.name, detail.levelName, detail.curriculumShort, detail.seoTitle),
    description: description(
      [detail.seoDescription, detail.summary],
      `Study notes, lessons and practice questions for ${detail.name} ${detail.levelName}, organised by chapter and topic.`,
    ),
    path: detail.href,
  });
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<React.JSX.Element> {
  const { curriculum, level, subject } = await params;
  const detail = await getDetail(curriculum, level, subject);
  if (!detail) notFound();

  const trail = breadcrumbTrail({
    curriculum: { slug: detail.curriculumSlug, name: detail.curriculumName },
    level: { slug: detail.levelSlug, name: detail.levelName },
    subject: { slug: detail.slug, name: detail.name },
  });

  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="border-b border-line-strong bg-paper-accent">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-12 md:px-6 md:py-16 lg:px-8">
            <Breadcrumbs items={trail} />

            <h1 className="mt-6 font-display text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
              {detail.name}
            </h1>
            {detail.summary ? (
              <p className="mt-4 max-w-[62ch] font-editorial text-2xl leading-[1.35] text-ink-2">
                {detail.summary}
              </p>
            ) : null}
            <p className="mt-5 text-sm text-ink-3">
              {detail.groupName} · {detail.chapters.length}{" "}
              {detail.chapters.length === 1 ? "chapter" : "chapters"}
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[820px] px-4 py-14 md:px-6 md:py-20">
          {detail.chapters.length === 0 ? (
            <p className="text-ink-2">No chapters are published for this subject yet.</p>
          ) : (
            <ol className="space-y-12">
              {detail.chapters.map((chapter, index) => (
                <li key={chapter.slug}>
                  <div className="border-b border-line pb-4">
                    <p className="font-mono text-xs text-ink-3">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.015em]">
                      <Link
                        href={url.chapter(curriculum, level, subject, chapter.slug)}
                        className="transition-colors hover:text-cobalt"
                      >
                        {chapter.title}
                      </Link>
                    </h2>
                    {chapter.summary ? (
                      <p className="mt-2 max-w-[62ch] text-ink-2">{chapter.summary}</p>
                    ) : null}
                  </div>

                  {chapter.topics.length > 0 ? (
                    <ul className="divide-y divide-line">
                      {chapter.topics.map((topic) => (
                        <li key={topic.slug} className="py-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                            <h3 className="font-display text-lg font-semibold tracking-[-0.01em]">
                              <Link
                                href={url.topic(
                                  curriculum,
                                  level,
                                  subject,
                                  chapter.slug,
                                  topic.slug,
                                )}
                                className="transition-colors hover:text-cobalt"
                              >
                                {topic.title}
                              </Link>
                            </h3>
                            {topic.estimatedMinutes ? (
                              <p className="text-sm text-ink-3">{topic.estimatedMinutes} min</p>
                            ) : null}
                          </div>
                          {topic.summary ? (
                            <p className="mt-1 max-w-[64ch] text-sm text-ink-2">{topic.summary}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-ink-3">No topics published in this chapter yet.</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>

      <SiteFooter />

      <JsonLd data={pageGraph([
      breadcrumbList(trail),
      course({
        name: `${detail.name} — ${detail.levelName}`,
        description:
          detail.seoDescription ??
          detail.summary ??
          `Study notes, lessons and practice for ${detail.name} ${detail.levelName}, organised by chapter and topic.`,
        educationalLevel: detail.levelName,
        path: detail.href,
      }),
    ])} />
    </>
  );
}
