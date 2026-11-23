import "server-only";

import type { Kysely, Transaction } from "kysely";

import { recordAudit } from "@/lib/audit";
import { readingMinutesFromBlocks } from "@/lib/content/reading-time";
import { evaluateResourceGates as evaluate } from "@/lib/content/resource-gates";
import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db/schema";
import { contentConflict, HttpError, notFound, slugTaken } from "@/lib/http/errors";
import { uuidv7 } from "@/lib/ids";
import type { Actor } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { blockPayloadSchema, parseBlock, type BlockPayload } from "@/lib/validation/blocks";
import type {
  BlockCreateInput,
  BlockDto,
  BlockUpdateInput,
  GateResult,
  ResourceAssessmentInput,
  ResourceCreateInput,
  ResourceDto,
  ResourceUpdateInput,
} from "@/lib/validation/resources";
import type { ContentStatus } from "@/lib/validation/taxonomy";

/**
 * Studio resource and block writes (`API_CONTRACTS.md` §7.2, `CONTENT_MODEL.md` §4.6, §5).
 *
 * The same ownership rules as the taxonomy services: capability is enforced at the route,
 * this layer owns existence, `expectedUpdatedAt`, sibling-unique slugs, contiguous block
 * positions and the reading-time computation. A mutation and its audit row share one
 * transaction, and block writes always touch the parent resource's `updated_at` so an
 * editor autosaving a block cannot leave the metadata stale.
 */

type Db = Kysely<Database>;
type Trx = Transaction<Database>;
type Executor = Db | Trx;

const ISO = (ms: number): string => new Date(ms).toISOString();

/** `format` is derived from the assessment links, never stored (§4.6). */
export type ResourceFormat = "study_material" | "lesson_with_practice";

type ResourceRow = {
  id: string;
  topic_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  reading_minutes: number;
  difficulty: "easy" | "medium" | "hard" | "very_hard";
  position: number;
  status: ContentStatus;
  published_at: number | null;
  version: number;
  updated_by: string | null;
  updated_at: number;
};

const RESOURCE_COLUMNS = [
  "id",
  "topic_id",
  "slug",
  "title",
  "subtitle",
  "summary",
  "reading_minutes",
  "difficulty",
  "position",
  "status",
  "published_at",
  "version",
  "updated_by",
  "updated_at",
] as const;

type BlockRow = {
  id: string;
  resource_id: string;
  kind: string;
  position: number;
  payload: string;
  updated_at: number;
};

const BLOCK_COLUMNS = ["id", "resource_id", "kind", "position", "payload", "updated_at"] as const;

function toResourceDto(row: ResourceRow, format: ResourceFormat): ResourceDto {
  return {
    id: row.id,
    topicId: row.topic_id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    readingMinutes: row.reading_minutes,
    difficulty: row.difficulty,
    format,
    position: row.position,
    status: row.status,
    publishedAt: row.published_at === null ? null : ISO(row.published_at),
    version: row.version,
    updatedAt: ISO(row.updated_at),
  };
}

/** A block is served with its parsed payload; a corrupt row surfaces as an invalid block. */
function toBlockDto(row: BlockRow): BlockDto {
  const parsed = parseBlock(row.kind, row.payload);
  return {
    id: row.id,
    resourceId: row.resource_id,
    kind: row.kind,
    payload: (parsed?.payload ?? {}) as Record<string, unknown>,
    position: row.position,
    updatedAt: ISO(row.updated_at),
  };
}

async function formatFor(executor: Executor, resourceId: string): Promise<ResourceFormat> {
  const link = await executor
    .selectFrom("resource_assessments")
    .select("assessment_id")
    .where("resource_id", "=", resourceId)
    .executeTakeFirst();
  return link ? "lesson_with_practice" : "study_material";
}

async function loadResource(executor: Executor, id: string): Promise<ResourceRow | null> {
  const row = await executor
    .selectFrom("learning_resources")
    .select(RESOURCE_COLUMNS)
    .where("id", "=", id)
    .executeTakeFirst();
  return row ?? null;
}

export async function findResource(id: string): Promise<ResourceDto | null> {
  const db = await getDb();
  const row = await loadResource(db, id);
  return row ? toResourceDto(row, await formatFor(db, id)) : null;
}

/** `GET /studio/resources/{id}`: the full resource with its blocks, payloads not HTML. */
export async function getResourceAdmin(
  id: string,
): Promise<(ResourceDto & { blocks: BlockDto[] }) | null> {
  const db = await getDb();
  const row = await loadResource(db, id);
  if (!row) return null;

  const blocks = await db
    .selectFrom("content_blocks")
    .select(BLOCK_COLUMNS)
    .where("resource_id", "=", id)
    .orderBy("position")
    .execute();

  return {
    ...toResourceDto(row, await formatFor(db, id)),
    blocks: blocks.map(toBlockDto),
  };
}

/** `GET /studio/topics/{topicId}/resources`: ordered, drafts included. */
export async function listResourcesAdmin(topicId: string): Promise<ResourceDto[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("learning_resources")
    .select(RESOURCE_COLUMNS)
    .where("topic_id", "=", topicId)
    .orderBy("position")
    .orderBy("title")
    .execute();

  const links = await db
    .selectFrom("resource_assessments")
    .select("resource_id")
    .where(
      "resource_id",
      "in",
      rows.map((row) => row.id),
    )
    .execute();
  const withPractice = new Set(links.map((link) => link.resource_id));

  return rows.map((row) =>
    toResourceDto(row, withPractice.has(row.id) ? "lesson_with_practice" : "study_material"),
  );
}

async function nextPosition(trx: Trx, topicId: string): Promise<number> {
  const row = await trx
    .selectFrom("learning_resources")
    .select(({ fn }) => fn.max("position").as("max"))
    .where("topic_id", "=", topicId)
    .executeTakeFirst();
  return Number(row?.max ?? -1) + 1;
}

async function resourceSlugTaken(trx: Trx, topicId: string, slug: string, exceptId = ""): Promise<boolean> {
  const row = await trx
    .selectFrom("learning_resources")
    .select("id")
    .where("topic_id", "=", topicId)
    .where("slug", "=", slug)
    .where("id", "!=", exceptId)
    .executeTakeFirst();
  return row !== undefined;
}

export async function createResource(
  actor: Actor,
  topicId: string,
  input: ResourceCreateInput,
): Promise<ResourceDto> {
  const db = await getDb();
  const now = Date.now();
  const slug = input.slug ?? slugify(input.title);
  if (!slug) {
    throw new HttpError(422, "VALIDATION_ERROR", "Add a slug: the title produced an empty one.", [
      { path: "slug", code: "invalid_slug", message: "Required when the title has no ASCII letters." },
    ]);
  }

  return db.transaction().execute(async (trx) => {
    const topic = await trx.selectFrom("topics").select("id").where("id", "=", topicId).executeTakeFirst();
    if (!topic) throw notFound("topic");
    if (await resourceSlugTaken(trx, topicId, slug)) throw slugTaken();

    const row: ResourceRow = {
      id: uuidv7(now),
      topic_id: topicId,
      slug,
      title: input.title,
      subtitle: input.subtitle ?? null,
      summary: input.summary ?? null,
      reading_minutes: 0,
      difficulty: input.difficulty ?? "medium",
      position: input.position ?? (await nextPosition(trx, topicId)),
      status: "draft",
      published_at: null,
      version: 1,
      updated_by: actor.id,
      updated_at: now,
    };

    await trx
      .insertInto("learning_resources")
      .values({ ...row, created_by: actor.id, created_at: now })
      .execute();
    await recordAudit(
      {
        actorId: actor.id,
        action: "resource.create",
        entityType: "resource",
        entityId: row.id,
        metadata: { fields: ["slug", "title", "difficulty", "position"], parentId: topicId },
      },
      trx,
    );

    return toResourceDto(row, "study_material");
  });
}

export async function updateResource(
  actor: Actor,
  id: string,
  input: ResourceUpdateInput,
): Promise<ResourceDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await loadResource(trx, id);
    if (!existing) throw notFound("resource");
    if (existing.updated_at !== Date.parse(input.expectedUpdatedAt)) {
      throw contentConflict({
        currentUpdatedAt: ISO(existing.updated_at),
        currentUpdatedBy: existing.updated_by,
      });
    }

    const now = Date.now();
    const changes: Partial<ResourceRow> & { updated_at: number; updated_by: string } = {
      updated_at: now,
      updated_by: actor.id,
    };

    if (input.title !== undefined) changes.title = input.title;
    if (input.subtitle !== undefined) changes.subtitle = input.subtitle ?? null;
    if (input.summary !== undefined) changes.summary = input.summary ?? null;
    if (input.difficulty !== undefined) changes.difficulty = input.difficulty;
    if (input.position !== undefined) changes.position = input.position;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      if (await resourceSlugTaken(trx, existing.topic_id, input.slug, id)) throw slugTaken();
      changes.slug = input.slug;
    }

    await trx.updateTable("learning_resources").set(changes).where("id", "=", id).execute();

    const fields = Object.keys(changes).filter((key) => key !== "updated_at" && key !== "updated_by");
    await recordAudit(
      { actorId: actor.id, action: "resource.update", entityType: "resource", entityId: id, metadata: { fields } },
      trx,
    );

    const row = { ...existing, ...changes } as ResourceRow;
    return toResourceDto(row, await formatFor(trx, id));
  });
}

/** `POST /studio/resources/{id}/duplicate`: deep copy as a draft, fresh block ids (§7). */
export async function duplicateResource(actor: Actor, id: string): Promise<ResourceDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const source = await loadResource(trx, id);
    if (!source) throw notFound("resource");

    const now = Date.now();
    let slug = `${source.slug}-copy`;
    for (let attempt = 2; await resourceSlugTaken(trx, source.topic_id, slug); attempt += 1) {
      slug = `${source.slug}-copy-${attempt}`;
    }

    const copy: ResourceRow = {
      ...source,
      id: uuidv7(now),
      slug,
      status: "draft",
      published_at: null,
      version: 1,
      position: await nextPosition(trx, source.topic_id),
      updated_by: actor.id,
      updated_at: now,
    };

    await trx
      .insertInto("learning_resources")
      .values({ ...copy, created_by: actor.id, created_at: now })
      .execute();

    const blocks = await trx
      .selectFrom("content_blocks")
      .select(["kind", "payload", "position"])
      .where("resource_id", "=", id)
      .orderBy("position")
      .execute();

    for (const block of blocks) {
      await trx
        .insertInto("content_blocks")
        .values({
          id: uuidv7(now),
          resource_id: copy.id,
          kind: block.kind,
          position: block.position,
          payload: block.payload,
          created_at: now,
          updated_at: now,
        })
        .execute();
    }

    const links = await trx
      .selectFrom("resource_assessments")
      .select(["assessment_id", "placement", "position"])
      .where("resource_id", "=", id)
      .execute();
    for (const link of links) {
      await trx.insertInto("resource_assessments").values({ ...link, resource_id: copy.id }).execute();
    }

    await recordAudit(
      {
        actorId: actor.id,
        action: "resource.duplicate",
        entityType: "resource",
        entityId: copy.id,
        metadata: { copiedFromId: id, blocks: blocks.length, assessments: links.length },
      },
      trx,
    );

    return toResourceDto(copy, links.length > 0 ? "lesson_with_practice" : "study_material");
  });
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/** The union parse the route delegates here, so a bad payload is `INVALID_BLOCK` (API-19). */
function parsePayload(kind: string, payload: unknown, path: string): BlockPayload {
  const parsed = blockPayloadSchema.safeParse({ kind, payload });
  if (!parsed.success) {
    throw new HttpError(422, "INVALID_BLOCK", "This block is not valid for its type.", [
      {
        path,
        code: "invalid_block",
        message: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
          .slice(0, 5)
          .join("; "),
      },
    ]);
  }
  return parsed.data;
}

export async function listBlocks(resourceId: string): Promise<BlockDto[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("content_blocks")
    .select(BLOCK_COLUMNS)
    .where("resource_id", "=", resourceId)
    .orderBy("position")
    .execute();
  return rows.map(toBlockDto);
}

/** Positions are contiguous per resource; a block write recomputes the reading time. */
async function renumber(trx: Trx, resourceId: string, orderedIds: readonly string[], now: number): Promise<void> {
  for (const [index, blockId] of orderedIds.entries()) {
    await trx
      .updateTable("content_blocks")
      .set({ position: index })
      .where("id", "=", blockId)
      .execute();
  }
  await refreshResource(trx, resourceId, now);
}

async function refreshResource(trx: Trx, resourceId: string, now: number): Promise<void> {
  const rows = await trx
    .selectFrom("content_blocks")
    .select(["kind", "payload"])
    .where("resource_id", "=", resourceId)
    .orderBy("position")
    .execute();

  const blocks = rows.map((row, index) => ({
    id: String(index),
    resourceId,
    kind: row.kind,
    payload: (parseBlock(row.kind, row.payload)?.payload ?? {}) as Record<string, unknown>,
    position: index,
    updatedAt: ISO(now),
  }));

  await trx
    .updateTable("learning_resources")
    .set({ reading_minutes: readingMinutesFromBlocks(blocks), updated_at: now })
    .where("id", "=", resourceId)
    .execute();
}

export async function createBlock(
  actor: Actor,
  resourceId: string,
  input: BlockCreateInput,
): Promise<BlockDto> {
  const db = await getDb();
  const parsed = parsePayload(input.kind, input.payload, "payload");
  const now = Date.now();

  return db.transaction().execute(async (trx) => {
    const resource = await loadResource(trx, resourceId);
    if (!resource) throw notFound("resource");

    const existing = await trx
      .selectFrom("content_blocks")
      .select("id")
      .where("resource_id", "=", resourceId)
      .orderBy("position")
      .execute();
    const index = Math.min(input.position ?? existing.length, existing.length);

    const id = uuidv7(now);
    // Insert high then renumber: `UNIQUE (resource_id, position)` must never see a collision.
    await trx
      .insertInto("content_blocks")
      .values({
        id,
        resource_id: resourceId,
        kind: parsed.kind,
        position: 1_000_000 + existing.length,
        payload: JSON.stringify(parsed.payload),
        created_at: now,
        updated_at: now,
      })
      .execute();

    const ordered = [...existing.slice(0, index).map((row) => row.id), id, ...existing.slice(index).map((row) => row.id)];
    for (const [position, blockId] of ordered.entries()) {
      await trx.updateTable("content_blocks").set({ position }).where("id", "=", blockId).execute();
    }
    await refreshResource(trx, resourceId, now);

    await recordAudit(
      {
        actorId: actor.id,
        action: "resource.block.create",
        entityType: "resource",
        entityId: resourceId,
        metadata: { blockId: id, kind: parsed.kind, position: index },
      },
      trx,
    );

    const row = await trx
      .selectFrom("content_blocks")
      .select(BLOCK_COLUMNS)
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    return toBlockDto(row);
  });
}

export async function updateBlock(actor: Actor, blockId: string, input: BlockUpdateInput): Promise<BlockDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("content_blocks")
      .select(BLOCK_COLUMNS)
      .where("id", "=", blockId)
      .executeTakeFirst();
    if (!existing) throw notFound("block");

    if (existing.updated_at !== Date.parse(input.expectedUpdatedAt)) {
      throw contentConflict({ currentUpdatedAt: ISO(existing.updated_at), changedFields: ["payload"] });
    }

    // The kind is fixed by the row: a payload is only ever re-validated against its own kind.
    const parsed = parsePayload(existing.kind, input.payload, "payload");
    const now = Date.now();

    await trx
      .updateTable("content_blocks")
      .set({ payload: JSON.stringify(parsed.payload), updated_at: now })
      .where("id", "=", blockId)
      .execute();
    await refreshResource(trx, existing.resource_id, now);

    await recordAudit(
      {
        actorId: actor.id,
        action: "resource.block.update",
        entityType: "resource",
        entityId: existing.resource_id,
        metadata: { blockId, kind: existing.kind },
      },
      trx,
    );

    return toBlockDto({ ...existing, payload: JSON.stringify(parsed.payload), updated_at: now });
  });
}

export async function deleteBlock(actor: Actor, blockId: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("content_blocks")
      .select(["id", "resource_id", "kind"])
      .where("id", "=", blockId)
      .executeTakeFirst();
    if (!existing) throw notFound("block");

    await trx.deleteFrom("content_blocks").where("id", "=", blockId).execute();

    const rest = await trx
      .selectFrom("content_blocks")
      .select("id")
      .where("resource_id", "=", existing.resource_id)
      .orderBy("position")
      .execute();
    await renumber(trx, existing.resource_id, rest.map((row) => row.id), now);

    await recordAudit(
      {
        actorId: actor.id,
        action: "resource.block.delete",
        entityType: "resource",
        entityId: existing.resource_id,
        metadata: { blockId, kind: existing.kind },
      },
      trx,
    );
  });
}

export async function reorderBlocks(actor: Actor, resourceId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.transaction().execute(async (trx) => {
    const resource = await loadResource(trx, resourceId);
    if (!resource) throw notFound("resource");

    const rows = await trx
      .selectFrom("content_blocks")
      .select("id")
      .where("resource_id", "=", resourceId)
      .execute();
    const current = new Set(rows.map((row) => row.id));
    const unique = new Set(orderedIds);
    if (
      unique.size !== orderedIds.length ||
      current.size !== unique.size ||
      [...current].some((id) => !unique.has(id))
    ) {
      throw new HttpError(422, "VALIDATION_ERROR", "Send every block exactly once.", [
        {
          path: "orderedIds",
          code: "invalid_set",
          message: "The ordered list must contain every block id and nothing else.",
        },
      ]);
    }

    await renumber(trx, resourceId, orderedIds, now);
    await recordAudit(
      {
        actorId: actor.id,
        action: "resource.block.reorder",
        entityType: "resource",
        entityId: resourceId,
        metadata: { count: orderedIds.length },
      },
      trx,
    );
  });
}

// ---------------------------------------------------------------------------
// Assessment links
// ---------------------------------------------------------------------------

export async function linkAssessment(
  actor: Actor,
  resourceId: string,
  input: ResourceAssessmentInput,
): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.transaction().execute(async (trx) => {
    const resource = await trx
      .selectFrom("learning_resources as r")
      .innerJoin("topics as t", "t.id", "r.topic_id")
      .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
      .select(["r.id", "r.topic_id", "ch.subject_id"])
      .where("r.id", "=", resourceId)
      .executeTakeFirst();
    if (!resource) throw notFound("resource");

    const assessment = await trx
      .selectFrom("assessments")
      .select(["id", "topic_id", "subject_id"])
      .where("id", "=", input.assessmentId)
      .executeTakeFirst();
    if (!assessment) throw notFound("assessment");

    const inScope =
      assessment.topic_id === resource.topic_id ||
      (assessment.topic_id === null && assessment.subject_id === resource.subject_id);
    if (!inScope) {
      throw new HttpError(
        422,
        "ASSESSMENT_SCOPE_MISMATCH",
        "That assessment belongs to another topic or subject.",
        [{ path: "assessmentId", code: "out_of_scope", message: "Link an assessment from this topic." }],
      );
    }

    const position =
      input.position ??
      (Number(
        (
          await trx
            .selectFrom("resource_assessments")
            .select(({ fn }) => fn.max("position").as("max"))
            .where("resource_id", "=", resourceId)
            .executeTakeFirst()
        )?.max ?? -1,
      ) + 1);

    await trx
      .insertInto("resource_assessments")
      .values({ resource_id: resourceId, assessment_id: input.assessmentId, placement: input.placement, position })
      .onConflict((oc) =>
        oc.columns(["resource_id", "assessment_id"]).doUpdateSet({ placement: input.placement, position }),
      )
      .execute();

    await trx.updateTable("learning_resources").set({ updated_at: now }).where("id", "=", resourceId).execute();
    await recordAudit(
      {
        actorId: actor.id,
        action: "resource.assessment.link",
        entityType: "resource",
        entityId: resourceId,
        metadata: { assessmentId: input.assessmentId, placement: input.placement },
      },
      trx,
    );
  });
}

export async function unlinkAssessment(actor: Actor, resourceId: string, assessmentId: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.transaction().execute(async (trx) => {
    const result = await trx
      .deleteFrom("resource_assessments")
      .where("resource_id", "=", resourceId)
      .where("assessment_id", "=", assessmentId)
      .executeTakeFirst();
    if (Number(result.numDeletedRows ?? 0) === 0) throw notFound("assessment link");

    await trx.updateTable("learning_resources").set({ updated_at: now }).where("id", "=", resourceId).execute();
    await recordAudit(
      {
        actorId: actor.id,
        action: "resource.assessment.unlink",
        entityType: "resource",
        entityId: resourceId,
        metadata: { assessmentId },
      },
      trx,
    );
  });
}

// ---------------------------------------------------------------------------
// Gates and preview
// ---------------------------------------------------------------------------

/**
 * Load everything the §4.6 gates need and evaluate them. Shared by `validate` and the
 * publish transition, so the dry run and the real gate can never disagree.
 */
export async function loadResourceGates(executor: Executor, resourceId: string): Promise<GateResult | null> {
  const resource = await executor
    .selectFrom("learning_resources as r")
    .innerJoin("topics as t", "t.id", "r.topic_id")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .select(["r.id", "r.topic_id", "ch.subject_id"])
    .where("r.id", "=", resourceId)
    .executeTakeFirst();
  if (!resource) return null;

  const blocks = await executor
    .selectFrom("content_blocks")
    .select(["position", "kind", "payload"])
    .where("resource_id", "=", resourceId)
    .orderBy("position")
    .execute();

  const parsed = blocks.map((row) => parseBlock(row.kind, row.payload)).filter((b): b is BlockPayload => b !== null);

  const assessmentIds = parsed.flatMap((block) =>
    block.kind === "question_section" ? [block.payload.assessmentId] : [],
  );
  const resourceIds = parsed.flatMap((block) =>
    block.kind === "related_material" ? block.payload.resourceIds : [],
  );
  const mediaIds = parsed.flatMap((block) =>
    block.kind === "image" ? [block.payload.mediaId] : [],
  );

  const [assessments, related, media] = await Promise.all([
    assessmentIds.length === 0
      ? []
      : executor
          .selectFrom("assessments")
          .select(["id", "status", "topic_id", "subject_id"])
          .where("id", "in", assessmentIds)
          .execute(),
    resourceIds.length === 0
      ? []
      : executor
          .selectFrom("learning_resources as r")
          .innerJoin("topics as t", "t.id", "r.topic_id")
          .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
          .select(["r.id", "r.status", "ch.subject_id"])
          .where("r.id", "in", resourceIds)
          .execute(),
    mediaIds.length === 0
      ? []
      : executor
          .selectFrom("media_assets")
          .select(["id", "status", "alt_text"])
          .where("id", "in", mediaIds)
          .execute(),
  ]);

  const result = evaluate({
    resourceId,
    resourceTopicId: resource.topic_id,
    resourceSubjectId: resource.subject_id,
    blocks,
    assessments: Object.fromEntries(
      assessments.map((row) => [
        row.id,
        { status: row.status, topicId: row.topic_id, subjectId: row.subject_id },
      ]),
    ),
    resources: Object.fromEntries(related.map((row) => [row.id, { status: row.status, subjectId: row.subject_id }])),
    media: Object.fromEntries(media.map((row) => [row.id, { status: row.status, altText: row.alt_text }])),
  });

  return { passing: result.blocking.length === 0, blocking: result.blocking, warnings: result.warnings };
}

/** `POST /studio/resources/{id}/blocks/validate`: the dry run, reusing the publish gate. */
export async function validateResource(resourceId: string): Promise<GateResult> {
  const db = await getDb();
  const result = await loadResourceGates(db, resourceId);
  if (!result) throw notFound("resource");
  return result;
}

export type ResourcePreview = {
  resource: ResourceDto;
  blocks: BlockPayload[];
  media: Record<string, { url: string; alt: string }>;
};

/** `GET /studio/resources/{id}/preview`: rendered blocks, staff-only and `noindex`. */
export async function getResourcePreview(id: string): Promise<ResourcePreview | null> {
  const db = await getDb();
  const row = await loadResource(db, id);
  if (!row) return null;

  const blocks = await db
    .selectFrom("content_blocks")
    .select(["kind", "payload"])
    .where("resource_id", "=", id)
    .orderBy("position")
    .execute();

  const parsed = blocks.map((block) => parseBlock(block.kind, block.payload)).filter((b): b is BlockPayload => b !== null);
  const mediaIds = parsed.flatMap((block) =>
    block.kind === "image" || block.kind === "download" ? [block.payload.mediaId] : [],
  );

  const media: Record<string, { url: string; alt: string }> = {};
  if (mediaIds.length > 0) {
    const assets = await db
      .selectFrom("media_assets")
      .select(["id", "public_url", "alt_text"])
      .where("id", "in", mediaIds)
      .where("status", "=", "ready")
      .execute();
    for (const asset of assets) {
      if (asset.public_url) media[asset.id] = { url: asset.public_url, alt: asset.alt_text };
    }
  }

  return { resource: toResourceDto(row, await formatFor(db, id)), blocks: parsed, media };
}
