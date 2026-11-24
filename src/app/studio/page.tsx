/**
 * Studio overview (`INFORMATION_ARCHITECTURE.md` §4.3, `API_CONTRACTS.md` §7.7): counts,
 * the content-gap report and recent edits, above the taxonomy tree the screen started with.
 *
 * Gaps are informational, not errors: a topic may publish with a resource or an assessment,
 * so either missing side is a valid shape and the panel links to the topic to fill it in.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getActor } from "@/lib/auth/actor";
import { formatUtcDateTime } from "@/lib/format/datetime";
import { can } from "@/lib/rbac";
import { getStudioOverview } from "@/lib/services/overview";
import { listCurriculumTree, listSubjectsAdmin } from "@/lib/services/taxonomy-admin";
import type { StudioOverview, TopicGap } from "@/lib/validation/overview";

export const metadata = { title: "Overview" };

/** Gap panels preview the worst offenders; the heading carries the real total. */
const GAP_PREVIEW = 10;

const COUNT_FIELDS: { key: keyof StudioOverview["counts"]; label: string }[] = [
  { key: "curricula", label: "Curricula" },
  { key: "levels", label: "Levels" },
  { key: "subjects", label: "Subjects" },
  { key: "chapters", label: "Chapters" },
  { key: "topics", label: "Topics" },
  { key: "resources", label: "Resources" },
  { key: "assessments", label: "Assessments" },
];

function GapPanel({
  id,
  title,
  description,
  empty,
  topics,
}: {
  id: string;
  title: string;
  description: string;
  empty: string;
  topics: TopicGap[];
}): React.JSX.Element {
  const shown = topics.slice(0, GAP_PREVIEW);

  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-md border border-line bg-paper-raised shadow-sm"
    >
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id={id} className="font-display text-lg font-semibold tracking-[-0.015em]">
            {title}
          </h3>
          <span className="text-sm tabular-nums text-ink-2">
            {topics.length} {topics.length === 1 ? "topic" : "topics"}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-3">{description}</p>
      </div>

      {topics.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((topic) => (
            <li key={topic.id}>
              <Link
                href={`/studio/topics/${topic.id}`}
                className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-paper"
              >
                <span className="font-medium text-ink">{topic.title}</span>
                <ContentStatusBadge status={topic.status} />
                <span className="ml-auto text-xs text-ink-3">Open topic →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {topics.length > shown.length ? (
        <p className="border-t border-line px-5 py-3 text-sm text-ink-3">
          and {topics.length - shown.length} more
        </p>
      ) : null}
    </section>
  );
}

export default async function StudioOverviewPage(): Promise<React.JSX.Element> {
  const actor = await getActor();
  if (!actor) notFound();

  const [{ counts, gaps, recentEdits }, { data: curricula }] = await Promise.all([
    getStudioOverview(actor),
    listCurriculumTree(),
  ]);

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
          Counts, content gaps and the latest changes, then every curriculum, level and the
          subjects filed under them, drafts included.
        </p>
      </header>

      <section aria-labelledby="counts" className="mt-8">
        <h2 id="counts" className="sr-only">
          Content counts
        </h2>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-3">
          {COUNT_FIELDS.map((field) => (
            <div
              key={field.key}
              className="rounded-md border border-line bg-paper-raised px-4 py-3"
            >
              <dt className="text-xs uppercase tracking-[0.1em] text-ink-3">{field.label}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">
                {counts[field.key]}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <h2 className="mt-10 font-display text-xl font-semibold tracking-[-0.015em]">
        Content gaps
      </h2>
      <p className="mt-1 max-w-[62ch] text-sm text-ink-3">
        Live topics only — draft, in review and published. Archived topics are left out.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <GapPanel
          id="gap-resource"
          title="No learning resource"
          description="A topic with only an assessment. Valid, but a reader has nothing to study."
          empty="Every live topic has a learning resource."
          topics={gaps.withoutResource}
        />
        <GapPanel
          id="gap-assessment"
          title="No assessment"
          description="A topic with only a resource. Valid: the practice offer is simply absent."
          empty="Every live topic has an assessment."
          topics={gaps.withoutAssessment}
        />
      </div>

      <section
        aria-labelledby="recent-edits"
        className="mt-8 overflow-hidden rounded-md border border-line bg-paper-raised shadow-sm"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h2 id="recent-edits" className="font-display text-lg font-semibold tracking-[-0.015em]">
              Recent edits
            </h2>
            <p className="mt-1 text-sm text-ink-3">
              {can(actor, "audit:read:all")
                ? "The latest changes across the studio, newest first. Times are UTC."
                : "Your latest changes, newest first. Times are UTC."}
            </p>
          </div>
          <Link
            href="/studio/audit"
            className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Audit log →
          </Link>
        </div>

        {recentEdits.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-3">No changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recentEdits.map((edit) => (
              <li
                key={edit.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm"
              >
                <time dateTime={edit.createdAt} className="tabular-nums text-ink-3">
                  {formatUtcDateTime(edit.createdAt)}
                </time>
                <span className="font-mono text-xs text-ink">{edit.action}</span>
                <span className="capitalize text-ink-2">{edit.entityType}</span>
                {edit.entityId ? (
                  <span
                    className="font-mono text-xs text-ink-3"
                    title={edit.entityId}
                  >
                    {edit.entityId.slice(0, 8)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="mt-10 font-display text-xl font-semibold tracking-[-0.015em]">Taxonomy</h2>
      <p className="mt-1 max-w-[62ch] text-sm text-ink-3">
        The subject count on each level is read from the subjects table, so it matches the
        list behind the link.
      </p>

      {curricula.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No curricula yet"
          description="A curriculum is the top of the taxonomy. Everything an author writes is filed beneath one."
        />
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {curricula.map((curriculum) => (
            <section
              key={curriculum.id}
              aria-labelledby={`curriculum-${curriculum.id}`}
              className="overflow-hidden rounded-md border border-line bg-paper-raised shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
                <h3
                  id={`curriculum-${curriculum.id}`}
                  className="font-display text-xl font-semibold tracking-[-0.015em]"
                >
                  <Link
                    href={`/studio/curricula/${curriculum.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {curriculum.name}
                  </Link>
                </h3>
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
