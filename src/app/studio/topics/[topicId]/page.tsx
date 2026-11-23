/**
 * Studio topic detail (`INFORMATION_ARCHITECTURE.md` §4.3): the topic's objectives and its
 * edit form. Resources and assessments land here once their routes exist.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { Disclosure } from "@/components/motion/disclosure";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { ResourceForm } from "@/components/studio/resource-form";
import { TopicForm } from "@/components/studio/topic-form";
import { TransitionControls } from "@/components/studio/transition-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActor } from "@/lib/auth/actor";
import { listResourcesAdmin } from "@/lib/services/resources-admin";
import { findTopic } from "@/lib/services/taxonomy-admin";

export const metadata = { title: "Topic" };

export default async function StudioTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}): Promise<React.JSX.Element> {
  const { topicId } = await params;
  const topic = await findTopic(topicId);
  if (!topic) notFound();
  const [actor, resources] = await Promise.all([requireActor(), listResourcesAdmin(topicId)]);

  return (
    <>
      <Link
        href={`/studio/chapters/${topic.chapterId}`}
        className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        ← Topics
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{topic.title}</h1>
        <ContentStatusBadge status={topic.status} />
        <span className="text-sm text-ink-3">{topic.slug}</span>
        {topic.estimatedMinutes ? (
          <span className="text-sm text-ink-3">{topic.estimatedMinutes} min</span>
        ) : null}
      </header>
      {topic.summary ? <p className="mt-3 max-w-[62ch] text-ink-2">{topic.summary}</p> : null}

      <div className="mt-5">
        <TransitionControls entity="topics" id={topic.id} status={topic.status} role={actor.role} />
      </div>

      <section className="mt-8" aria-labelledby="objectives">
        <h2 id="objectives" className="font-display text-xl font-semibold tracking-[-0.015em]">
          Learning objectives
        </h2>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-ink-2 marker:text-ink-3">
          {topic.learningObjectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-2 border-b border-line-strong pb-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">Resources</h2>
        <p className="text-sm text-ink-3">
          {resources.length} {resources.length === 1 ? "resource" : "resources"}
        </p>
      </div>

      {resources.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No resources yet"
          description="A topic with only an assessment is legitimate, but a lesson needs a resource to read."
        />
      ) : (
        <ol className="mt-6 flex flex-col gap-3">
          {resources.map((resource) => (
            <li key={resource.id}>
              <Link
                href={`/studio/resources/${resource.id}`}
                className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-paper-raised px-5 py-4 shadow-sm transition-[border-color,box-shadow] duration-[180ms] hover:border-line-strong hover:shadow-md"
              >
                <span className="text-sm tabular-nums text-ink-3">{resource.position}</span>
                <span className="font-medium text-ink">{resource.title}</span>
                <ContentStatusBadge status={resource.status} />
                <span className="ml-auto text-xs text-ink-3">
                  {resource.readingMinutes} min · {resource.format.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <Disclosure label="New resource" className="mt-8">
        <ResourceForm topicId={topic.id} />
      </Disclosure>

      <Disclosure label="Edit topic" className="mt-10">
        <TopicForm topic={topic} />
      </Disclosure>
    </>
  );
}
