/**
 * Studio curriculum detail (`INFORMATION_ARCHITECTURE.md` §4.3): the curriculum's own edit
 * form and the levels filed under it, each opening on its subject list.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { Disclosure } from "@/components/motion/disclosure";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { CurriculumForm } from "@/components/studio/curriculum-form";
import { LevelForm } from "@/components/studio/level-form";
import { TransitionControls } from "@/components/studio/transition-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActor } from "@/lib/auth/actor";
import { can } from "@/lib/rbac";
import { findCurriculum, listLevelsByCurriculum } from "@/lib/services/taxonomy-admin";

export const metadata = { title: "Curriculum" };

export default async function StudioCurriculumPage({
  params,
}: {
  params: Promise<{ curriculumId: string }>;
}): Promise<React.JSX.Element> {
  const { curriculumId } = await params;
  const curriculum = await findCurriculum(curriculumId);
  if (!curriculum) notFound();

  const [levels, actor] = await Promise.all([listLevelsByCurriculum(curriculumId), requireActor()]);
  const mayWrite = can(actor, "taxonomy:write");

  return (
    <>
      <Link
        href="/studio"
        className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        ← Overview
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{curriculum.name}</h1>
        <ContentStatusBadge status={curriculum.status} />
        <span className="text-sm text-ink-3">{curriculum.slug}</span>
        <span className="text-sm text-ink-3">{curriculum.shortName}</span>
      </header>
      {curriculum.descriptionMd ? (
        <p className="mt-3 max-w-[62ch] whitespace-pre-line text-ink-2">{curriculum.descriptionMd}</p>
      ) : null}

      <div className="mt-5">
        <TransitionControls
          entity="curricula"
          id={curriculum.id}
          status={curriculum.status}
          role={actor.role}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2 border-b border-line-strong pb-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">Levels</h2>
        <p className="text-sm text-ink-3">
          {levels.length} {levels.length === 1 ? "level" : "levels"}
        </p>
      </div>

      {levels.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No levels yet"
          description="A level groups the subjects one stage of the curriculum covers."
        />
      ) : (
        <ol className="mt-6 flex flex-col gap-3">
          {levels.map((level) => (
            <li key={level.id}>
              <Link
                href={`/studio/levels/${level.id}`}
                className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-paper-raised px-5 py-4 shadow-sm transition-[border-color,box-shadow] duration-[180ms] hover:border-line-strong hover:shadow-md"
              >
                <span className="text-sm tabular-nums text-ink-3">{level.position}</span>
                <span className="font-medium text-ink">{level.name}</span>
                <ContentStatusBadge status={level.status} />
                <span className="ml-auto text-xs text-ink-3">{level.slug}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {mayWrite ? (
        <>
          <Disclosure label="Edit curriculum" className="mt-10">
            <CurriculumForm curriculum={curriculum} />
          </Disclosure>

          <Disclosure label="New level" className="mt-4">
            <LevelForm curriculumId={curriculum.id} />
          </Disclosure>
        </>
      ) : null}
    </>
  );
}
