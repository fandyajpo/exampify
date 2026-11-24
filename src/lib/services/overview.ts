import "server-only";

import { splitTopicGaps } from "@/lib/content/gaps";
import { getDb } from "@/lib/db";
import type { Actor } from "@/lib/rbac";
import type { StudioOverview } from "@/lib/validation/overview";

import { listAuditLogs } from "./audit-admin";

/**
 * `GET /api/v1/studio/overview` (`API_CONTRACTS.md` §7.7, `INFORMATION_ARCHITECTURE.md`
 * §4.3): totals per content table, the content-gap report and the latest audit entries.
 *
 * The gaps are computed from three flat reads — every live topic, the topics that own a
 * learning resource, and the topics an assessment reaches either directly or through a
 * linked resource — so the rule stays in `splitTopicGaps` rather than in SQL.
 *
 * Recent edits are `listAuditLogs` with a small page: an `admin` sees every actor's
 * changes, an `author` or `reviewer` only their own (`SEC §6`), because the scoping lives
 * in that one service instead of being re-derived here.
 */

const RECENT_EDITS = 8;

export async function getStudioOverview(actor: Actor): Promise<StudioOverview> {
  const db = await getDb();

  const [
    curricula,
    levels,
    subjects,
    chapters,
    topics,
    resources,
    assessments,
    topicRows,
    resourceRows,
    topicAssessmentRows,
    linkedAssessmentRows,
    { data: recentEdits },
  ] = await Promise.all([
    db
      .selectFrom("curricula")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("education_levels")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("subjects")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("chapters")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("topics")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("learning_resources")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("assessments")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("topics")
      .select(["id", "slug", "title", "status"])
      .where("status", "!=", "archived")
      .orderBy("title", "asc")
      .execute(),
    db.selectFrom("learning_resources").select("topic_id").distinct().execute(),
    db
      .selectFrom("assessments")
      .select("topic_id")
      .where("topic_id", "is not", null)
      .distinct()
      .execute(),
    db
      .selectFrom("resource_assessments as ra")
      .innerJoin("learning_resources as r", "r.id", "ra.resource_id")
      .select("r.topic_id")
      .distinct()
      .execute(),
    listAuditLogs(actor, { limit: RECENT_EDITS }),
  ]);

  const resourceTopicIds = new Set(resourceRows.map((row) => row.topic_id));
  const assessmentTopicIds = new Set([
    ...topicAssessmentRows.flatMap((row) => (row.topic_id ? [row.topic_id] : [])),
    ...linkedAssessmentRows.map((row) => row.topic_id),
  ]);

  return {
    counts: {
      curricula: curricula.n,
      levels: levels.n,
      subjects: subjects.n,
      chapters: chapters.n,
      topics: topics.n,
      resources: resources.n,
      assessments: assessments.n,
    },
    gaps: splitTopicGaps(topicRows, resourceTopicIds, assessmentTopicIds),
    recentEdits,
  };
}
