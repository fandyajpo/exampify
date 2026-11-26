import { z } from "zod";

import { clientEventBatchSchema } from "@/lib/analytics/events";
import { jobRunRequestSchema } from "@/lib/validation/jobs";
import {
  chapterCreateSchema,
  chapterEnvelopeSchema,
  chapterListSchema,
  chapterUpdateSchema,
  curriculumCreateSchema,
  curriculumEnvelopeSchema,
  curriculumListSchema,
  curriculumUpdateSchema,
  levelCreateSchema,
  levelEnvelopeSchema,
  levelUpdateSchema,
  reorderSchema,
  subjectCreateSchema,
  subjectEnvelopeSchema,
  subjectListSchema,
  subjectUpdateSchema,
  topicCreateSchema,
  topicEnvelopeSchema,
  topicListSchema,
  topicUpdateSchema,
} from "@/lib/validation/taxonomy";
import {
  blockCreateSchema,
  blockEnvelopeSchema,
  blockListSchema,
  blockReorderSchema,
  blockUpdateSchema,
  gateEnvelopeSchema,
  previewEnvelopeSchema,
  resourceAssessmentSchema,
  resourceCreateSchema,
  resourceEnvelopeSchema,
  resourceItemEnvelopeSchema,
  resourceListSchema,
  resourceUpdateSchema,
} from "@/lib/validation/resources";
import {
  mediaAltTextSchema,
  mediaDownloadEnvelopeSchema,
  mediaEnvelopeSchema,
  mediaListQuerySchema,
  mediaListSchema,
  mediaTicketEnvelopeSchema,
  mediaUploadUrlSchema,
} from "@/lib/validation/media";
import { auditListQuerySchema, auditListSchema } from "@/lib/validation/audit";
import {
  questionCreateSchema,
  questionEnvelopeSchema,
  questionGateEnvelopeSchema,
  questionListQuerySchema,
  questionListSchema,
  questionUpdateSchema,
  questionValidateSchema,
} from "@/lib/validation/questions";
import {
  assessmentAvailabilityEnvelopeSchema,
  assessmentCreateSchema,
  assessmentDetailEnvelopeSchema,
  assessmentGateEnvelopeSchema,
  assessmentListQuerySchema,
  assessmentListSchema,
  assessmentUpdateSchema,
} from "@/lib/validation/assessments";
import { studioOverviewEnvelopeSchema } from "@/lib/validation/overview";
import { transitionEnvelopeSchema, transitionSchema } from "@/lib/validation/transitions";
import {
  attemptEnvelopeSchema,
  attemptListQuerySchema,
  attemptListSchema,
  createAttemptSchema,
  resumeEnvelopeSchema,
  saveAnswersEnvelopeSchema,
  saveAnswersSchema,
  submitEnvelopeSchema,
} from "@/lib/validation/attempts";
import {
  progressSummaryEnvelopeSchema,
  progressSummaryQuerySchema,
  studyProgressListSchema,
  studyProgressQuerySchema,
  topicPerformanceDetailEnvelopeSchema,
  topicPerformanceListSchema,
  topicPerformanceQuerySchema,
} from "@/lib/validation/progress";

import { countsEnvelopeSchema, healthEnvelopeSchema } from "./schemas";

/**
 * The route→schema registry ([API_CONTRACTS.md](../../../docs/API_CONTRACTS.md) §16.2).
 *
 * Every implemented `/api/v1` route appears here exactly once, and `openapi.json` is built
 * from this list — never hand-edited. Request bodies name the schema the handler already
 * parses, so a route cannot document a shape it does not validate, and a route that exists
 * without a row here fails `bun run openapi:check` (and the unit suite).
 *
 * Only implemented operations belong here. Phase 2+ endpoints are added in the same change
 * as their handler; the prose tables in `API_CONTRACTS.md` remain the human contract and
 * describe the whole surface ahead of the code.
 */

export type OpenApiTag = "meta" | "analytics" | "internal" | "practice" | "progress" | "studio";

/** The methods a route handler may export. `lib/openapi/routes.ts` scans for the same list. */
export const METHODS = ["get", "post", "patch", "delete"] as const;

export type Method = (typeof METHODS)[number];

export type ResponseSpec = {
  status: number;
  description: string;
  /**
   * A Zod schema, converted to JSON Schema by the builder. A response without one is
   * emitted as a `$ref` to the shared component when its status has an entry in
   * `ERROR_RESPONSES`, and as a description alone otherwise (a `204`, or a `200` with no body).
   */
  schema?: z.ZodType;
};

export type Operation = {
  method: Method;
  /** OpenAPI path template, e.g. `/api/v1/topics/{topicId}`. */
  path: string;
  operationId: string;
  summary: string;
  description?: string;
  tag: OpenApiTag;
  request?: z.ZodType;
  responses: ResponseSpec[];
};

/**
 * The shared error components, limited to the statuses an operation in this registry
 * actually returns. An entry nothing references is a component clients must sift through,
 * so the rest of §2.1's table is added back with the operation that first returns it.
 */
export const ERROR_RESPONSES: Record<number, string> = {
  400: "Malformed JSON or an unparseable request.",
  401: "Missing or invalid credentials (session, QStash signature or cron bearer).",
  403: "The actor lacks the capability, or the request is cross-origin.",
  404: "Unknown id or slug, or not visible to this actor.",
  409: "A conflict: the record changed under you, the slug is taken, or published children block an archive.",
  422: "Validation failed; `details` lists one entry per offending field.",
  500: "Unhandled failure; the message is generic.",
  503: "A dependency is unavailable.",
};

/** The refusals every studio write shares, so one is never forgotten on a new route. */
const WRITE_ERRORS: ResponseSpec[] = [error(401), error(403), error(404), error(409), error(422)];

function error(status: number): ResponseSpec {
  const description = ERROR_RESPONSES[status];
  if (!description) throw new Error(`no component response is defined for status ${status}`);
  return { status, description };
}

const TRANSITION_ROUTES: Operation[] = (
  [
    {
      entity: "curricula",
      summary: "Move a curriculum through its lifecycle",
      gate: "`CONTENT_MODEL.md` §4.1 defines no curriculum gate; publishing a curriculum before its levels is legal.",
    },
    {
      entity: "levels",
      summary: "Move a level through its lifecycle",
      gate: "No level gate: the subject gate is what keeps an empty course off the site.",
    },
    {
      entity: "subjects",
      summary: "Move a subject through its lifecycle",
      gate: "Publishing needs at least one published chapter (`CONTENT_MODEL.md` §4.3).",
    },
    {
      entity: "chapters",
      summary: "Move a chapter through its lifecycle",
      gate: "Publishing needs at least one published topic (`CONTENT_MODEL.md` §4.4).",
    },
    {
      entity: "topics",
      summary: "Move a topic through its lifecycle",
      gate:
        "Publishing needs a 40–320 character summary and at least one published learning resource or assessment (`CONTENT_MODEL.md` §4.5).",
    },
    {
      entity: "resources",
      summary: "Move a learning resource through its lifecycle",
      gate:
        "Publishing needs 200 characters of prose, a valid first block, ready media with alt text, parsing TeX, published in-scope assessments and related material, unique heading anchors and a payload under 256 kB (`CONTENT_MODEL.md` §4.6).",
    },
    {
      entity: "questions",
      summary: "Move a question through its lifecycle",
      gate:
        "Publishing needs a 10–4000 character stem, 60+ characters of explanation, 1–10 points, an answer key that matches the type, 2–8 options for choice types, at least two correct options for a multiple select, a published-or-in-review primary topic and ready media with alt text (`QUESTION_ENGINE.md` §10.1).",
    },
    {
      entity: "assessments",
      summary: "Move an assessment through its lifecycle",
      gate:
        "Publishing needs 1–60 distinct questions that are all published and in scope, a stored count equal to the item list, and a 60–10 800 second duration for `test`/`mock` (`QUESTION_ENGINE.md` §10.2).",
    },
  ] satisfies readonly { entity: string; summary: string; gate: string }[]
).map(({ entity, summary, gate }) => ({
  method: "post" as const,
  path: `/api/v1/studio/${entity}/{id}/transition`,
  operationId: `transition-${entity === "curricula" ? "curriculum" : entity.slice(0, -1)}`,
  summary,
  description:
    `\`author\`+ to submit, withdraw or archive; \`reviewer\`/\`admin\` to review, publish or unpublish; \`admin\` only for a direct publish from draft or a restore from the archive. ` +
    `The gates run on submit as well as on publish. A refusal is \`422 PUBLISH_GATE_FAILED\` with one \`details\` entry per failing field. ` +
    `A publish or unpublish writes its \`search_events\` row in the same transaction (ADR-021). ${gate}`,
  tag: "studio",
  request: transitionSchema,
  responses: [
    { status: 200, description: "The row's new status.", schema: transitionEnvelopeSchema },
    { status: 403, description: "`FORBIDDEN` — this role cannot make that change." },
    { status: 404, description: "`NOT_FOUND`." },
    {
      status: 422,
      description:
        "`PUBLISH_GATE_FAILED` with field-level `details`, `INVALID_TRANSITION` for an edge the graph does not have, or `REASON_REQUIRED` for a send-back.",
    },
  ],
}));

/** `§7.6`: the two-step presigned upload, the library, alt text and a private read. */
const MEDIA_ROUTES: Operation[] = [
  {
    method: "post",
    path: "/api/v1/studio/media/upload-url",
    operationId: "create-media-upload",
    summary: "Request a presigned upload",
    description:
      "`author`+. Creates a `pending` row and a `PUT` signed for the exact content type and length, valid for 5 minutes. The purpose fixes the MIME allow-list and the size cap (`CONTENT_MODEL.md` §4.9): an image is at most 8 MB, a document 25 MB.",
    tag: "studio",
    request: mediaUploadUrlSchema,
    responses: [
      { status: 201, description: "The upload URL and its media id.", schema: mediaTicketEnvelopeSchema },
      ...WRITE_ERRORS,
      error(503),
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/media/{id}/confirm",
    operationId: "confirm-media",
    summary: "Confirm an uploaded asset",
    description:
      "`author`+. No body. `HEAD`s the object, compares the size, checks the magic bytes and scrubs an SVG before the row becomes `ready`. Idempotent: a second call returns the same row.",
    tag: "studio",
    responses: [
      { status: 200, description: "The ready asset.", schema: mediaEnvelopeSchema },
      ...WRITE_ERRORS,
      error(503),
    ],
  },
  {
    method: "get",
    path: "/api/v1/studio/media",
    operationId: "list-media",
    summary: "List the media library",
    description:
      "`author`+. Newest first, cursor-paginated. Deleted rows are excluded unless `status=deleted`. `q` searches alt text, the only human-readable field on a row.",
    tag: "studio",
    request: mediaListQuerySchema,
    responses: [
      { status: 200, description: "A page of assets.", schema: mediaListSchema },
      error(401),
      error(403),
      error(422),
    ],
  },
  {
    method: "patch",
    path: "/api/v1/studio/media/{id}",
    operationId: "update-media",
    summary: "Set an asset's alt text",
    description:
      "`author`+. `altText` is the only editable field; the bytes, type and storage key are fixed at confirm. An image needs non-empty alt text before the resource that embeds it can publish.",
    tag: "studio",
    request: mediaAltTextSchema,
    responses: [
      { status: 200, description: "Updated.", schema: mediaEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "delete",
    path: "/api/v1/studio/media/{id}",
    operationId: "delete-media",
    summary: "Soft-delete an asset",
    description:
      "`author`+. Soft delete; the blob is purged later. Refused with `409 MEDIA_IN_USE` while a resource block, subject hero or question still references it.",
    tag: "studio",
    responses: [
      { status: 204, description: "Deleted." },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "get",
    path: "/api/v1/studio/media/{id}/download-url",
    operationId: "media-download-url",
    summary: "Sign a read for a private asset",
    description: "`author`+. A presigned `GET` valid for at most 10 minutes; never a long-lived URL.",
    tag: "studio",
    responses: [
      { status: 200, description: "A signed download URL.", schema: mediaDownloadEnvelopeSchema },
      error(401),
      error(403),
      error(404),
      error(503),
    ],
  },
];

/** `§7.7`: the read-only audit trail. Writing happens inside each mutation. */
const AUDIT_ROUTES: Operation[] = [
  {
    method: "get",
    path: "/api/v1/studio/audit",
    operationId: "list-audit",
    summary: "Read the audit trail",
    description:
      "`admin` reads every actor; `author`/`reviewer` only their own rows, and naming another actor is `403`. " +
      "Newest first, cursor-paginated, filtered by `entityType`, `entityId`, `actorId` and an inclusive `from`/`to` range. " +
      "`metadata` holds changed field names, transitions and ids — never a value, an answer key or an email address.",
    tag: "studio",
    request: auditListQuerySchema,
    responses: [
      { status: 200, description: "A page of audit entries.", schema: auditListSchema },
      error(401),
      error(403),
      error(422),
    ],
  },
];

/** `§7.7`: the studio dashboard — totals, the content-gap report and recent edits. */
const OVERVIEW_ROUTES: Operation[] = [
  {
    method: "get",
    path: "/api/v1/studio/overview",
    operationId: "studio-overview",
    summary: "Read the studio overview",
    description:
      "`author`+. A total per content table, the content-gap report (live topics with no learning resource and live topics with no assessment) and the latest audit entries. " +
      "A gap is informational, not a defect: a topic may publish with either a resource or an assessment. " +
      "Recent edits follow the audit rule — `admin` sees every actor, `author`/`reviewer` only their own (`SEC §6`).",
    tag: "studio",
    responses: [
      { status: 200, description: "Counts, gaps and recent edits.", schema: studioOverviewEnvelopeSchema },
      error(401),
      error(403),
    ],
  },
];

/**
 * `§6`: the dashboard surface. Derived from submitted attempts, never from a cache table.
 * Session-authenticated and email-verified, and always scoped to the caller.
 */
const PROGRESS_ROUTES: Operation[] = [
  {
    method: "get",
    path: "/api/v1/progress/summary",
    operationId: "progress-summary",
    summary: "Read the dashboard summary",
    description:
      "Any signed-in, email-verified student; the numbers are always the caller's own. Computed live from `submitted` attempts, so a re-grade is reflected on the next read. " +
      "`accuracy` is `correct / graded` as a percentage and `null` — not `0` — when nothing is graded; an item whose key no longer parses is excluded from both sides. " +
      "`window` and `activity` cover the last `days` calendar days in UTC, today included. `focusTopics` holds at most five topics with at least five answers and under 60 % accuracy, weakest first. " +
      "`totals.studyMinutes` is time inside submitted attempts; `totals.resourcesRead` is `null` because a cached public read cannot be attributed to a student.",
    tag: "progress",
    request: progressSummaryQuerySchema,
    responses: [
      { status: 200, description: "Totals, the window, focus topics and the daily activity strip.", schema: progressSummaryEnvelopeSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 422, description: "`VALIDATION_ERROR` — `days` is one of 7, 30 or 90." },
    ],
  },
  {
    method: "get",
    path: "/api/v1/progress/topics",
    operationId: "list-progress-topics",
    summary: "List topic performance",
    description:
      "Any signed-in, email-verified student; only topics the caller has practised appear. One row per topic with attempts, answers, accuracy and last practised, filtered by `subjectId`. " +
      "`sort=accuracy` defaults to weakest first and `sort=lastPracticed` to most recent first; a topic with nothing graded sorts last in either direction. Cursor-paginated in the §10 envelope, `limit` 1–50.",
    tag: "progress",
    request: topicPerformanceQuerySchema,
    responses: [
      { status: 200, description: "One page of topic performance rows.", schema: topicPerformanceListSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 422, description: "`VALIDATION_ERROR` or `INVALID_CURSOR`." },
    ],
  },
  {
    method: "get",
    path: "/api/v1/progress/study",
    operationId: "study-progress",
    summary: "Read study progress",
    description:
      "Any signed-in, email-verified student. One row per topic that has at least one published resource: resources read, resources total, the reading minutes those represent and whether the topic has been practised. " +
      "Reading comes from the student's own `resource_reads` rows, so a repeat visit updates a row instead of inflating a count and nothing decays with analytics retention; practice comes from `submitted` attempts. " +
      "Unpaginated by contract — a student's topics are bounded by the catalogue — ordered most recently read first, never-read last. `?subjectId=` narrows it.",
    tag: "progress",
    request: studyProgressQuerySchema,
    responses: [
      { status: 200, description: "One row per topic with published resources.", schema: studyProgressListSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 422, description: "`VALIDATION_ERROR` for an unknown query parameter." },
    ],
  },
  {
    method: "post",
    path: "/api/v1/resources/{resourceId}/view",
    operationId: "record-resource-view",
    summary: "Record a resource read",
    description:
      "Called by the reader itself. No body, and no session is required: a signed-in student gets a `resource_reads` row (a repeat visit updates it), a signed-out visitor is ignored, and an unknown or unpublished id is a silent no-op. " +
      "`204` in every case — a progress row is never worth an error in a student's reader, and the unconditional answer cannot confirm that a draft exists. Cross-origin mutations are `403` before any read.",
    tag: "progress",
    responses: [
      { status: 204, description: "Recorded, or deliberately dropped." },
      { status: 403, description: "`CROSS_ORIGIN_BLOCKED`." },
    ],
  },
  {
    method: "get",
    path: "/api/v1/progress/topics/{topicId}",
    operationId: "get-progress-topic",
    summary: "Read one topic's performance",
    description:
      "Any signed-in, email-verified student. The same row the table shows, plus an accuracy breakdown by difficulty and by question type (every entry present, zeroes included) and the five latest submitted attempts that included the topic. " +
      "A topic the caller never practised is a `200` with zeroes and a `null` accuracy; only an unknown topic id is a `404`.",
    tag: "progress",
    responses: [
      { status: 200, description: "The topic's performance and breakdown.", schema: topicPerformanceDetailEnvelopeSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 404, description: "`NOT_FOUND` — no such topic." },
    ],
  },
];

/** `§5`: the student attempt surface. Session-authenticated and email-verified. */
const ATTEMPT_ROUTES: Operation[] = [
  {
    method: "post",
    path: "/api/v1/attempts",
    operationId: "create-attempt",
    summary: "Start a practice set or an assessment",
    description:
      "Any signed-in, email-verified student. The body names a scope — a curated `assessment`, a `topic`/`chapter`/`subject` with a selection rule, or the `assessment` linked to a `resource` — and the server chooses the questions; a client never sends a question id. " +
      "Each item is snapshotted with its question version and points, so a later content edit cannot change what this attempt is scored against. " +
      "A pool smaller than `questionCount` is a `201` with both counts, never an error; an empty pool is `422 NO_QUESTIONS_MATCH` with `appliedFilters`. " +
      "An `Idempotency-Key` that already produced an attempt returns that attempt with `200` instead of creating a second one. " +
      "The response never carries `answer_key`, an explanation or per-option feedback.",
    tag: "practice",
    request: createAttemptSchema,
    responses: [
      { status: 201, description: "The attempt and its snapshotted questions.", schema: attemptEnvelopeSchema },
      { status: 200, description: "The attempt an `Idempotency-Key` already created.", schema: attemptEnvelopeSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 403, description: "`CROSS_ORIGIN_BLOCKED`." },
      { status: 404, description: "The scope does not exist or is not published." },
      {
        status: 422,
        description: "`VALIDATION_ERROR`, `UNKNOWN_FIELD`, or `NO_QUESTIONS_MATCH` with `appliedFilters`.",
      },
    ],
  },
  {
    method: "get",
    path: "/api/v1/attempts",
    operationId: "list-attempts",
    summary: "List the caller's attempts",
    description:
      "Any signed-in, email-verified student; the list is always the caller's own. Newest first by `startedAt`, keyed on `(startedAt, id)` for a stable cursor. " +
      "Filters `status`, `subjectId`, `topicId` and a `from`/`to` window on `startedAt`; `limit` is 1–50. `scorePercent` is a percentage and `null` until the attempt is graded.",
    tag: "practice",
    request: attemptListQuerySchema,
    responses: [
      { status: 200, description: "One page of attempt summaries.", schema: attemptListSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 422, description: "`VALIDATION_ERROR` or `INVALID_CURSOR`." },
    ],
  },
  {
    method: "get",
    path: "/api/v1/attempts/{attemptId}",
    operationId: "resume-attempt",
    summary: "Resume an attempt",
    description:
      "Any signed-in, email-verified student, on their own attempt. Restores the runner: the snapshotted questions with the answers already saved, a `savedAnswers` list carrying response times, and `attempt.canResume`. " +
      "An attempt read after its window is marked `expired` first, so the reply is a `200` with `canResume: false` and still no keys. Another student's id is a `404`, not a `403`, so the endpoint never confirms existence.",
    tag: "practice",
    responses: [
      {
        status: 200,
        description: "The attempt, its questions and the answers saved so far.",
        schema: resumeEnvelopeSchema,
      },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 404, description: "The attempt does not exist, or belongs to another student." },
    ],
  },
  {
    method: "patch",
    path: "/api/v1/attempts/{attemptId}/answers",
    operationId: "save-attempt-answers",
    summary: "Save answers for an attempt",
    description:
      "Any signed-in, email-verified student, on their own in-progress attempt. One to four answers per batch; `answer: null` clears an item and `responseMs` records time on it. " +
      "The save is one transaction and refreshes the attempt's activity window (24 h, or the timed attempt's fixed deadline when sooner). " +
      "`reveal` appears only when a practice save newly answers exactly one item — never for `test`/`mock`, never on a re-save of the same answer, and never when a batch answers several. A key that no longer parses yields `isCorrect: null` and `correctAnswer: null`.",
    tag: "practice",
    request: saveAnswersSchema,
    responses: [
      { status: 200, description: "The saved count, answered count, expiry and optional reveal.", schema: saveAnswersEnvelopeSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 403, description: "`CROSS_ORIGIN_BLOCKED`." },
      { status: 404, description: "The attempt does not exist, or belongs to another student." },
      { status: 409, description: "`ATTEMPT_EXPIRED`." },
      {
        status: 422,
        description:
          "`VALIDATION_ERROR`, `QUESTION_NOT_IN_ATTEMPT`, or `ATTEMPT_NOT_EDITABLE` for a submitted or abandoned attempt.",
      },
    ],
  },
  {
    method: "post",
    path: "/api/v1/attempts/{attemptId}/abandon",
    operationId: "abandon-attempt",
    summary: "Abandon an attempt",
    description:
      "Any signed-in, email-verified student, on their own attempt. No body. Idempotent: an already abandoned attempt answers the same body. A submitted attempt is `422 ATTEMPT_NOT_EDITABLE`; one past its window is `409 ATTEMPT_EXPIRED`.",
    tag: "practice",
    responses: [
      { status: 200, description: "The attempt is abandoned." },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 403, description: "`CROSS_ORIGIN_BLOCKED`." },
      { status: 404, description: "The attempt does not exist, or belongs to another student." },
      { status: 409, description: "`ATTEMPT_EXPIRED`." },
      { status: 422, description: "`ATTEMPT_NOT_EDITABLE` for a submitted attempt." },
    ],
  },
  {
    method: "get",
    path: "/api/v1/attempts/{attemptId}/review",
    operationId: "review-attempt",
    summary: "Read a submitted attempt's review",
    description:
      "Any signed-in, email-verified student, on their own submitted attempt. The same payload `submit` returns, read from the stored totals without grading again, so a review request cannot rescore an attempt. Anything not submitted is `409 INVALID_TRANSITION`; another student's id is a `404`.",
    tag: "practice",
    responses: [
      { status: 200, description: "The graded attempt and one review item per question.", schema: submitEnvelopeSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 404, description: "The attempt does not exist, or belongs to another student." },
      { status: 409, description: "`INVALID_TRANSITION` until the attempt is submitted." },
    ],
  },
  {
    method: "post",
    path: "/api/v1/attempts/{attemptId}/retry",
    operationId: "retry-attempt",
    summary: "Retry an attempt",
    description:
      "Any signed-in, email-verified student, on their own finished attempt. No body. Rebuilds the §5.1 request from the stored config and resolves today's published content with a fresh seed, so the new attempt never reuses the old snapshot. " +
      "An attempt still in progress is `409 INVALID_TRANSITION`; a stored config that no longer parses is `422 ATTEMPT_NOT_RETRYABLE`; a scope that is gone is `404`.",
    tag: "practice",
    responses: [
      { status: 201, description: "The new attempt and its questions.", schema: attemptEnvelopeSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 403, description: "`CROSS_ORIGIN_BLOCKED`." },
      { status: 404, description: "The attempt or its scope does not exist, or belongs to another student." },
      { status: 409, description: "`INVALID_TRANSITION` while the attempt is still in progress." },
      { status: 422, description: "`ATTEMPT_NOT_RETRYABLE` or `NO_QUESTIONS_MATCH`." },
    ],
  },
  {
    method: "post",
    path: "/api/v1/attempts/{attemptId}/submit",
    operationId: "submit-attempt",
    summary: "Submit an attempt and read its review",
    description:
      "Any signed-in, email-verified student, on their own attempt. No body. Grading runs server-side against the snapshot taken at creation, and the totals, per-item outcomes and duration are written in one transaction. " +
      "Idempotent: a second submit returns the first one's payload with `200`, so a retried request never scores twice. A timed attempt that ran over its limit is accepted and graded, with `attempt.overTimeSeconds` reported. " +
      "Only the review carries the key: `correctAnswer` is the right answer without its scoring rule, and `optionFeedback`/`explanationHtml` appear here and nowhere in the attempt itself.",
    tag: "practice",
    responses: [
      { status: 200, description: "The graded attempt and one review item per question.", schema: submitEnvelopeSchema },
      { status: 401, description: "`UNAUTHENTICATED`, or `EMAIL_NOT_VERIFIED`." },
      { status: 403, description: "`CROSS_ORIGIN_BLOCKED`." },
      { status: 404, description: "The attempt does not exist, or belongs to another student." },
      {
        status: 409,
        description: "`ATTEMPT_EXPIRED` for an expired attempt, or `INVALID_TRANSITION` for an abandoned one.",
      },
    ],
  },
];

/** `§7.4`: the question bank — authoring, cross-listing, the dry run and the repeatable copy. */
const QUESTION_ROUTES: Operation[] = [
  {
    method: "get",
    path: "/api/v1/studio/questions",
    operationId: "list-questions",
    summary: "List questions, drafts included",
    description:
      "`author`+. Filters `topicId`, `subjectId`, `type`, `difficulty`, `status`, `q` (stem) and `authorId`; `sort` is `updatedAt` (default) or `createdAt`, with `dir`; `limit` 1–50 and an opaque `cursor`. The list projection never selects `answerKey` or the explanation.",
    tag: "studio",
    request: questionListQuerySchema,
    responses: [
      { status: 200, description: "One page of questions.", schema: questionListSchema },
      error(401),
      error(403),
      error(422),
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/questions",
    operationId: "create-question",
    summary: "Create a draft question",
    description:
      "`author`+. `topicId` is the primary topic; `secondaryTopicIds` cross-list it (`ADR-003`). A draft may start without options or a key — the editor fills them — but a sent key is checked against the options it names. A new question starts as a draft; `status` moves through the transition endpoint.",
    tag: "studio",
    request: questionCreateSchema,
    responses: [
      { status: 201, description: "Created, with its options and key.", schema: questionEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/questions/validate",
    operationId: "validate-question",
    summary: "Dry-run a question's publish gates",
    description:
      "`author`+. Runs the `QUESTION_ENGINE.md` §10.1 gates on an existing question and returns `{ passing, blocking[], warnings[] }` without writing. The same evaluation runs on the publish transition.",
    tag: "studio",
    request: questionValidateSchema,
    responses: [
      { status: 200, description: "The gate result.", schema: questionGateEnvelopeSchema },
      error(401),
      error(403),
      error(404),
      error(422),
    ],
  },
  {
    method: "get",
    path: "/api/v1/studio/questions/{id}",
    operationId: "read-question",
    summary: "Read a question with its key",
    description:
      "`author`+. The one question response that carries `answerKey`, the options' feedback and the cross-listings. `no-store`; never reachable by a student.",
    tag: "studio",
    responses: [
      { status: 200, description: "The question in full.", schema: questionEnvelopeSchema },
      error(401),
      error(403),
      error(404),
    ],
  },
  {
    method: "patch",
    path: "/api/v1/studio/questions/{id}",
    operationId: "update-question",
    summary: "Update a question",
    description:
      "`author`+. Partial; `options` and `answerKey` are replaced whole when sent, and changing `type` requires a matching key in the same save. Requires `expectedUpdatedAt`; a mismatch is `409 CONTENT_CONFLICT`.",
    tag: "studio",
    request: questionUpdateSchema,
    responses: [
      { status: 200, description: "Updated.", schema: questionEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "delete",
    path: "/api/v1/studio/questions/{id}",
    operationId: "archive-question",
    summary: "Archive a question",
    description:
      "`author`+. Archive only; nothing is deleted. Refused with `409 QUESTION_IN_USE` while a published assessment still lists the question.",
    tag: "studio",
    responses: [{ status: 204, description: "Archived." }, ...WRITE_ERRORS],
  },
  {
    method: "post",
    path: "/api/v1/studio/questions/{id}/duplicate",
    operationId: "duplicate-question",
    summary: "Duplicate a question as a draft",
    description:
      "`author`+. Copies the stem, options, key and cross-listings; the copy starts as a draft with version 1.",
    tag: "studio",
    responses: [
      { status: 201, description: "The draft copy.", schema: questionEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
];

/** `§7.3`: the assessment composer, its dry run and the composer's live pool counts. */
const ASSESSMENT_ROUTES: Operation[] = [
  {
    method: "get",
    path: "/api/v1/studio/assessments",
    operationId: "list-assessments",
    summary: "List assessments, drafts included",
    description:
      "`author`+. Filters `topicId`, `subjectId`, `mode`, `status` and `q` (title); `sort` is `updatedAt` (default) or `createdAt`; `limit` 1–50 with an opaque `cursor`.",
    tag: "studio",
    request: assessmentListQuerySchema,
    responses: [
      { status: 200, description: "One page of assessments.", schema: assessmentListSchema },
      error(401),
      error(403),
      error(422),
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/assessments",
    operationId: "create-assessment",
    summary: "Create a draft assessment",
    description:
      "`author`+. Scope is `topicId` (a topic's practice set) or `subjectId` alone (a course-wide test); every item must sit in that scope. `items` may be empty so the composer can start from the shell — the publish gate is what requires 1–60. `test`/`mock` need a 60–10 800 second duration; `practice` forbids one.",
    tag: "studio",
    request: assessmentCreateSchema,
    responses: [
      { status: 201, description: "Created, with its ordered items.", schema: assessmentDetailEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "get",
    path: "/api/v1/studio/assessments/{id}",
    operationId: "read-assessment",
    summary: "Read an assessment with its items",
    description:
      "`author`+. The ordered items, each with its full question (the studio may see `answerKey`). `no-store`.",
    tag: "studio",
    responses: [
      { status: 200, description: "The assessment in full.", schema: assessmentDetailEnvelopeSchema },
      error(401),
      error(403),
      error(404),
    ],
  },
  {
    method: "patch",
    path: "/api/v1/studio/assessments/{id}",
    operationId: "update-assessment",
    summary: "Update an assessment",
    description:
      "`author`+. `items` is replaced wholesale when sent, so order and `question_count` cannot drift. Requires `expectedUpdatedAt`; a mismatch is `409 CONTENT_CONFLICT`.",
    tag: "studio",
    request: assessmentUpdateSchema,
    responses: [
      { status: 200, description: "Updated.", schema: assessmentDetailEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/assessments/{id}/duplicate",
    operationId: "duplicate-assessment",
    summary: "Duplicate an assessment as a draft",
    description: "`author`+. A draft copy whose items reference the same questions (`§7.3`).",
    tag: "studio",
    responses: [
      { status: 201, description: "The draft copy.", schema: assessmentDetailEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/assessments/{id}/validate",
    operationId: "validate-assessment",
    summary: "Dry-run an assessment's publish gates",
    description:
      "`author`+. Runs the `QUESTION_ENGINE.md` §10.2 gates and returns `{ passing, blocking[], warnings[] }` without writing.",
    tag: "studio",
    responses: [
      { status: 200, description: "The gate result.", schema: assessmentGateEnvelopeSchema },
      error(401),
      error(403),
      error(404),
    ],
  },
  {
    method: "get",
    path: "/api/v1/studio/assessments/{id}/availability",
    operationId: "assessment-availability",
    summary: "Read the composer's live pool counts",
    description:
      "`author`+. Question totals for the assessment's scope, split by status, type and difficulty; one grouped query, so the composer can show what is left to add.",
    tag: "studio",
    responses: [
      { status: 200, description: "Pool counts for the scope.", schema: assessmentAvailabilityEnvelopeSchema },
      error(401),
      error(403),
      error(404),
    ],
  },
];

/** `§7.2`: resources, blocks, the assessment links, the dry run and the staff preview. */
const RESOURCE_ROUTES: Operation[] = [
  {
    method: "get",
    path: "/api/v1/studio/topics/{id}/resources",
    operationId: "list-topic-resources",
    summary: "List a topic's resources, drafts included",
    description:
      "`author`+. Ordered by `position`. `format` is derived: any linked assessment makes it `lesson_with_practice`, otherwise `study_material`.",
    tag: "studio",
    responses: [
      { status: 200, description: "Resources in reading order.", schema: resourceListSchema },
      error(401),
      error(403),
      error(404),
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/topics/{id}/resources",
    operationId: "create-resource",
    summary: "Create a learning resource",
    description:
      "`author`+. The slug is unique within the topic and generated from the title when omitted. A new resource starts as a draft; `status` moves through the transition endpoint.",
    tag: "studio",
    request: resourceCreateSchema,
    responses: [
      { status: 201, description: "Created.", schema: resourceItemEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "get",
    path: "/api/v1/studio/resources/{id}",
    operationId: "read-resource",
    summary: "Read a resource with its blocks",
    description: "`author`+. Blocks are returned as validated payloads, not HTML.",
    tag: "studio",
    responses: [
      { status: 200, description: "The resource and its ordered blocks.", schema: resourceEnvelopeSchema },
      error(401),
      error(403),
      error(404),
    ],
  },
  {
    method: "patch",
    path: "/api/v1/studio/resources/{id}",
    operationId: "update-resource",
    summary: "Update resource metadata",
    description:
      "`author`+. Requires `expectedUpdatedAt`; a mismatch is `409 CONTENT_CONFLICT` carrying `currentUpdatedAt` (§12).",
    tag: "studio",
    request: resourceUpdateSchema,
    responses: [
      { status: 200, description: "Updated.", schema: resourceItemEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/resources/{id}/duplicate",
    operationId: "duplicate-resource",
    summary: "Duplicate a resource as a draft",
    description:
      "`author`+. Deep copy: fresh block ids, `-copy` slug, `draft` status, the same assessment links (`CONTENT_MODEL.md` §7).",
    tag: "studio",
    responses: [
      { status: 201, description: "The draft copy.", schema: resourceItemEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "get",
    path: "/api/v1/studio/resources/{id}/blocks",
    operationId: "list-resource-blocks",
    summary: "List a resource's blocks",
    description: "`author`+. Ordered by contiguous `position`.",
    tag: "studio",
    responses: [
      { status: 200, description: "Blocks in reading order.", schema: blockListSchema },
      error(401),
      error(403),
      error(404),
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/resources/{id}/blocks",
    operationId: "create-block",
    summary: "Append or insert a block",
    description:
      "`author`+. The payload is validated against its `kind` by the shared block union; a mismatch is `422 INVALID_BLOCK` with the offending path (API-19). Positions are renumbered contiguously.",
    tag: "studio",
    request: blockCreateSchema,
    responses: [
      { status: 201, description: "The created block.", schema: blockEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "patch",
    path: "/api/v1/studio/blocks/{blockId}",
    operationId: "update-block",
    summary: "Replace a block payload",
    description:
      "`author`+. The whole payload is replaced and re-validated against the row's kind; there is no partial payload patch. Autosave sends `expectedUpdatedAt` every 4 s of idle time and a stale value is `409 CONTENT_CONFLICT`.",
    tag: "studio",
    request: blockUpdateSchema,
    responses: [
      { status: 200, description: "The saved block.", schema: blockEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "delete",
    path: "/api/v1/studio/blocks/{blockId}",
    operationId: "delete-block",
    summary: "Delete a block and renumber",
    description: "`author`+. The remaining blocks keep contiguous positions.",
    tag: "studio",
    responses: [{ status: 204, description: "Deleted." }, ...WRITE_ERRORS],
  },
  {
    method: "post",
    path: "/api/v1/studio/resources/{id}/blocks/reorder",
    operationId: "reorder-blocks",
    summary: "Reorder blocks",
    description:
      "`author`+. A whole-list operation: `orderedIds` must contain every block exactly once (`CONTENT_MODEL.md` §5.2).",
    tag: "studio",
    request: blockReorderSchema,
    responses: [{ status: 204, description: "Reordered." }, ...WRITE_ERRORS],
  },
  {
    method: "post",
    path: "/api/v1/studio/resources/{id}/blocks/validate",
    operationId: "validate-resource",
    summary: "Dry-run the publish gates",
    description:
      "`author`+. Runs the same block and publish gates the transition endpoint runs, returning `{ passing, blocking[], warnings[] }` without writing a status.",
    tag: "studio",
    responses: [
      { status: 200, description: "The gate result.", schema: gateEnvelopeSchema },
      error(401),
      error(403),
      error(404),
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/resources/{id}/assessments",
    operationId: "link-resource-assessment",
    summary: "Link an assessment to a resource",
    description:
      "`author`+. The assessment must be in this resource's topic (or a subject-level assessment for its subject), otherwise `422 ASSESSMENT_SCOPE_MISMATCH` (API-20). Linking sets `format` to `lesson_with_practice`.",
    tag: "studio",
    request: resourceAssessmentSchema,
    responses: [{ status: 204, description: "Linked." }, ...WRITE_ERRORS],
  },
  {
    method: "delete",
    path: "/api/v1/studio/resources/{id}/assessments/{assessmentId}",
    operationId: "unlink-resource-assessment",
    summary: "Unlink an assessment",
    description: "`author`+. Unlinking the last assessment reverts `format` to `study_material`.",
    tag: "studio",
    responses: [{ status: 204, description: "Unlinked." }, ...WRITE_ERRORS],
  },
  {
    method: "get",
    path: "/api/v1/studio/resources/{id}/preview",
    operationId: "preview-resource",
    summary: "Preview a resource's rendered blocks",
    description:
      "`author`+. Returns the rendered block payloads and resolved media for a staff preview; the preview page sends `noindex`.",
    tag: "studio",
    responses: [
      { status: 200, description: "The preview payload.", schema: previewEnvelopeSchema },
      error(401),
      error(403),
      error(404),
    ],
  },
];

export const OPERATIONS: readonly Operation[] = [
  {
    method: "get",
    path: "/api/v1/health",
    operationId: "read-health",
    summary: "Read service health",
    description:
      "Reports the database, the search cluster and index lag without exposing configuration. Used by the post-deploy smoke check and by R1 of the runbook.",
    tag: "meta",
    responses: [
      {
        status: 200,
        description: "Dependency status.",
        schema: healthEnvelopeSchema,
      },
      error(503),
    ],
  },
  {
    method: "get",
    path: "/api/v1/openapi.json",
    operationId: "read-openapi-document",
    summary: "Read the generated API document",
    description:
      "Serves the committed `openapi.json` in non-production only (`OQ-API2` is unresolved, so a public contract is not assumed). Returns 404 in production.",
    tag: "meta",
    responses: [
      { status: 200, description: "The OpenAPI 3.1 document." },
      error(404),
    ],
  },
  {
    method: "post",
    path: "/api/v1/events",
    operationId: "ingest-client-events",
    summary: "Ingest client analytics events",
    description:
      "The only client analytics path. Accepts the client-safe event names only and answers `204` for anything the student must not see, including dropped or rate-limited events (§16.1).",
    tag: "analytics",
    request: clientEventBatchSchema,
    responses: [
      { status: 204, description: "Accepted, dropped or rate-limited — always no content." },
      error(403),
    ],
  },
  {
    method: "post",
    path: "/api/v1/internal/jobs/send-email",
    operationId: "run-send-email-job",
    summary: "Run the send-email worker",
    description:
      "QStash-signed. Claims one `job_runs` row and sends its rendered message. `200` means delivered or intentionally skipped; `500` means the attempt did not reach the relay and QStash should retry (`BACKGROUND_JOBS.md` §5.2).",
    tag: "internal",
    request: jobRunRequestSchema,
    responses: [
      { status: 200, description: "Delivered, skipped, refused or uncertain.", schema: countsEnvelopeSchema },
      error(400),
      error(401),
      error(500),
    ],
  },
  {
    method: "post",
    path: "/api/v1/internal/cron/sweep-jobs",
    operationId: "run-sweep-jobs",
    summary: "Re-enqueue stale job rows",
    description:
      "Cron backstop (`BACKGROUND_JOBS.md` §8, J-01): re-publishes email rows left `pending` by a failed publish, and re-claims rows left `started` by a crash. Authenticated with `Authorization: Bearer $CRON_SECRET`, not a QStash signature.",
    tag: "internal",
    responses: [
      { status: 200, description: "Rows re-enqueued.", schema: countsEnvelopeSchema },
      error(401),
      error(500),
    ],
  },

  // §7.1 — taxonomy. Reads are `author`+, writes are `admin` (`taxonomy:write`).
  {
    method: "get",
    path: "/api/v1/studio/curricula",
    operationId: "list-studio-curricula",
    summary: "List the taxonomy tree, drafts included",
    description:
      "Every curriculum with its levels nested. `author`+; this is the one read path that is meant to show drafts.",
    tag: "studio",
    responses: [
      { status: 200, description: "Curricula with their levels.", schema: curriculumListSchema },
      error(401),
      error(403),
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/curricula",
    operationId: "create-curriculum",
    summary: "Create a curriculum",
    description:
      "`admin` only. A slug is generated from the name when it is omitted; the new curriculum starts as a draft.",
    tag: "studio",
    request: curriculumCreateSchema,
    responses: [
      { status: 201, description: "Created.", schema: curriculumEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "patch",
    path: "/api/v1/studio/curricula/{id}",
    operationId: "update-curriculum",
    summary: "Update a curriculum",
    description:
      "`admin` only. Requires `expectedUpdatedAt`; a mismatch is `409 CONTENT_CONFLICT` and writes nothing.",
    tag: "studio",
    request: curriculumUpdateSchema,
    responses: [
      { status: 200, description: "Updated.", schema: curriculumEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "delete",
    path: "/api/v1/studio/curricula/{id}",
    operationId: "archive-curriculum",
    summary: "Archive a curriculum",
    description:
      "`admin` only. Sets `status = archived`; nothing is deleted. Refused with `409 HAS_PUBLISHED_CHILDREN` while a published level hangs off it.",
    tag: "studio",
    responses: [{ status: 204, description: "Archived." }, ...WRITE_ERRORS],
  },
  {
    method: "post",
    path: "/api/v1/studio/curricula/{id}/levels",
    operationId: "create-level",
    summary: "Create a level under a curriculum",
    description: "`admin` only. The slug is unique within its curriculum.",
    tag: "studio",
    request: levelCreateSchema,
    responses: [
      { status: 201, description: "Created.", schema: levelEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/curricula/reorder",
    operationId: "reorder-curricula",
    summary: "Reorder curricula",
    description:
      "`admin` only. `orderedIds` must be every curriculum exactly once; a partial list is `422` rather than a lost position.",
    tag: "studio",
    request: reorderSchema,
    responses: [{ status: 204, description: "Reordered." }, ...WRITE_ERRORS],
  },
  {
    method: "patch",
    path: "/api/v1/studio/levels/{id}",
    operationId: "update-level",
    summary: "Update a level",
    description: "`admin` only. Requires `expectedUpdatedAt`.",
    tag: "studio",
    request: levelUpdateSchema,
    responses: [
      { status: 200, description: "Updated.", schema: levelEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "delete",
    path: "/api/v1/studio/levels/{id}",
    operationId: "archive-level",
    summary: "Archive a level",
    description: "`admin` only. Refused while a published subject hangs off it.",
    tag: "studio",
    responses: [{ status: 204, description: "Archived." }, ...WRITE_ERRORS],
  },
  {
    method: "post",
    path: "/api/v1/studio/levels/reorder",
    operationId: "reorder-levels",
    summary: "Reorder levels within a curriculum",
    description: "`admin` only. `parentId` is the curriculum; `orderedIds` must be every one of its levels.",
    tag: "studio",
    request: reorderSchema,
    responses: [{ status: 204, description: "Reordered." }, ...WRITE_ERRORS],
  },
  {
    method: "get",
    path: "/api/v1/studio/subjects",
    operationId: "list-studio-subjects",
    summary: "List subjects, drafts included",
    description:
      "`author`+. Filters `levelId`, `status`, `q`; `sort` is `position` (default), `name` or `updatedAt`, with `dir`; `limit` 1–50 and an opaque `cursor` (§10). An unknown parameter is `422`.",
    tag: "studio",
    responses: [
      { status: 200, description: "One page of subjects.", schema: subjectListSchema },
      error(401),
      error(403),
      error(422),
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/subjects",
    operationId: "create-subject",
    summary: "Create a subject",
    description: "`admin` only. The slug is unique within its level.",
    tag: "studio",
    request: subjectCreateSchema,
    responses: [
      { status: 201, description: "Created.", schema: subjectEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "patch",
    path: "/api/v1/studio/subjects/{id}",
    operationId: "update-subject",
    summary: "Update a subject",
    description:
      "`admin` only. Requires `expectedUpdatedAt`. Publishing sets `published_at` if it was null.",
    tag: "studio",
    request: subjectUpdateSchema,
    responses: [
      { status: 200, description: "Updated.", schema: subjectEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "delete",
    path: "/api/v1/studio/subjects/{id}",
    operationId: "archive-subject",
    summary: "Archive a subject",
    description: "`admin` only. Refused while a published chapter hangs off it.",
    tag: "studio",
    responses: [{ status: 204, description: "Archived." }, ...WRITE_ERRORS],
  },
  {
    method: "post",
    path: "/api/v1/studio/subjects/reorder",
    operationId: "reorder-subjects",
    summary: "Reorder subjects within a level",
    description: "`admin` only. `parentId` is the education level; `orderedIds` must be every one of its subjects.",
    tag: "studio",
    request: reorderSchema,
    responses: [{ status: 204, description: "Reordered." }, ...WRITE_ERRORS],
  },
  {
    method: "get",
    path: "/api/v1/studio/chapters",
    operationId: "list-studio-chapters",
    summary: "List chapters, drafts included",
    description:
      "`author`+. Filters on `subjectId`; ordered by `position`. The set is complete rather than paginated — a subject has a handful of chapters and the shell renders and reorders all of them. An unknown parameter is `422`.",
    tag: "studio",
    responses: [
      { status: 200, description: "Chapters in position order.", schema: chapterListSchema },
      error(401),
      error(403),
      error(422),
    ],
  },
  {
    method: "get",
    path: "/api/v1/studio/topics",
    operationId: "list-studio-topics",
    summary: "List topics, drafts included",
    description:
      "`author`+. Filters `chapterId`, `status` and a title search `q`; ordered by `position`. Complete rather than paginated, for the same reason as chapters. An unknown parameter is `422`.",
    tag: "studio",
    responses: [
      { status: 200, description: "Topics in position order.", schema: topicListSchema },
      error(401),
      error(403),
      error(422),
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/chapters",
    operationId: "create-chapter",
    summary: "Create a chapter",
    description:
      "`author`+. The slug is unique within its subject and is generated from the title when omitted. A new chapter starts as a draft; `status` moves through the transition endpoint.",
    tag: "studio",
    request: chapterCreateSchema,
    responses: [
      { status: 201, description: "Created.", schema: chapterEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "patch",
    path: "/api/v1/studio/chapters/{id}",
    operationId: "update-chapter",
    summary: "Update a chapter",
    description: "`author`+. Requires `expectedUpdatedAt`; a mismatch is `409 CONTENT_CONFLICT`.",
    tag: "studio",
    request: chapterUpdateSchema,
    responses: [
      { status: 200, description: "Updated.", schema: chapterEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "post",
    path: "/api/v1/studio/topics",
    operationId: "create-topic",
    summary: "Create a topic",
    description:
      "`author`+. 1–12 learning objectives of 8–160 characters each. The slug is unique within its chapter; a new topic starts as a draft.",
    tag: "studio",
    request: topicCreateSchema,
    responses: [
      { status: 201, description: "Created.", schema: topicEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  {
    method: "patch",
    path: "/api/v1/studio/topics/{id}",
    operationId: "update-topic",
    summary: "Update a topic",
    description:
      "`author`+. Requires `expectedUpdatedAt`. `learningObjectives` is replaced wholesale when sent.",
    tag: "studio",
    request: topicUpdateSchema,
    responses: [
      { status: 200, description: "Updated.", schema: topicEnvelopeSchema },
      ...WRITE_ERRORS,
    ],
  },
  ...ATTEMPT_ROUTES,
  ...PROGRESS_ROUTES,
  ...RESOURCE_ROUTES,
  ...QUESTION_ROUTES,
  ...ASSESSMENT_ROUTES,
  ...MEDIA_ROUTES,
  ...AUDIT_ROUTES,
  ...OVERVIEW_ROUTES,
  ...TRANSITION_ROUTES,
];
