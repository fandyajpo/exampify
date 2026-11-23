/**
 * Studio subject detail (`INFORMATION_ARCHITECTURE.md` §4.3): the chapters in one subject,
 * in `position` order, each opening on its topic list.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { Disclosure } from "@/components/motion/disclosure";
import { ChapterForm } from "@/components/studio/chapter-form";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { SubjectForm } from "@/components/studio/subject-form";
import { TransitionControls } from "@/components/studio/transition-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActor } from "@/lib/auth/actor";
import { can } from "@/lib/rbac";
import { findSubject, listChaptersAdmin } from "@/lib/services/taxonomy-admin";

export const metadata = { title: "Subject" };

export default async function StudioSubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}): Promise<React.JSX.Element> {
  const { subjectId } = await params;
  const subject = await findSubject(subjectId);
  if (!subject) notFound();

  const { data: chapters } = await listChaptersAdmin({ subjectId });
  const actor = await requireActor();

  return (
    <>
      <Link
        href="/studio/subjects"
        className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        ← Subjects
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{subject.name}</h1>
        <ContentStatusBadge status={subject.status} />
        <span className="text-sm text-ink-3">{subject.slug}</span>
      </header>
      {subject.summary ? <p className="mt-3 max-w-[62ch] text-ink-2">{subject.summary}</p> : null}

      <div className="mt-5">
        <TransitionControls entity="subjects" id={subject.id} status={subject.status} role={actor.role} />
      </div>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2 border-b border-line-strong pb-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">Chapters</h2>
        <p className="text-sm text-ink-3">
          {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
        </p>
      </div>

      {chapters.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No chapters yet"
          description="Chapters are the next level down. Each one groups the topics a reader moves through."
        />
      ) : (
        <ol className="mt-6 flex flex-col gap-3">
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <Link
                href={`/studio/chapters/${chapter.id}`}
                className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-paper-raised px-5 py-4 shadow-sm transition-[border-color,box-shadow] duration-[180ms] hover:border-line-strong hover:shadow-md"
              >
                <span className="text-sm tabular-nums text-ink-3">{chapter.position}</span>
                <span className="font-medium text-ink">{chapter.title}</span>
                <ContentStatusBadge status={chapter.status} />
                <span className="ml-auto text-xs text-ink-3">{chapter.slug}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {can(actor, "taxonomy:write") ? (
        <Disclosure label="Edit subject" className="mt-10">
          <SubjectForm subject={subject} />
        </Disclosure>
      ) : null}

      <Disclosure label="New chapter" className="mt-4">
        <ChapterForm subjectId={subject.id} />
      </Disclosure>
    </>
  );
}
