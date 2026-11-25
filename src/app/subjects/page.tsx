/**
 * Subject directory (`INFORMATION_ARCHITECTURE.md` §4, `FR-DISC-02`): every published
 * subject, grouped by education level, reading through `lib/services/taxonomy`.
 */
import type { Metadata } from "next";
import { SubjectCard } from "@/components/patterns/subject-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buildMetadata, titles } from "@/lib/seo/metadata";
import { listSubjectsByLevel } from "@/lib/services/taxonomy";

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: titles.subjects(),
  description:
    "Browse every published subject by curriculum and level, then open a chapter list to see the topics inside. Study material, lessons and practice tests in one place.",
  path: "/subjects",
});

export default async function SubjectsPage(): Promise<React.JSX.Element> {
  const levels = await listSubjectsByLevel();
  const total = levels.reduce((count, level) => count + level.subjects.length, 0);

  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="bg-paper-raised">
          <div className="shell py-14 md:py-20">
            <p className="text-xs font-semibold text-ink-3">Catalogue</p>
            <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Subjects</h1>
            <p className="mt-4 max-w-[60ch] font-editorial text-2xl leading-[1.35] text-ink-2">
              {total > 0
                ? `${total} published ${total === 1 ? "subject" : "subjects"}, each opening on a chapter list you can read without an account.`
                : "No subjects are published yet."}
            </p>
          </div>
        </section>

        <div className="shell section-y">
          {levels.map((level) => (
            <section key={level.levelSlug} aria-labelledby={`level-${level.levelSlug}`} className="mb-16 last:mb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
                <h2
                  id={`level-${level.levelSlug}`}
                  className="font-display text-2xl font-semibold text-ink"
                >
                  {level.curriculumName} · {level.levelName}
                </h2>
                <p className="text-sm text-ink-3">
                  {level.subjects.length} {level.subjects.length === 1 ? "subject" : "subjects"}
                </p>
              </div>

              {level.subjects.length > 0 ? (
                <ul className="card-grid mt-8">
                  {level.subjects.map((subject) => (
                    <li key={subject.id}>
                      <SubjectCard
                        href={subject.href}
                        name={subject.name}
                        level={level.levelName}
                        group={subject.groupName}
                        color={subject.color}
                        iconKey={subject.iconKey}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 text-ink-2">
                  Nothing is published for this level yet.
                </p>
              )}
            </section>
          ))}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
