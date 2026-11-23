/**
 * Level landing (`/[curriculum]/[level]`, IA §4.1): subjects grouped by subject group.
 */
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";

import { notFound } from "next/navigation";
import { cache } from "react";

import { SubjectCard } from "@/components/patterns/subject-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { breadcrumbTrail } from "@/lib/seo/breadcrumbs";
import { breadcrumbList, pageGraph } from "@/lib/seo/jsonld";
import { buildMetadata, description, titles } from "@/lib/seo/metadata";
import { getLevelDetail, url } from "@/lib/services/content";

export const revalidate = 300;

const getLevel = cache(getLevelDetail);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ curriculum: string; level: string }>;
}): Promise<Metadata> {
  const { curriculum, level } = await params;
  const detail = await getLevel(curriculum, level);
  if (!detail) return {};

  return buildMetadata({
    title: titles.level(detail.curriculum.name, detail.level.name),
    description: description(
      [detail.level.description],
      `Every published ${detail.level.name} subject in the ${detail.curriculum.name} catalogue, with chapters, study material and practice.`,
    ),
    path: url.level(detail.curriculum.slug, detail.level.slug),
  });
}

export default async function LevelPage({
  params,
}: {
  params: Promise<{ curriculum: string; level: string }>;
}): Promise<React.JSX.Element> {
  const { curriculum, level } = await params;
  const detail = await getLevel(curriculum, level);
  if (!detail) notFound();

  const trail = breadcrumbTrail({
    curriculum: { slug: detail.curriculum.slug, name: detail.curriculum.name },
    level: detail.level,
  });

  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="border-b border-line-strong bg-paper-accent">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-12 md:px-6 md:py-16 lg:px-8">
            <Breadcrumbs items={trail} />

            <h1 className="mt-6 font-display text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
              {detail.level.name}
            </h1>
            {detail.level.description ? (
              <p className="mt-4 max-w-[62ch] font-editorial text-2xl leading-[1.35] text-ink-2">
                {detail.level.description}
              </p>
            ) : null}
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1240px] px-4 py-14 md:px-6 md:py-20 lg:px-8">
          {detail.groups.length === 0 ? (
            <p className="text-ink-2">No subjects are published for this level yet.</p>
          ) : (
            detail.groups.map((group) => (
              <section
                key={group.slug}
                aria-labelledby={`group-${group.slug}`}
                className="mb-16 last:mb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-strong pb-3">
                  <h2
                    id={`group-${group.slug}`}
                    className="font-display text-2xl font-semibold tracking-[-0.015em]"
                  >
                    {group.name}
                  </h2>
                  <p className="text-sm text-ink-3">{group.subjects.length}</p>
                </div>
                <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.subjects.map((subject) => (
                    <li key={subject.id}>
                      <SubjectCard
                        href={subject.href}
                        name={subject.name}
                        level={subject.levelName}
                        group={subject.groupName}
                        color={subject.color}
                        iconKey={subject.iconKey}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </main>

      <SiteFooter />

      <JsonLd data={pageGraph([breadcrumbList(trail)])} />
    </>
  );
}
