/**
 * Studio assessment composer (`API_CONTRACTS.md` §7.3, `MVP_ROADMAP.md` Phase 3): metadata,
 * ordered items, per-item points override, the live pool counts and the publish dry run.
 *
 * The candidate pool is the assessment's own scope — its topic, or its subject for a
 * course-wide test — so an out-of-scope question is never offered.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssessmentComposer } from "@/components/studio/assessment-composer";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { TransitionControls } from "@/components/studio/transition-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/lib/auth/actor";
import { getAssessmentAdmin, getAssessmentAvailability } from "@/lib/services/assessments-admin";
import { listQuestions } from "@/lib/services/questions-admin";
import { duplicateAssessmentAction } from "@/lib/studio/actions";

const MODE_LABEL = { practice: "Practice", test: "Test", mock: "Mock exam" } as const;

export const metadata = { title: "Assessment" };

export default async function StudioAssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}): Promise<React.JSX.Element> {
  const { assessmentId } = await params;
  const assessment = await getAssessmentAdmin(assessmentId);
  if (!assessment) notFound();

  const [actor, availability, { data: candidates }] = await Promise.all([
    requireActor(),
    getAssessmentAvailability(assessment.id),
    listQuestions({
      limit: 50,
      ...(assessment.topicId ? { topicId: assessment.topicId } : { subjectId: assessment.subjectId }),
    }),
  ]);

  return (
    <>
      <Link
        href={`/studio/assessments?${assessment.topicId ? `topicId=${assessment.topicId}` : `subjectId=${assessment.subjectId}`}`}
        className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        ← Assessments
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{assessment.title}</h1>
        <ContentStatusBadge status={assessment.status} />
        <Badge tone="neutral">{MODE_LABEL[assessment.mode]}</Badge>
        <span className="text-sm text-ink-3">
          {assessment.topicId ? "Topic practice set" : "Course-wide practice test"} · {assessment.slug}
        </span>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <TransitionControls
          entity="assessments"
          id={assessment.id}
          status={assessment.status}
          role={actor.role}
        />
        <form action={duplicateAssessmentAction}>
          <input type="hidden" name="id" value={assessment.id} />
          <Button type="submit" variant="secondary" size="sm">
            Duplicate
          </Button>
        </form>
      </div>

      <section
        aria-label="Live question pool"
        className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-line bg-paper-raised px-4 py-3 text-sm text-ink-2"
      >
        <span className="font-medium text-ink">In scope</span>
        <span>{availability.total} questions</span>
        <span>{availability.published} published</span>
        <span>{availability.draft} in draft or review</span>
        <span className="text-ink-3">
          {Object.entries(availability.byDifficulty)
            .map(([difficulty, count]) => `${difficulty.replace(/_/g, " ")} ${count}`)
            .join(" · ")}
        </span>
      </section>

      <div className="mt-8">
        <AssessmentComposer assessment={assessment} candidates={candidates} />
      </div>
    </>
  );
}
