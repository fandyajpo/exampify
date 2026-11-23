/**
 * Studio subject table (`INFORMATION_ARCHITECTURE.md` §4.3, `§7.1` list): every subject with
 * its level and status, cursor-paginated so a larger catalogue still works. `?levelId=`
 * narrows it to one level, which the overview links to.
 */
import Link from "next/link";

import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { searchParam, type SearchParams } from "@/lib/search-params";
import { listCurriculumTree, listSubjectsAdmin } from "@/lib/services/taxonomy-admin";

const PAGE_SIZE = 50;

export const metadata = { title: "Subjects" };

function subjectsHref({ levelId, cursor }: { levelId: string; cursor?: string }): string {
  const search = new URLSearchParams();
  if (levelId) search.set("levelId", levelId);
  if (cursor) search.set("cursor", cursor);
  const query = search.toString();
  return query ? `/studio/subjects?${query}` : "/studio/subjects";
}

export default async function StudioSubjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const levelId = searchParam(params, "levelId");
  const cursor = searchParam(params, "cursor");

  const [{ data: curricula }, { data: subjects, pagination }] = await Promise.all([
    listCurriculumTree(),
    listSubjectsAdmin({
      limit: PAGE_SIZE,
      ...(levelId ? { levelId } : {}),
      ...(cursor ? { cursor } : {}),
    }),
  ]);

  const levels = new Map(
    curricula.flatMap((curriculum) =>
      curriculum.levels.map((level) => [level.id, `${curriculum.name} · ${level.name}`] as const),
    ),
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[62ch]">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Taxonomy</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em]">Subjects</h1>
          <p className="mt-3 text-ink-2">
            {levelId && levels.has(levelId)
              ? `Filtered to ${levels.get(levelId)}.`
              : "Every subject in every level, drafts included."}
          </p>
        </div>
        {levelId ? (
          <Link
            href="/studio/subjects"
            className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Show all levels
          </Link>
        ) : null}
      </header>

      {subjects.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No subjects here"
          description="Nothing is filed under this filter yet. Create the first subject from the API and it will appear here."
        />
      ) : (
        <div className="mt-8 overflow-x-auto rounded-md border border-line bg-paper-raised shadow-sm">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Subjects with their level, status and position
            </caption>
            <thead>
              <tr className="border-b border-line-strong text-left text-xs uppercase tracking-[0.1em] text-ink-3">
                <th scope="col" className="px-4 py-3 font-medium">Subject</th>
                <th scope="col" className="px-4 py-3 font-medium">Level</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Position</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/studio/subjects/${subject.id}`}
                      className="font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {subject.name}
                    </Link>
                    <p className="text-xs text-ink-3">{subject.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{levels.get(subject.educationLevelId) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <ContentStatusBadge status={subject.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-2">{subject.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cursor || pagination.nextCursor ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4 text-sm">
          {cursor ? (
            <Link
              href={subjectsHref({ levelId })}
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              ← First page
            </Link>
          ) : (
            <span />
          )}
          {pagination.nextCursor ? (
            <Link
              href={subjectsHref({ levelId, cursor: pagination.nextCursor })}
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              Next page →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
