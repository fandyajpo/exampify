/**
 * Topic hub (IA `/[curriculum]/[level]/[subject]/[chapter]/[topic]`): objectives and the
 * readable resources for the topic. The topic segment is bare (not `/topics/…`) so the
 * canonical URL stays short; the sibling `chapters` segment is static and wins by
 * specificity.
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
import { getTopicPage, url } from "@/lib/services/content";
import { resolveRedirect } from "@/lib/services/redirects";

export const revalidate = 300;

type RouteParams = {
  curriculum: string;
  level: string;
  subject: string;
  chapter: string;
  topic: string;
};

const getTopic = cache(getTopicPage);

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { curriculum, level, subject, chapter, topic } = await params;
  const page = await getTopic(curriculum, level, subject, chapter, topic);
  if (!page) return {};

  return buildMetadata({
    title: titles.topic(page.topic.title, page.context.subject.name),
    description: description(
      [page.topic.summary],
      `${page.topic.title}: learning objectives, study notes and practice questions for ${page.context.subject.name} ${page.context.level.name}.`,
    ),
    path: url.topic(curriculum, level, subject, chapter, topic),
  });
}

export default async function TopicPage({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<React.JSX.Element> {
  const { curriculum, level, subject, chapter, topic } = await params;
  const page = await getTopic(curriculum, level, subject, chapter, topic);
  if (!page) {
    const moved = await resolveRedirect(url.topic(curriculum, level, subject, chapter, topic));
    if (moved) permanentRedirect(moved);
    notFound();
  }

  const trail = breadcrumbTrail({
    curriculum: page.context.curriculum,
    level: page.context.level,
    subject: page.context.subject,
    chapter: page.chapter,
    topic: { slug: page.topic.slug, title: page.topic.title },
  });

  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="border-b border-line-strong bg-paper-accent">
          <div className="mx-auto w-full max-w-[820px] px-4 py-12 md:px-6 md:py-16">
            <Breadcrumbs items={trail} />

            <h1 className="mt-6 font-display text-4xl font-semibold tracking-[-0.03em]">
              {page.topic.title}
            </h1>
            {page.topic.summary ? (
              <p className="mt-4 max-w-[62ch] font-editorial text-2xl leading-[1.35] text-ink-2">
                {page.topic.summary}
              </p>
            ) : null}
            {page.topic.estimatedMinutes ? (
              <p className="mt-5 text-sm text-ink-3">{page.topic.estimatedMinutes} min</p>
            ) : null}
          </div>
        </section>

        <div className="mx-auto w-full max-w-[820px] px-4 py-14 md:px-6 md:py-20">
          {page.topic.objectives.length > 0 ? (
            <section aria-labelledby="objectives">
              <h2
                id="objectives"
                className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3"
              >
                What you should be able to do
              </h2>
              <ul className="mt-4 space-y-2">
                {page.topic.objectives.map((objective) => (
                  <li key={objective} className="flex gap-3 text-ink-2">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="resources" className="mt-14">
            <h2 id="resources" className="font-display text-2xl font-semibold tracking-[-0.015em]">
              Study material
            </h2>
            {page.resources.length === 0 ? (
              <p className="mt-4 text-ink-2">No material is published for this topic yet.</p>
            ) : (
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {page.resources.map((resource) => (
                  <li key={resource.slug}>
                    <Link
                      href={resource.href}
                      className="group flex items-baseline justify-between gap-6 py-5 transition-colors hover:text-cobalt"
                    >
                      <span>
                        <span className="block font-display text-lg font-semibold tracking-[-0.01em]">
                          {resource.title}
                        </span>
                        {resource.summary ? (
                          <span className="mt-1 block max-w-[60ch] text-sm text-ink-2">
                            {resource.summary}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm whitespace-nowrap text-ink-3">
                        {resource.readingMinutes} min read
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />

      <JsonLd data={pageGraph([breadcrumbList(trail)])} />
    </>
  );
}
