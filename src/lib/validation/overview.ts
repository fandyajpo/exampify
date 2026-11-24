import { z } from "zod";

import { auditLogDtoSchema } from "./audit";
import { contentStatusSchema } from "./taxonomy";

/**
 * `GET /api/v1/studio/overview` (`API_CONTRACTS.md` §7.7): the studio dashboard's counts,
 * its content-gap report and the latest audit entries.
 *
 * Recent edits reuse the audit DTO, so the overview cannot describe a row differently from
 * `/studio/audit`; the scoping rule is applied by `listAuditLogs`, not here.
 */

export const overviewCountsSchema = z.object({
  curricula: z.number().int(),
  levels: z.number().int(),
  subjects: z.number().int(),
  chapters: z.number().int(),
  topics: z.number().int(),
  resources: z.number().int(),
  assessments: z.number().int(),
});

export const topicGapSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  status: contentStatusSchema,
});

export const studioOverviewSchema = z.object({
  counts: overviewCountsSchema,
  gaps: z.object({
    withoutResource: z.array(topicGapSchema),
    withoutAssessment: z.array(topicGapSchema),
  }),
  recentEdits: z.array(auditLogDtoSchema),
});

export const studioOverviewEnvelopeSchema = z.object({ data: studioOverviewSchema });

export type TopicGap = z.infer<typeof topicGapSchema>;
export type StudioOverview = z.infer<typeof studioOverviewSchema>;
