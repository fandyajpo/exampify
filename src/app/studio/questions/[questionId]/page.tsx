/**
 * Studio question editor (`API_CONTRACTS.md` §7.4, `QUESTION_ENGINE.md` §3): the stem,
 * options, answer key, feedback, explanation and cross-listings, plus the lifecycle controls
 * and the publish dry run.
 *
 * The primary topic is fixed here; moving a question to another primary topic would be a new
 * question, and the schema has no endpoint for it.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { QuestionEditor } from "@/components/studio/question-editor";
import { TransitionControls } from "@/components/studio/transition-controls";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/lib/auth/actor";
import { getQuestionAdmin } from "@/lib/services/questions-admin";
import { listTopicsAdmin, findTopic } from "@/lib/services/taxonomy-admin";
import { duplicateQuestionAction } from "@/lib/studio/actions";

export const metadata = { title: "Question" };

export default async function StudioQuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}): Promise<React.JSX.Element> {
  const { questionId } = await params;
  const question = await getQuestionAdmin(questionId);
  if (!question) notFound();

  const [actor, { data: topics }, primaryTopic] = await Promise.all([
    requireActor(),
    listTopicsAdmin({}),
    findTopic(question.topicId),
  ]);

  const chapter = primaryTopic?.chapterId ?? "";

  return (
    <>
      <Link
        href={`/studio/questions?topicId=${question.topicId}`}
        className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        ← Questions in this topic
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Question</h1>
        <ContentStatusBadge status={question.status} />
        <span className="text-sm text-ink-3">{question.points} pt</span>
        <span className="text-sm text-ink-3">
          {primaryTopic ? primaryTopic.title : question.topicId}
        </span>
        {chapter ? (
          <Link
            href={`/studio/chapters/${chapter}`}
            className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Chapter
          </Link>
        ) : null}
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <TransitionControls entity="questions" id={question.id} status={question.status} role={actor.role} />
        <form action={duplicateQuestionAction}>
          <input type="hidden" name="id" value={question.id} />
          <Button type="submit" variant="secondary" size="sm">
            Duplicate
          </Button>
        </form>
      </div>

      <div className="mt-8">
        <QuestionEditor
          question={question}
          topics={topics.map((topic) => ({ id: topic.id, title: topic.title }))}
        />
      </div>
    </>
  );
}
