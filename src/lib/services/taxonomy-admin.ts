import "server-only";

import { sql, type Transaction } from "kysely";

import { recordAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db/schema";
import { contentConflict, HttpError, notFound, slugTaken } from "@/lib/http/errors";
import { uuidv7 } from "@/lib/ids";
import type { Actor } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { decodeCursor, encodeCursor } from "@/lib/validation/cursor";

import { redirectSlugChange } from "./redirects";
import type {
  ChapterCreateInput,
  ChapterDto,
  ChapterListQuery,
  ChapterUpdateInput,
  ContentStatus,
  CurriculumCreateInput,
  CurriculumDto,
  CurriculumTreeDto,
  CurriculumUpdateInput,
  LevelCreateInput,
  LevelDto,
  LevelUpdateInput,
  ReorderInput,
  SubjectCreateInput,
  SubjectDto,
  SubjectListQuery,
  SubjectUpdateInput,
  TopicCreateInput,
  TopicDto,
  TopicListQuery,
  TopicUpdateInput,
} from "@/lib/validation/taxonomy";

/**
 * Studio taxonomy writes (`API_CONTRACTS.md` §7.1, `CONTENT_MODEL.md` §6,
 * `PRODUCT_ARCHITECTURE.md` §6).
 *
 * Every function here is the second enforcement layer: capability is checked at the route,
 * and this layer owns the row-level rules the route cannot see — the row exists, the
 * `expectedUpdatedAt` still matches, the slug is free among its siblings, and an archive is
 * refused while published children hang off the entity.
 *
 * A mutation and its audit row share one transaction, so an audit entry cannot outlive a
 * rolled-back write. Deferred transactions are enough for these writes; `BEGIN IMMEDIATE` is
 * reserved for publish (PRODUCT_ARCHITECTURE §6 step 2).
 */

type Trx = Transaction<Database>;

export type SubjectGroupOption = { id: string; slug: string; name: string };

const ISO = (ms: number): string => new Date(ms).toISOString();

function archivedChildren(entity: string): HttpError {
  return new HttpError(
    409,
    "HAS_PUBLISHED_CHILDREN",
    `This ${entity} still has published content under it. Unpublish or archive that first.`,
  );
}

/** A generated slug can come out empty for a name with no ASCII letters or digits. */
function resolveSlug(name: string, requested?: string): string {
  const slug = requested ?? slugify(name);
  if (!slug) {
    throw new HttpError(422, "VALIDATION_ERROR", "Add a slug: the name produced an empty one.", [
      { path: "slug", code: "invalid_slug", message: "Required when the name has no ASCII letters." },
    ]);
  }
  return slug;
}

// ---------------------------------------------------------------------------
// Curricula
// ---------------------------------------------------------------------------

type CurriculumRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  description_md: string | null;
  status: ContentStatus;
  position: number;
  updated_at: number;
};

const CURRICULUM_COLUMNS = [
  "id",
  "slug",
  "name",
  "short_name",
  "description_md",
  "status",
  "position",
  "updated_at",
] as const;

function toCurriculumDto(row: CurriculumRow): CurriculumDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    descriptionMd: row.description_md,
    status: row.status,
    position: row.position,
    updatedAt: ISO(row.updated_at),
  };
}

async function curriculumSlugTaken(trx: Trx, slug: string, exceptId?: string): Promise<boolean> {
  const row = await trx
    .selectFrom("curricula")
    .select("id")
    .where("slug", "=", slug)
    .where("id", "!=", exceptId ?? "")
    .executeTakeFirst();
  return row !== undefined;
}

async function nextCurriculumPosition(trx: Trx): Promise<number> {
  const row = await trx
    .selectFrom("curricula")
    .select(({ fn }) => fn.max("position").as("max"))
    .executeTakeFirst();
  return Number(row?.max ?? -1) + 1;
}

/** A curriculum for a studio screen, or `null` so the page can answer `notFound()`. */
export async function findCurriculum(id: string): Promise<CurriculumDto | null> {
  const db = await getDb();
  const row = await db
    .selectFrom("curricula")
    .select(CURRICULUM_COLUMNS)
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? toCurriculumDto(row) : null;
}

async function listCurricula(): Promise<CurriculumDto[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("curricula")
    .select(CURRICULUM_COLUMNS)
    .orderBy("position")
    .orderBy("name")
    .execute();
  return rows.map(toCurriculumDto);
}

/** `GET /studio/curricula` (§7.1): the tree the studio navigates, drafts included. */
export async function listCurriculumTree(): Promise<{ data: CurriculumTreeDto[] }> {
  const [curricula, levels] = await Promise.all([listCurricula(), listLevels()]);

  const byCurriculum = new Map<string, LevelDto[]>();
  for (const level of levels) {
    const siblings = byCurriculum.get(level.curriculumId);
    if (siblings) siblings.push(level);
    else byCurriculum.set(level.curriculumId, [level]);
  }

  return {
    data: curricula.map((curriculum) => ({ ...curriculum, levels: byCurriculum.get(curriculum.id) ?? [] })),
  };
}

export async function createCurriculum(
  actor: Actor,
  input: CurriculumCreateInput,
): Promise<CurriculumDto> {
  const db = await getDb();
  const now = Date.now();
  const slug = resolveSlug(input.name, input.slug);

  return db.transaction().execute(async (trx) => {
    if (await curriculumSlugTaken(trx, slug)) throw slugTaken();

    const row: CurriculumRow = {
      id: uuidv7(now),
      slug,
      name: input.name,
      short_name: input.shortName,
      description_md: input.descriptionMd ?? null,
      status: "draft",
      position: input.position ?? (await nextCurriculumPosition(trx)),
      updated_at: now,
    };

    await trx
      .insertInto("curricula")
      .values({ ...row, created_at: now })
      .execute();
    await recordAudit(
      {
        actorId: actor.id,
        action: "curriculum.create",
        entityType: "curriculum",
        entityId: row.id,
        metadata: { fields: ["slug", "name", "shortName", "position"] },
      },
      trx,
    );

    return toCurriculumDto(row);
  });
}

export async function updateCurriculum(
  actor: Actor,
  id: string,
  input: CurriculumUpdateInput,
): Promise<CurriculumDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("curricula")
      .select(CURRICULUM_COLUMNS)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) throw notFound("curriculum");

    if (existing.updated_at !== Date.parse(input.expectedUpdatedAt)) throw contentConflict();

    const changes: Partial<CurriculumRow> & { updated_at: number } = { updated_at: Date.now() };
    if (input.name !== undefined) changes.name = input.name;
    if (input.shortName !== undefined) changes.short_name = input.shortName;
    if (input.descriptionMd !== undefined) changes.description_md = input.descriptionMd ?? null;
    if (input.position !== undefined) changes.position = input.position;
    if (input.status !== undefined) changes.status = input.status;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      if (await curriculumSlugTaken(trx, input.slug, id)) throw slugTaken();
      changes.slug = input.slug;
    }

    await trx.updateTable("curricula").set(changes).where("id", "=", id).execute();

    // A renamed curriculum moves every path beneath it; one prefix row covers them all.
    if (changes.slug !== undefined) {
      await redirectSlugChange(trx, "curriculum", id, existing.slug, changes.slug, existing.status === "published");
    }

    const row = { ...existing, ...changes } as CurriculumRow;
    const fields = Object.keys(changes).filter((key) => key !== "updated_at");
    await recordAudit(
      {
        actorId: actor.id,
        action: "curriculum.update",
        entityType: "curriculum",
        entityId: id,
        metadata: { fields },
      },
      trx,
    );

    return toCurriculumDto(row);
  });
}

async function reorderCurricula(actor: Actor, input: ReorderInput): Promise<void> {
  const db = await getDb();

  await db.transaction().execute(async (trx) => {
    const rows = await trx.selectFrom("curricula").select("id").execute();
    assertSameSet(rows.map((row) => row.id), input.orderedIds);

    const now = Date.now();
    for (const [index, id] of input.orderedIds.entries()) {
      await trx.updateTable("curricula").set({ position: index, updated_at: now }).where("id", "=", id).execute();
    }

    await recordAudit(
      {
        actorId: actor.id,
        action: "curriculum.reorder",
        entityType: "curriculum",
        entityId: "",
        metadata: { count: input.orderedIds.length },
      },
      trx,
    );
  });
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

type LevelRow = {
  id: string;
  curriculum_id: string;
  slug: string;
  name: string;
  description_md: string | null;
  status: ContentStatus;
  position: number;
  updated_at: number;
};

const LEVEL_COLUMNS = [
  "id",
  "curriculum_id",
  "slug",
  "name",
  "description_md",
  "status",
  "position",
  "updated_at",
] as const;

function toLevelDto(row: LevelRow): LevelDto {
  return {
    id: row.id,
    curriculumId: row.curriculum_id,
    slug: row.slug,
    name: row.name,
    descriptionMd: row.description_md,
    status: row.status,
    position: row.position,
    updatedAt: ISO(row.updated_at),
  };
}

async function levelSlugTaken(
  trx: Trx,
  curriculumId: string,
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const row = await trx
    .selectFrom("education_levels")
    .select("id")
    .where("curriculum_id", "=", curriculumId)
    .where("slug", "=", slug)
    .where("id", "!=", exceptId ?? "")
    .executeTakeFirst();
  return row !== undefined;
}

async function nextLevelPosition(trx: Trx, curriculumId: string): Promise<number> {
  const row = await trx
    .selectFrom("education_levels")
    .select(({ fn }) => fn.max("position").as("max"))
    .where("curriculum_id", "=", curriculumId)
    .executeTakeFirst();
  return Number(row?.max ?? -1) + 1;
}

/** The levels of one curriculum, in `position` order — what the curriculum page lists. */
export async function listLevelsByCurriculum(curriculumId: string): Promise<LevelDto[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("education_levels")
    .select(LEVEL_COLUMNS)
    .where("curriculum_id", "=", curriculumId)
    .orderBy("position")
    .orderBy("name")
    .execute();
  return rows.map(toLevelDto);
}

/** A level for a studio screen, or `null` so the page can answer `notFound()`. */
export async function findLevel(id: string): Promise<LevelDto | null> {
  const db = await getDb();
  const row = await db
    .selectFrom("education_levels")
    .select(LEVEL_COLUMNS)
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? toLevelDto(row) : null;
}

async function listLevels(): Promise<LevelDto[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("education_levels")
    .select(LEVEL_COLUMNS)
    .orderBy("position")
    .orderBy("name")
    .execute();
  return rows.map(toLevelDto);
}

export async function createLevel(
  actor: Actor,
  curriculumId: string,
  input: LevelCreateInput,
): Promise<LevelDto> {
  const db = await getDb();
  const now = Date.now();
  const slug = resolveSlug(input.name, input.slug);

  return db.transaction().execute(async (trx) => {
    const parent = await trx
      .selectFrom("curricula")
      .select("id")
      .where("id", "=", curriculumId)
      .executeTakeFirst();
    if (!parent) throw notFound("curriculum");
    if (await levelSlugTaken(trx, curriculumId, slug)) throw slugTaken();

    const row: LevelRow = {
      id: uuidv7(now),
      curriculum_id: curriculumId,
      slug,
      name: input.name,
      description_md: input.descriptionMd ?? null,
      status: "draft",
      position: input.position ?? (await nextLevelPosition(trx, curriculumId)),
      updated_at: now,
    };

    await trx
      .insertInto("education_levels")
      .values({ ...row, created_at: now })
      .execute();
    await recordAudit(
      {
        actorId: actor.id,
        action: "level.create",
        entityType: "level",
        entityId: row.id,
        metadata: { fields: ["slug", "name", "position"], parentId: curriculumId },
      },
      trx,
    );

    return toLevelDto(row);
  });
}

export async function updateLevel(
  actor: Actor,
  id: string,
  input: LevelUpdateInput,
): Promise<LevelDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("education_levels")
      .select(LEVEL_COLUMNS)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) throw notFound("level");

    if (existing.updated_at !== Date.parse(input.expectedUpdatedAt)) throw contentConflict();

    const changes: Partial<LevelRow> & { updated_at: number } = { updated_at: Date.now() };
    if (input.name !== undefined) changes.name = input.name;
    if (input.descriptionMd !== undefined) changes.description_md = input.descriptionMd ?? null;
    if (input.position !== undefined) changes.position = input.position;
    if (input.status !== undefined) changes.status = input.status;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      if (await levelSlugTaken(trx, existing.curriculum_id, input.slug, id)) throw slugTaken();
      changes.slug = input.slug;
    }

    await trx.updateTable("education_levels").set(changes).where("id", "=", id).execute();

    if (changes.slug !== undefined) {
      await redirectSlugChange(trx, "level", id, existing.slug, changes.slug, existing.status === "published");
    }

    const row = { ...existing, ...changes } as LevelRow;
    const fields = Object.keys(changes).filter((key) => key !== "updated_at");
    await recordAudit(
      {
        actorId: actor.id,
        action: "level.update",
        entityType: "level",
        entityId: id,
        metadata: { fields },
      },
      trx,
    );

    return toLevelDto(row);
  });
}

async function reorderLevels(actor: Actor, curriculumId: string, input: ReorderInput): Promise<void> {
  const db = await getDb();

  await db.transaction().execute(async (trx) => {
    const rows = await trx
      .selectFrom("education_levels")
      .select("id")
      .where("curriculum_id", "=", curriculumId)
      .execute();
    assertSameSet(rows.map((row) => row.id), input.orderedIds);

    const now = Date.now();
    for (const [index, id] of input.orderedIds.entries()) {
      await trx
        .updateTable("education_levels")
        .set({ position: index, updated_at: now })
        .where("id", "=", id)
        .execute();
    }

    await recordAudit(
      {
        actorId: actor.id,
        action: "level.reorder",
        entityType: "level",
        entityId: curriculumId,
        metadata: { count: input.orderedIds.length },
      },
      trx,
    );
  });
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

type SubjectRow = {
  id: string;
  education_level_id: string;
  subject_group_id: string;
  slug: string;
  name: string;
  summary: string | null;
  color_token: string;
  icon_key: string;
  status: ContentStatus;
  published_at: number | null;
  position: number;
  updated_at: number;
};

const SUBJECT_COLUMNS = [
  "id",
  "education_level_id",
  "subject_group_id",
  "slug",
  "name",
  "summary",
  "color_token",
  "icon_key",
  "status",
  "published_at",
  "position",
  "updated_at",
] as const;

function toSubjectDto(row: SubjectRow): SubjectDto {
  return {
    id: row.id,
    educationLevelId: row.education_level_id,
    subjectGroupId: row.subject_group_id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    colorToken: row.color_token,
    iconKey: row.icon_key,
    status: row.status,
    position: row.position,
    updatedAt: ISO(row.updated_at),
  };
}

async function subjectSlugTaken(
  trx: Trx,
  educationLevelId: string,
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const row = await trx
    .selectFrom("subjects")
    .select("id")
    .where("education_level_id", "=", educationLevelId)
    .where("slug", "=", slug)
    .where("id", "!=", exceptId ?? "")
    .executeTakeFirst();
  return row !== undefined;
}

async function nextSubjectPosition(trx: Trx, educationLevelId: string): Promise<number> {
  const row = await trx
    .selectFrom("subjects")
    .select(({ fn }) => fn.max("position").as("max"))
    .where("education_level_id", "=", educationLevelId)
    .executeTakeFirst();
  return Number(row?.max ?? -1) + 1;
}

/**
 * The closed group list a new subject is filed under (`DATABASE_SCHEMA.md` §6.3). Mapped to
 * fresh literals because these rows cross into a Client Component, which only accepts plain
 * objects.
 */
export async function listSubjectGroups(): Promise<SubjectGroupOption[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("subject_groups")
    .select(["id", "slug", "name"])
    .orderBy("position")
    .orderBy("name")
    .execute();
  return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name }));
}

const SUBJECT_SORT = {
  position: "position",
  name: "name",
  updatedAt: "updated_at",
} as const;

export async function listSubjectsAdmin(query: SubjectListQuery): Promise<{
  data: SubjectDto[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}> {
  const db = await getDb();
  const limit = query.limit ?? 20;
  const sort = query.sort ?? "position";
  const dir = query.dir ?? "asc";
  const column = SUBJECT_SORT[sort];

  let builder = db
    .selectFrom("subjects")
    .select(SUBJECT_COLUMNS)
    .orderBy(sql.ref(column), dir)
    .orderBy("id", dir)
    .limit(limit + 1);

  if (query.levelId) builder = builder.where("education_level_id", "=", query.levelId);
  if (query.status) builder = builder.where("status", "=", query.status);
  if (query.q) builder = builder.where("name", "like", `%${query.q}%`);

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    // Keyset on the sort value, with the id as the tie-breaker (§10). Row-value comparison
    // keeps this one predicate instead of an expanding chain of ORs.
    builder = builder.where(
      sql<boolean>`(${sql.ref(column)}, id) ${sql.raw(dir === "asc" ? ">" : "<")} (${cursor.k}, ${cursor.id})`,
    );
  }

  const rows = await builder.execute();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    data: page.map(toSubjectDto),
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && last ? encodeCursor({ k: last[sort === "updatedAt" ? "updated_at" : sort], id: last.id }) : null,
    },
  };
}

/** A subject for a studio screen, or `null` so the page can answer `notFound()`. */
export async function findSubject(id: string): Promise<SubjectDto | null> {
  const db = await getDb();
  const row = await db
    .selectFrom("subjects")
    .select(SUBJECT_COLUMNS)
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? toSubjectDto(row) : null;
}

export async function createSubject(actor: Actor, input: SubjectCreateInput): Promise<SubjectDto> {
  const db = await getDb();
  const now = Date.now();
  const slug = resolveSlug(input.name, input.slug);

  return db.transaction().execute(async (trx) => {
    const level = await trx
      .selectFrom("education_levels")
      .select("id")
      .where("id", "=", input.educationLevelId)
      .executeTakeFirst();
    if (!level) throw notFound("level");

    const group = await trx
      .selectFrom("subject_groups")
      .select("id")
      .where("id", "=", input.subjectGroupId)
      .executeTakeFirst();
    if (!group) throw notFound("subject group");

    if (await subjectSlugTaken(trx, input.educationLevelId, slug)) throw slugTaken();

    const row: SubjectRow = {
      id: uuidv7(now),
      education_level_id: input.educationLevelId,
      subject_group_id: input.subjectGroupId,
      slug,
      name: input.name,
      summary: input.summary ?? null,
      color_token: input.colorToken ?? "cobalt",
      icon_key: input.iconKey ?? "atom",
      status: "draft",
      published_at: null,
      position: input.position ?? (await nextSubjectPosition(trx, input.educationLevelId)),
      updated_at: now,
    };

    await trx
      .insertInto("subjects")
      .values({
        ...row,
        seo_title: input.seoTitle ?? null,
        seo_description: input.seoDescription ?? null,
        created_by: actor.id,
        updated_by: actor.id,
        created_at: now,
      })
      .execute();
    await recordAudit(
      {
        actorId: actor.id,
        action: "subject.create",
        entityType: "subject",
        entityId: row.id,
        metadata: { fields: ["slug", "name", "colorToken", "position"], parentId: input.educationLevelId },
      },
      trx,
    );

    return toSubjectDto(row);
  });
}

export async function updateSubject(
  actor: Actor,
  id: string,
  input: SubjectUpdateInput,
): Promise<SubjectDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("subjects")
      .select(SUBJECT_COLUMNS)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) throw notFound("subject");

    if (existing.updated_at !== Date.parse(input.expectedUpdatedAt)) throw contentConflict();

    const now = Date.now();
    const changes: Partial<SubjectRow> & { updated_at: number; updated_by: string } = {
      updated_at: now,
      updated_by: actor.id,
    };

    if (input.name !== undefined) changes.name = input.name;
    if (input.summary !== undefined) changes.summary = input.summary ?? null;
    if (input.colorToken !== undefined) changes.color_token = input.colorToken;
    if (input.iconKey !== undefined) changes.icon_key = input.iconKey;
    if (input.position !== undefined) changes.position = input.position;
    if (input.status !== undefined) {
      changes.status = input.status;
      // `CHECK (status <> 'published' OR published_at IS NOT NULL)`.
      if (input.status === "published" && existing.published_at === null) changes.published_at = now;
    }
    if (input.slug !== undefined && input.slug !== existing.slug) {
      if (await subjectSlugTaken(trx, existing.education_level_id, input.slug, id)) throw slugTaken();
      changes.slug = input.slug;
    }

    const seo = {
      ...(input.seoTitle !== undefined ? { seo_title: input.seoTitle ?? null } : {}),
      ...(input.seoDescription !== undefined ? { seo_description: input.seoDescription ?? null } : {}),
    };

    await trx
      .updateTable("subjects")
      .set({ ...changes, ...seo })
      .where("id", "=", id)
      .execute();

    if (changes.slug !== undefined) {
      await redirectSlugChange(trx, "subject", id, existing.slug, changes.slug, existing.status === "published");
    }

    const row = { ...existing, ...changes } as SubjectRow;
    const fields = Object.keys({ ...changes, ...seo }).filter(
      (key) => key !== "updated_at" && key !== "updated_by",
    );
    await recordAudit(
      {
        actorId: actor.id,
        action: "subject.update",
        entityType: "subject",
        entityId: id,
        metadata: { fields },
      },
      trx,
    );

    return toSubjectDto(row);
  });
}

async function reorderSubjects(actor: Actor, levelId: string, input: ReorderInput): Promise<void> {
  const db = await getDb();

  await db.transaction().execute(async (trx) => {
    const rows = await trx
      .selectFrom("subjects")
      .select("id")
      .where("education_level_id", "=", levelId)
      .execute();
    assertSameSet(rows.map((row) => row.id), input.orderedIds);

    const now = Date.now();
    for (const [index, id] of input.orderedIds.entries()) {
      await trx
        .updateTable("subjects")
        .set({ position: index, updated_at: now, updated_by: actor.id })
        .where("id", "=", id)
        .execute();
    }

    await recordAudit(
      {
        actorId: actor.id,
        action: "subject.reorder",
        entityType: "subject",
        entityId: levelId,
        metadata: { count: input.orderedIds.length },
      },
      trx,
    );
  });
}

// ---------------------------------------------------------------------------
// Chapters and topics: the studio shell's read side
// ---------------------------------------------------------------------------

type ChapterRow = {
  id: string;
  subject_id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: ContentStatus;
  position: number;
  updated_at: number;
};

const CHAPTER_COLUMNS = [
  "id",
  "subject_id",
  "slug",
  "title",
  "summary",
  "status",
  "position",
  "updated_at",
] as const;

function toChapterDto(row: ChapterRow): ChapterDto {
  return {
    id: row.id,
    subjectId: row.subject_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    position: row.position,
    updatedAt: ISO(row.updated_at),
  };
}

/**
 * A complete, ordered set rather than a page: a subject has a handful of chapters, and the
 * shell renders and reorders all of them. `subject_id` leads the ordering so an unfiltered
 * read still groups chapters under their subject.
 */
export async function listChaptersAdmin(query: ChapterListQuery): Promise<{ data: ChapterDto[] }> {
  const db = await getDb();

  let builder = db
    .selectFrom("chapters")
    .select(CHAPTER_COLUMNS)
    .orderBy("subject_id")
    .orderBy("position")
    .orderBy("title");
  if (query.subjectId) builder = builder.where("subject_id", "=", query.subjectId);

  const rows = await builder.execute();
  return { data: rows.map(toChapterDto) };
}

async function chapterSlugTaken(
  trx: Trx,
  subjectId: string,
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const row = await trx
    .selectFrom("chapters")
    .select("id")
    .where("subject_id", "=", subjectId)
    .where("slug", "=", slug)
    .where("id", "!=", exceptId ?? "")
    .executeTakeFirst();
  return row !== undefined;
}

async function nextChapterPosition(trx: Trx, subjectId: string): Promise<number> {
  const row = await trx
    .selectFrom("chapters")
    .select(({ fn }) => fn.max("position").as("max"))
    .where("subject_id", "=", subjectId)
    .executeTakeFirst();
  return Number(row?.max ?? -1) + 1;
}

export async function createChapter(actor: Actor, input: ChapterCreateInput): Promise<ChapterDto> {
  const db = await getDb();
  const now = Date.now();
  const slug = resolveSlug(input.title, input.slug);

  return db.transaction().execute(async (trx) => {
    const subject = await trx
      .selectFrom("subjects")
      .select("id")
      .where("id", "=", input.subjectId)
      .executeTakeFirst();
    if (!subject) throw notFound("subject");
    if (await chapterSlugTaken(trx, input.subjectId, slug)) throw slugTaken();

    const row: ChapterRow = {
      id: uuidv7(now),
      subject_id: input.subjectId,
      slug,
      title: input.title,
      summary: input.summary ?? null,
      status: "draft",
      position: input.position ?? (await nextChapterPosition(trx, input.subjectId)),
      updated_at: now,
    };

    await trx
      .insertInto("chapters")
      .values({
        ...row,
        published_at: null,
        created_by: actor.id,
        updated_by: actor.id,
        created_at: now,
      })
      .execute();
    await recordAudit(
      {
        actorId: actor.id,
        action: "chapter.create",
        entityType: "chapter",
        entityId: row.id,
        metadata: { fields: ["slug", "title", "position"], parentId: input.subjectId },
      },
      trx,
    );

    return toChapterDto(row);
  });
}

export async function updateChapter(
  actor: Actor,
  id: string,
  input: ChapterUpdateInput,
): Promise<ChapterDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("chapters")
      .select(CHAPTER_COLUMNS)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) throw notFound("chapter");

    if (existing.updated_at !== Date.parse(input.expectedUpdatedAt)) throw contentConflict();

    const now = Date.now();
    const changes: Partial<ChapterRow> & { updated_at: number; updated_by: string } = {
      updated_at: now,
      updated_by: actor.id,
    };

    if (input.title !== undefined) changes.title = input.title;
    if (input.summary !== undefined) changes.summary = input.summary ?? null;
    if (input.position !== undefined) changes.position = input.position;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      if (await chapterSlugTaken(trx, existing.subject_id, input.slug, id)) throw slugTaken();
      changes.slug = input.slug;
    }

    await trx.updateTable("chapters").set(changes).where("id", "=", id).execute();

    if (changes.slug !== undefined) {
      await redirectSlugChange(trx, "chapter", id, existing.slug, changes.slug, existing.status === "published");
    }

    const row = { ...existing, ...changes } as ChapterRow;
    const fields = Object.keys(changes).filter((key) => key !== "updated_at" && key !== "updated_by");
    await recordAudit(
      { actorId: actor.id, action: "chapter.update", entityType: "chapter", entityId: id, metadata: { fields } },
      trx,
    );

    return toChapterDto(row);
  });
}

/** A chapter for a studio screen, or `null` so the page can answer `notFound()`. */
export async function findChapter(id: string): Promise<ChapterDto | null> {
  const db = await getDb();
  const row = await db
    .selectFrom("chapters")
    .select(CHAPTER_COLUMNS)
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? toChapterDto(row) : null;
}

type TopicRow = {
  id: string;
  chapter_id: string;
  slug: string;
  title: string;
  summary: string | null;
  learning_objectives: string;
  estimated_minutes: number | null;
  status: ContentStatus;
  position: number;
  updated_at: number;
};

const TOPIC_COLUMNS = [
  "id",
  "chapter_id",
  "slug",
  "title",
  "summary",
  "learning_objectives",
  "estimated_minutes",
  "status",
  "position",
  "updated_at",
] as const;

/** `learning_objectives` is JSON text (`DATABASE_SCHEMA.md` §6.6); the API returns the array. */
function toObjectives(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function toTopicDto(row: TopicRow): TopicDto {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    learningObjectives: toObjectives(row.learning_objectives),
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
    position: row.position,
    updatedAt: ISO(row.updated_at),
  };
}

/** `GET /studio/topics` (§7.1): `chapterId`, `status` and a title search, in `position` order. */
export async function listTopicsAdmin(query: TopicListQuery): Promise<{ data: TopicDto[] }> {
  const db = await getDb();

  let builder = db
    .selectFrom("topics")
    .select(TOPIC_COLUMNS)
    .orderBy("chapter_id")
    .orderBy("position")
    .orderBy("title");

  if (query.chapterId) builder = builder.where("chapter_id", "=", query.chapterId);
  if (query.status) builder = builder.where("status", "=", query.status);
  if (query.q) builder = builder.where("title", "like", `%${query.q}%`);

  const rows = await builder.execute();
  return { data: rows.map(toTopicDto) };
}

async function topicSlugTaken(
  trx: Trx,
  chapterId: string,
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const row = await trx
    .selectFrom("topics")
    .select("id")
    .where("chapter_id", "=", chapterId)
    .where("slug", "=", slug)
    .where("id", "!=", exceptId ?? "")
    .executeTakeFirst();
  return row !== undefined;
}

async function nextTopicPosition(trx: Trx, chapterId: string): Promise<number> {
  const row = await trx
    .selectFrom("topics")
    .select(({ fn }) => fn.max("position").as("max"))
    .where("chapter_id", "=", chapterId)
    .executeTakeFirst();
  return Number(row?.max ?? -1) + 1;
}

/** A topic for a studio screen, or `null` so the page can answer `notFound()`. */
export async function findTopic(id: string): Promise<TopicDto | null> {
  const db = await getDb();
  const row = await db.selectFrom("topics").select(TOPIC_COLUMNS).where("id", "=", id).executeTakeFirst();
  return row ? toTopicDto(row) : null;
}

export async function createTopic(actor: Actor, input: TopicCreateInput): Promise<TopicDto> {
  const db = await getDb();
  const now = Date.now();
  const slug = resolveSlug(input.title, input.slug);

  return db.transaction().execute(async (trx) => {
    const chapter = await trx
      .selectFrom("chapters")
      .select("id")
      .where("id", "=", input.chapterId)
      .executeTakeFirst();
    if (!chapter) throw notFound("chapter");
    if (await topicSlugTaken(trx, input.chapterId, slug)) throw slugTaken();

    const row: TopicRow = {
      id: uuidv7(now),
      chapter_id: input.chapterId,
      slug,
      title: input.title,
      summary: input.summary ?? null,
      learning_objectives: JSON.stringify(input.learningObjectives),
      estimated_minutes: input.estimatedMinutes ?? null,
      status: "draft",
      position: input.position ?? (await nextTopicPosition(trx, input.chapterId)),
      updated_at: now,
    };

    await trx
      .insertInto("topics")
      .values({
        ...row,
        published_at: null,
        created_by: actor.id,
        updated_by: actor.id,
        created_at: now,
      })
      .execute();
    await recordAudit(
      {
        actorId: actor.id,
        action: "topic.create",
        entityType: "topic",
        entityId: row.id,
        metadata: { fields: ["slug", "title", "learningObjectives", "position"], parentId: input.chapterId },
      },
      trx,
    );

    return toTopicDto(row);
  });
}

export async function updateTopic(
  actor: Actor,
  id: string,
  input: TopicUpdateInput,
): Promise<TopicDto> {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("topics")
      .select(TOPIC_COLUMNS)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) throw notFound("topic");

    if (existing.updated_at !== Date.parse(input.expectedUpdatedAt)) throw contentConflict();

    const now = Date.now();
    const changes: Partial<TopicRow> & { updated_at: number; updated_by: string } = {
      updated_at: now,
      updated_by: actor.id,
    };

    if (input.title !== undefined) changes.title = input.title;
    if (input.summary !== undefined) changes.summary = input.summary ?? null;
    if (input.estimatedMinutes !== undefined) changes.estimated_minutes = input.estimatedMinutes ?? null;
    if (input.learningObjectives !== undefined) {
      changes.learning_objectives = JSON.stringify(input.learningObjectives);
    }
    if (input.position !== undefined) changes.position = input.position;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      if (await topicSlugTaken(trx, existing.chapter_id, input.slug, id)) throw slugTaken();
      changes.slug = input.slug;
    }

    await trx.updateTable("topics").set(changes).where("id", "=", id).execute();

    if (changes.slug !== undefined) {
      await redirectSlugChange(trx, "topic", id, existing.slug, changes.slug, existing.status === "published");
    }

    const row = { ...existing, ...changes } as TopicRow;
    const fields = Object.keys(changes).filter((key) => key !== "updated_at" && key !== "updated_by");
    await recordAudit(
      { actorId: actor.id, action: "topic.update", entityType: "topic", entityId: id, metadata: { fields } },
      trx,
    );

    return toTopicDto(row);
  });
}

// ---------------------------------------------------------------------------
// Shared: ordering sets and archiving
// ---------------------------------------------------------------------------

/** The client must send every sibling exactly once, or a position would be lost or doubled. */
function assertSameSet(current: readonly string[], ordered: readonly string[]): void {
  const currentSet = new Set(current);
  const unique = new Set(ordered);

  if (unique.size !== ordered.length || currentSet.size !== unique.size || [...currentSet].some((id) => !unique.has(id))) {
    throw new HttpError(422, "VALIDATION_ERROR", "Send every sibling exactly once.", [
      {
        path: "orderedIds",
        code: "invalid_set",
        message: "The ordered list must contain every sibling id and nothing else.",
      },
    ]);
  }
}

export type ArchiveEntity = "curricula" | "levels" | "subjects";

/**
 * `DELETE /studio/{entity}/{id}` is an archive, never a row delete (§7.1): published children
 * block it, and the audit row records the transition.
 */
export async function archiveEntity(entity: ArchiveEntity, id: string, actor: Actor): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.transaction().execute(async (trx) => {
    if (entity === "curricula") {
      const row = await trx
        .selectFrom("curricula")
        .select(["id", "status"])
        .where("id", "=", id)
        .executeTakeFirst();
      if (!row) throw notFound("curriculum");
      const published = await trx
        .selectFrom("education_levels")
        .select("id")
        .where("curriculum_id", "=", id)
        .where("status", "=", "published")
        .executeTakeFirst();
      if (published) throw archivedChildren("curriculum");

      await trx.updateTable("curricula").set({ status: "archived", updated_at: now }).where("id", "=", id).execute();
      await recordAudit(
        { actorId: actor.id, action: "curriculum.archive", entityType: "curriculum", entityId: id, metadata: { from: row.status, to: "archived" } },
        trx,
      );
      return;
    }

    if (entity === "levels") {
      const row = await trx
        .selectFrom("education_levels")
        .select(["id", "status"])
        .where("id", "=", id)
        .executeTakeFirst();
      if (!row) throw notFound("level");
      const published = await trx
        .selectFrom("subjects")
        .select("id")
        .where("education_level_id", "=", id)
        .where("status", "=", "published")
        .executeTakeFirst();
      if (published) throw archivedChildren("level");

      await trx
        .updateTable("education_levels")
        .set({ status: "archived", updated_at: now })
        .where("id", "=", id)
        .execute();
      await recordAudit(
        { actorId: actor.id, action: "level.archive", entityType: "level", entityId: id, metadata: { from: row.status, to: "archived" } },
        trx,
      );
      return;
    }

    const row = await trx
      .selectFrom("subjects")
      .select(["id", "status"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) throw notFound("subject");
    const published = await trx
      .selectFrom("chapters")
      .select("id")
      .where("subject_id", "=", id)
      .where("status", "=", "published")
      .executeTakeFirst();
    if (published) throw archivedChildren("subject");

    await trx
      .updateTable("subjects")
      .set({ status: "archived", updated_at: now, updated_by: actor.id })
      .where("id", "=", id)
      .execute();
    await recordAudit(
      { actorId: actor.id, action: "subject.archive", entityType: "subject", entityId: id, metadata: { from: row.status, to: "archived" } },
      trx,
    );
  });
}

/** `POST /studio/{entity}/reorder`: one entry point, three parent rules. */
export async function reorderEntity(
  entity: ArchiveEntity,
  actor: Actor,
  input: ReorderInput,
): Promise<void> {
  if (entity === "curricula") return reorderCurricula(actor, input);

  if (!input.parentId) {
    throw new HttpError(422, "VALIDATION_ERROR", "`parentId` is required for this reorder.", [
      { path: "parentId", code: "required", message: "Send the parent id whose children are being ordered." },
    ]);
  }

  if (entity === "levels") return reorderLevels(actor, input.parentId, input);
  return reorderSubjects(actor, input.parentId, input);
}
