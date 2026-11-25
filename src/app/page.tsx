/**
 * Public homepage (IA §4.1, UI_UX_GUIDELINES.md §3.1, FR-DISC-01): value proposition,
 * curriculum/level picker, popular subjects, how it works, subject-group browse and search
 * entry points.
 *
 * The hero is the one place on the site with this much air: a centred headline, one lead
 * paragraph and two actions, then the illustration. Everything below it returns to the
 * editorial rhythm of the rest of the product.
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
      <SiteHeader />

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="bg-paper-raised">
          <div className="shell pt-16 pb-14 text-center md:pt-24 md:pb-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-paper-sunk px-3.5 py-1.5 text-xs font-medium text-ink-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-cobalt" />
              Study material · Lessons · Practice tests
            </p>

            <h1 className="mx-auto mt-6 max-w-[16ch] text-balance font-display text-5xl font-semibold text-ink">
              Know exactly what to study next.
            </h1>

            <Reveal delay={0.06}>
              <p className="mx-auto mt-6 max-w-[44ch] text-balance font-editorial text-2xl leading-[1.35] text-ink-2 md:text-3xl">
                Syllabus-shaped notes, lessons and practice tests you can read end to end before
                you decide to test yourself.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/subjects" size="lg">
                  Find your course
                  <IconArrowRight className="size-5" />
                </ButtonLink>
                <ButtonLink href="/search" variant="secondary" size="lg">
                  <IconSearch className="size-5" />
                  Search
                </ButtonLink>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="mx-auto mt-12 max-w-[720px]">
                <h2 className="text-xs font-semibold text-ink-3">Jump to your level</h2>
                <ul className="mt-3 flex flex-wrap justify-center gap-2">
                  {LEVELS.map((level) => (
                    <li key={level.href}>
                      <ChipLink href={level.href}>{level.label}</ChipLink>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mx-auto mt-14 max-w-[440px]">
                <HeroIllustration />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Popular subjects */}
        <section aria-labelledby="popular-subjects" className="bg-paper">
          <div className="shell section-y">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="popular-subjects" className="font-display text-3xl font-semibold text-ink">
                  Popular subjects
                </h2>
                <p className="mt-2 max-w-[60ch] text-ink-2">
                  Every subject opens on a chapter list you can read without an account.
                </p>
              </div>
              <Link
                href="/subjects"
                className="inline-flex min-h-11 items-center gap-1 rounded-full text-sm font-medium text-cobalt transition-colors hover:text-ink"
              >
                All subjects
                <IconArrowRight className="size-4" />
              </Link>
            </div>

            {popularSubjects.length > 0 ? (
              <ul className="card-grid mt-10">
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
        <section aria-labelledby="how-it-works" className="bg-paper-sunk">
          <div className="shell section-y">
            <h2 id="how-it-works" className="font-display text-3xl font-semibold text-ink">
              Read, practise, then fix what is weak
            </h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <li
                  key={step.number}
                  className="rounded-lg border border-line bg-paper-raised p-6 shadow-sm"
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-paper-sunk font-mono text-xs text-ink-3">
                    {step.number}
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 max-w-[46ch] text-base text-ink-2">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Browse by subject group */}
        <section aria-labelledby="browse-by-group" className="bg-paper">
          <div className="shell section-y">
            <h2 id="browse-by-group" className="font-display text-3xl font-semibold text-ink">
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
