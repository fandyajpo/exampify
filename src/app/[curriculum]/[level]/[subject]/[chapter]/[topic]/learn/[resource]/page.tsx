/**
 * Study material / lesson reader (IA `…/[topic]/learn/[resourceSlug]`).
 *
 * The research principle of the product lives here: the page is complete on its own, with
 * no question required to continue. Blocks render in stored order; a lesson's practice
 * section arrives in Phase 3 as a `question_section` block.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";

import { notFound, permanentRedirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import { recordEvent } from "@/lib/analytics/record";
import { BlockRenderer } from "@/components/content/block-renderer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { breadcrumbTrail } from "@/lib/seo/breadcrumbs";
import { breadcrumbList, learningResource, pageGraph } from "@/lib/seo/jsonld";
import { buildMetadata, description, titles } from "@/lib/seo/metadata";
import { getResourcePage, url } from "@/lib/services/content";
import { resolveRedirect } from "@/lib/services/redirects";

export const revalidate = 300;

type RouteParams = {
  curriculum: string;
  level: string;
  subject: string;
  chapter: string;
  topic: string;
  resource: string;
};

const getResource = cache(getResourcePage);

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  very_hard: "Very hard",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { curriculum, level, subject, chapter, topic, resource } = await params;
  const page = await getResource(curriculum, level, subject, chapter, topic, resource);
  if (!page) return {};

  return buildMetadata({
    title: titles.resource(page.resource.title, page.topic.title),
    description: description(
      [page.resource.summary, page.resource.subtitle],
      `${page.resource.title}: study notes for ${page.topic.title} in ${page.context.subject.name} ${page.context.level.name}.`,
    ),
    path: url.resource(curriculum, level, subject, chapter, topic, resource),
  });
}

export default async function ResourcePage({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<React.JSX.Element> {
  const { curriculum, level, subject, chapter, topic, resource } = await params;
  const page = await getResource(curriculum, level, subject, chapter, topic, resource);
  if (!page) {
    // A renamed resource answers its old URL with a permanent redirect to the new one.
    const moved = await resolveRedirect(
      url.resource(curriculum, level, subject, chapter, topic, resource),
    );
    if (moved) permanentRedirect(moved);
    notFound();
  }

  // `resource_viewed` is the Phase 1 proof of the `usage_events` path
  // (`MVP_ROADMAP.md` §4.6). It runs after the response is sent, is skipped during a
  // static build (there is no reader to record), and never fails the page: a missing
  // analytics row must not cost a student the material they came for (API-13).
  if (process.env.NEXT_PHASE !== "phase-production-build") {
    after(async () => {
      try {
        await recordEvent({
          name: "resource_viewed",
          entityType: "learning_resource",
          entityId: page.resource.id,
          props: {
            resourceId: page.resource.id,
            topicId: page.topic.id,
            // A closed-vocabulary prop (`OBSERVABILITY_AND_ANALYTICS.md` §6.1 rule 4):
            // nothing derives `lesson_with_practice` until Phase 3 links an assessment.
            format: "study_material",
          },
        });
      } catch (error) {
        console.error(
          JSON.stringify({ level: "error", event: "analytics_record_failed", error: String(error) }),
        );
      }
    });
  }

  const topicHref = url.topic(
    page.context.curriculum.slug,
    page.context.level.slug,
    page.context.subject.slug,
    page.chapter.slug,
    page.topic.slug,
  );

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
        <article className="mx-auto w-full max-w-[760px] px-[var(--gutter)] py-12 md:py-16">
          <Breadcrumbs items={trail} />

          <header className="mt-6 border-b border-line-strong pb-8">
            <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] text-balance md:text-4xl">
              {page.resource.title}
            </h1>
            {page.resource.subtitle ? (
              <p className="mt-3 text-lg text-ink-2">{page.resource.subtitle}</p>
            ) : null}
            <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
              <span>{page.resource.readingMinutes} min read</span>
              <span aria-hidden="true">·</span>
              <span>{DIFFICULTY_LABEL[page.resource.difficulty] ?? "Medium"}</span>
              <span aria-hidden="true">·</span>
              <span>
                {page.context.subject.name} · {page.chapter.title}
              </span>
            </p>
          </header>

          <div className="mt-10">
            {page.blocks.length > 0 ? (
              <BlockRenderer blocks={page.blocks} media={page.media} />
            ) : (
              <p className="text-ink-2">This resource has no published content yet.</p>
            )}
          </div>

          <footer className="mt-16 border-t border-line pt-6">
            <Link href={topicHref} className="text-sm font-medium text-ink-2 hover:text-ink">
              ← Back to {page.topic.title}
            </Link>
          </footer>
        </article>
      </main>

      <SiteFooter />

      <JsonLd data={pageGraph([
      breadcrumbList(trail),
      learningResource({
        name: page.resource.title,
        description:
          page.resource.summary ??
          page.resource.subtitle ??
          `${page.resource.title}, study material for ${page.topic.title}.`,
        learningResourceType: "article",
        educationalLevel: page.context.level.name,
        teaches: page.topic.title,
        isPartOf: {
          name: page.context.subject.name,
          path: url.subject(
            page.context.curriculum.slug,
            page.context.level.slug,
            page.context.subject.slug,
          ),
        },
        readingMinutes: page.resource.readingMinutes,
        path: url.resource(
          curriculum,
          level,
          subject,
          chapter,
          topic,
          resource,
        ),
      }),
    ])} />
    </>
  );
}
