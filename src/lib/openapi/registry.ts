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
import { studioOverviewEnvelopeSchema } from "@/lib/validation/overview";
import { transitionEnvelopeSchema, transitionSchema } from "@/lib/validation/transitions";

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

export type OpenApiTag = "meta" | "analytics" | "internal" | "studio";

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
  ...RESOURCE_ROUTES,
  ...MEDIA_ROUTES,
  ...AUDIT_ROUTES,
  ...OVERVIEW_ROUTES,
  ...TRANSITION_ROUTES,
];
