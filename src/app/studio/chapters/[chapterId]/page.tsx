/**
 * Studio chapter detail (`INFORMATION_ARCHITECTURE.md` §4.3): the topics in one chapter, in
 * `position` order, plus the chapter's own edit form and the create for a new topic.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { Disclosure } from "@/components/motion/disclosure";
import { ChapterForm } from "@/components/studio/chapter-form";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { TopicForm } from "@/components/studio/topic-form";
import { TransitionControls } from "@/components/studio/transition-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActor } from "@/lib/auth/actor";
import { findChapter, listTopicsAdmin } from "@/lib/services/taxonomy-admin";

export const metadata = { title: "Chapter" };

export default async function StudioChapterPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}): Promise<React.JSX.Element> {
  const { chapterId } = await params;
  const chapter = await findChapter(chapterId);
  if (!chapter) notFound();

  const { data: topics } = await listTopicsAdmin({ chapterId });
  const actor = await requireActor();

  return (
    <>
      <Link
        href={`/studio/subjects/${chapter.subjectId}`}
        className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        ← Chapters
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
          {chapter.title}
        </h1>
        <ContentStatusBadge status={chapter.status} />
        <span className="text-sm text-ink-3">{chapter.slug}</span>
      </header>
      {chapter.summary ? (
        <p className="mt-3 max-w-[62ch] text-ink-2">{chapter.summary}</p>
      ) : null}

      <div className="mt-5">
        <TransitionControls
          entity="chapters"
          id={chapter.id}
          status={chapter.status}
          role={actor.role}
        />
      </div>

      <Disclosure label="Edit chapter" className="mt-6">
        <ChapterForm chapter={chapter} />
      </Disclosure>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2 border-b border-line-strong pb-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">
          Topics
        </h2>
        <p className="text-sm text-ink-3">
          {topics.length} {topics.length === 1 ? "topic" : "topics"}
        </p>
      </div>

      {topics.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No topics yet"
          description="A topic is where a study resource lives. Add the first one and it will be ordered here."
        />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line bg-paper-raised shadow-sm">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Topics with their status, position and length
            </caption>
            <thead>
              <tr className="border-b border-line-strong text-left text-xs uppercase tracking-[0.1em] text-ink-3">
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  #
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Topic
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Minutes
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Objectives
                </th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.id}>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-3">
                    {topic.position}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/studio/topics/${topic.id}`}
                      className="font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {topic.title}
                    </Link>
                    <p className="text-xs text-ink-3">{topic.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ContentStatusBadge status={topic.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                    {topic.estimatedMinutes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                    {topic.learningObjectives.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Disclosure label="New topic" className="mt-10">
        <TopicForm chapterId={chapter.id} />
      </Disclosure>
    </>
  );
}
