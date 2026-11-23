/**
 * Public homepage (IA §4.1, UI_UX_GUIDELINES.md §3.1, FR-DISC-01): value proposition,
 * curriculum/level picker, popular subjects, how it works, subject-group browse and search
 * entry points.
 *
 * Placeholder subject rows stand in for `GET /subjects` until `lib/db` is wired; the hrefs
 * are the canonical IA routes. Their counts are deliberately absent rather than invented.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { HeroIllustration } from "@/components/patterns/hero-illustration";
import { SubjectCard } from "@/components/patterns/subject-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";
import { ChipLink } from "@/components/ui/chip-link";
import { IconArrowRight, IconBookOpen, IconSearch } from "@/components/ui/icons";
import { JsonLd } from "@/components/seo/json-ld";
import { siteGraph } from "@/lib/seo/jsonld";
import { buildMetadata, titles } from "@/lib/seo/metadata";
import { listPopularSubjects } from "@/lib/services/taxonomy";

// Seeded content changes on publish, not per request; ISR keeps the page static between
// rebuilds (TECHNICAL_STANDARDS.md §15, cache tags land with the studio in Phase 2).
export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: titles.home(),
  description:
    "Syllabus-shaped study notes, lessons and practice tests for IGCSE and AS & A Level, organised by chapter and topic so you know exactly what to study next.",
  path: "/",
});

const CURRICULUM = "cambridge-international";

const LEVELS = [
  { href: `/${CURRICULUM}/igcse`, label: "Cambridge International · IGCSE" },
  { href: `/${CURRICULUM}/as-and-a-level`, label: "Cambridge International · AS & A Level" },
] as const;

const SUBJECT_GROUPS = [
  { href: "/subjects?group=science", label: "Science" },
  { href: "/subjects?group=mathematics", label: "Mathematics" },
] as const;

const STEPS = [
  {
    number: "01",
    title: "Read",
    body: "Study material and lessons are complete on their own. A topic with no practice set is still a finished page.",
  },
  {
    number: "02",
    title: "Practise",
    body: "Lessons carry their own practice set, and standalone tests run to exam time. Every question has an explanation.",
  },
  {
    number: "03",
    title: "Fix",
    body: "Per-topic accuracy lists your weakest topics first, so the next session starts with a target rather than a guess.",
  },
] as const;

export default async function HomePage(): Promise<React.JSX.Element> {
  const popularSubjects = await listPopularSubjects(3);

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-sm bg-paper-raised px-4 py-3 font-medium shadow-md focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="border-b border-line-strong bg-paper-accent">
          <div className="mx-auto grid w-full max-w-[1240px] items-center gap-12 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-24">
            <div className="lg:col-span-7">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
                Study material · Lessons · Practice tests
              </p>
              <h1 className="mt-4 max-w-[18ch] font-display text-4xl font-semibold tracking-[-0.03em] text-balance md:text-5xl">
                Know exactly what to study next.
              </h1>
              <Reveal delay={0.06}>
                <p className="mt-5 max-w-[36ch] font-editorial text-2xl leading-[1.35] text-ink-2 md:text-3xl">
                  Syllabus-shaped notes, lessons and practice tests you can read end to end before
                  you decide to test yourself.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href="/subjects" size="lg">
                    Find your course
                    <IconArrowRight className="size-5" />
                  </ButtonLink>
                  <ButtonLink href="/search" variant="secondary" size="lg">
                    <IconSearch className="size-5" />
                    Search
                  </ButtonLink>
                </div>

                <div className="mt-10 border-t border-line-strong pt-6">
                  <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
                    Jump to your level
                  </h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {LEVELS.map((level) => (
                      <li key={level.href}>
                        <ChipLink href={level.href}>{level.label}</ChipLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.12} className="lg:col-span-5">
              <HeroIllustration />
            </Reveal>
          </div>
        </section>

        {/* Popular subjects */}
        <section aria-labelledby="popular-subjects" className="bg-paper">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-14 md:px-6 md:py-20 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2
                  id="popular-subjects"
                  className="font-display text-2xl font-semibold tracking-[-0.015em]"
                >
                  Popular subjects
                </h2>
                <p className="mt-2 max-w-[60ch] text-ink-2">
                  Every subject opens on a chapter list you can read without an account.
                </p>
              </div>
              <Link
                href="/subjects"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
              >
                All subjects
                <IconArrowRight className="size-4" />
              </Link>
            </div>

            {popularSubjects.length > 0 ? (
              <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {popularSubjects.map((subject) => (
                  <li key={subject.href}>
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
            ) : (
              <p className="mt-10 text-ink-2">
                No subjects are published yet. Seed the database with `bun run db:seed`.
              </p>
            )}
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-it-works" className="border-y border-line bg-paper-sunk">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-14 md:px-6 md:py-20 lg:px-8">
            <h2 id="how-it-works" className="font-display text-2xl font-semibold tracking-[-0.015em]">
              Read, practise, then fix what is weak
            </h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
              {STEPS.map((step) => (
                <li key={step.number} className="border-t border-line-strong pt-5">
                  <p className="font-mono text-xs text-ink-3">{step.number}</p>
                  <h3 className="mt-2 font-display text-lg font-semibold tracking-[-0.01em]">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[46ch] text-base text-ink-2">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Browse by subject group */}
        <section aria-labelledby="browse-by-group" className="bg-paper">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-14 md:px-6 md:py-20 lg:px-8">
            <h2
              id="browse-by-group"
              className="font-display text-2xl font-semibold tracking-[-0.015em]"
            >
              Browse by subject group
            </h2>
            <p className="mt-2 max-w-[60ch] text-ink-2">
              Filter the directory by the part of the catalogue you are revising.
            </p>
            <ul className="mt-6 flex flex-wrap gap-3">
              {SUBJECT_GROUPS.map((group) => (
                <li key={group.href}>
                  <ChipLink href={group.href}>{group.label}</ChipLink>
                </li>
              ))}
              <li>
                <ChipLink href="/subjects">
                  <IconBookOpen className="size-4" />
                  All subjects
                </ChipLink>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />

      <JsonLd data={siteGraph()} />
    </>
  );
}
