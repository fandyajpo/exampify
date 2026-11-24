import type { ContentStatus } from "@/lib/validation/taxonomy";

/**
 * The content-gap split for `/studio/overview` (`MVP_ROADMAP.md` Phase 3).
 *
 * "Gap" is editorial, not a defect: a topic may publish with a resource or an assessment,
 * and either absence is a valid shape (`PRODUCT_REQUIREMENTS.md` §6, `FR-CMS-06`). Archived
 * topics are left out at the query, so they never read as work waiting to be done.
 *
 * Kept as a pure function over the topic list and two id sets so the rule is testable
 * without a database, and so the service issues three flat queries instead of two
 * correlated ones.
 */

export type TopicGapRow = {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
};

export function splitTopicGaps(
  topics: readonly TopicGapRow[],
  resourceTopicIds: ReadonlySet<string>,
  assessmentTopicIds: ReadonlySet<string>,
): { withoutResource: TopicGapRow[]; withoutAssessment: TopicGapRow[] } {
  return {
    withoutResource: topics.filter((topic) => !resourceTopicIds.has(topic.id)),
    withoutAssessment: topics.filter((topic) => !assessmentTopicIds.has(topic.id)),
  };
}
