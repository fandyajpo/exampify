/**
 * Studio level detail (`INFORMATION_ARCHITECTURE.md` §4.3): the level's edit form, the
 * subjects filed under it and the form that adds one.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { Disclosure } from "@/components/motion/disclosure";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { LevelForm } from "@/components/studio/level-form";
import { SubjectForm } from "@/components/studio/subject-form";
import { TransitionControls } from "@/components/studio/transition-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActor } from "@/lib/auth/actor";
import { can } from "@/lib/rbac";
import {
  findCurriculum,
  findLevel,
  listSubjectGroups,
  listSubjectsAdmin,
} from "@/lib/services/taxonomy-admin";

export const metadata = { title: "Level" };

export default async function StudioLevelPage({
  params,
}: {
  params: Promise<{ levelId: string }>;
}): Promise<React.JSX.Element> {
  const { levelId } = await params;
  const level = await findLevel(levelId);
  if (!level) notFound();

  const [curriculum, { data: subjects }, groups, actor] = await Promise.all([
    findCurriculum(level.curriculumId),
    listSubjectsAdmin({ levelId, limit: 50 }),
    listSubjectGroups(),
    requireActor(),
  ]);
  const mayWrite = can(actor, "taxonomy:write");

  return (
    <>
      <Link
        href={`/studio/curricula/${level.curriculumId}`}
        className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        ← {curriculum?.name ?? "Curriculum"}
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{level.name}</h1>
        <ContentStatusBadge status={level.status} />
        <span className="text-sm text-ink-3">{level.slug}</span>
      </header>
      {level.descriptionMd ? (
        <p className="mt-3 max-w-[62ch] whitespace-pre-line text-ink-2">{level.descriptionMd}</p>
      ) : null}

      <div className="mt-5">
        <TransitionControls entity="levels" id={level.id} status={level.status} role={actor.role} />
      </div>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2 border-b border-line-strong pb-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">Subjects</h2>
        <Link href={`/studio/subjects?levelId=${level.id}`} className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          Open in subject table
        </Link>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No subjects yet"
          description="A subject is where chapters and topics begin. File the first one under this level."
        />
      ) : (
        <ol className="mt-6 flex flex-col gap-3">
          {subjects.map((subject) => (
            <li key={subject.id}>
              <Link
                href={`/studio/subjects/${subject.id}`}
                className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-paper-raised px-5 py-4 shadow-sm transition-[border-color,box-shadow] duration-[180ms] hover:border-line-strong hover:shadow-md"
              >
                <span className="text-sm tabular-nums text-ink-3">{subject.position}</span>
                <span className="font-medium text-ink">{subject.name}</span>
                <ContentStatusBadge status={subject.status} />
                <span className="ml-auto text-xs text-ink-3">{subject.slug}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {mayWrite ? (
        <>
          <Disclosure label="Edit level" className="mt-10">
            <LevelForm level={level} />
          </Disclosure>

          <Disclosure label="New subject" className="mt-4">
            <SubjectForm levelId={level.id} groups={groups} />
          </Disclosure>
        </>
      ) : null}
    </>
  );
}
