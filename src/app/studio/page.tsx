/**
 * Studio overview (`INFORMATION_ARCHITECTURE.md` §4.3): the taxonomy tree with the state of
 * each level and how many subjects hang off it. Counts and gaps come later; this is the
 * screen that proves the shell and the read services agree.
 */
import Link from "next/link";

import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listCurriculumTree, listSubjectsAdmin } from "@/lib/services/taxonomy-admin";

export default async function StudioOverviewPage(): Promise<React.JSX.Element> {
  const { data: curricula } = await listCurriculumTree();

  const subjectCounts = new Map<string, number>();
  await Promise.all(
    curricula.flatMap((curriculum) =>
      curriculum.levels.map(async (level) => {
        const { data } = await listSubjectsAdmin({ levelId: level.id, limit: 50 });
        subjectCounts.set(level.id, data.length);
      }),
    ),
  );

  return (
    <>
      <header className="max-w-[62ch]">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Studio</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em]">Overview</h1>
        <p className="mt-3 text-ink-2">
          Every curriculum, level and the subjects filed under them, drafts included.
        </p>
      </header>

      {curricula.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No curricula yet"
          description="A curriculum is the top of the taxonomy. Everything an author writes is filed beneath one."
        />
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          {curricula.map((curriculum) => (
            <section
              key={curriculum.id}
              aria-labelledby={`curriculum-${curriculum.id}`}
              className="overflow-hidden rounded-md border border-line bg-paper-raised shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
                <h2
                  id={`curriculum-${curriculum.id}`}
                  className="font-display text-xl font-semibold tracking-[-0.015em]"
                >
                  <Link
                    href={`/studio/curricula/${curriculum.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {curriculum.name}
                  </Link>
                </h2>
                <ContentStatusBadge status={curriculum.status} />
                <span className="ml-auto text-sm text-ink-3">{curriculum.shortName}</span>
              </div>

              {curriculum.levels.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-3">No levels in this curriculum yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {curriculum.levels.map((level) => {
                    const count = subjectCounts.get(level.id) ?? 0;
                    return (
                      <li key={level.id}>
                        <Link
                          href={`/studio/levels/${level.id}`}
                          className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-paper"
                        >
                          <span className="font-medium text-ink">{level.name}</span>
                          <ContentStatusBadge status={level.status} />
                          <span className="ml-auto text-sm text-ink-2">
                            {count} {count === 1 ? "subject" : "subjects"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
