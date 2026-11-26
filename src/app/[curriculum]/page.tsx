/**
 * Curriculum landing (`/[curriculum]`, IA §4.1): the levels in a curriculum and how much
 * is published in each. Reading through `lib/services/content`, published-only.
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
import { getCurriculumDetail, url } from "@/lib/services/content";
import { resolveRedirect } from "@/lib/services/redirects";

export const revalidate = 300;

const getCurriculum = cache(getCurriculumDetail);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ curriculum: string }>;
}): Promise<Metadata> {
  const { curriculum } = await params;
  const detail = await getCurriculum(curriculum);
  if (!detail) return {};

  return buildMetadata({
    title: titles.curriculum(detail.name),
    description: description(
      [detail.description],
      `Study material, lessons and practice for ${detail.name}, organised by level and subject.`,
    ),
    path: url.curriculum(detail.slug),
  });
}

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ curriculum: string }>;
}): Promise<React.JSX.Element> {
  const { curriculum } = await params;
  const detail = await getCurriculum(curriculum);
  if (!detail) {
    // A renamed curriculum keeps its old prefix working (`SEO_AND_CONTENT_STRATEGY.md` §6).
    const moved = await resolveRedirect(url.curriculum(curriculum));
    if (moved) permanentRedirect(moved);
    notFound();
  }

  const trail = breadcrumbTrail({ curriculum: { slug: detail.slug, name: detail.name } });

  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="border-b border-line-strong bg-paper-accent">
          <div className="shell py-12 md:py-16">
            <Breadcrumbs items={trail} />

            <p className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
              Curriculum
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
              {detail.name}
            </h1>
            {detail.description ? (
              <p className="mt-4 max-w-[62ch] font-editorial text-2xl leading-[1.35] text-ink-2">
                {detail.description}
              </p>
            ) : null}
          </div>
        </section>

        <div className="shell section-y">
          <ul className="grid gap-5 sm:grid-cols-2">
            {detail.levels.map((level) => (
              <li key={level.slug}>
                <Link
                  href={url.level(detail.slug, level.slug)}
                  className="group flex h-full flex-col rounded-md border border-line bg-paper-raised p-6 shadow-sm transition-[box-shadow,border-color] duration-[180ms] ease-soft hover:border-line-strong hover:shadow-md"
                >
                  <p className="font-display text-xl font-semibold tracking-[-0.015em] text-ink">
                    {level.name}
                  </p>
                  {level.description ? (
                    <p className="mt-2 text-ink-2">{level.description}</p>
                  ) : null}
                  <p className="mt-4 text-sm text-ink-3">
                    {level.subjectCount} {level.subjectCount === 1 ? "subject" : "subjects"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <SiteFooter />

      <JsonLd data={pageGraph([breadcrumbList(trail)])} />
    </>
  );
}
