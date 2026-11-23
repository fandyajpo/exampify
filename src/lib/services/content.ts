import "server-only";

import { getDb } from "@/lib/db";
import { listPublishedSubjects, type SubjectListItem } from "@/lib/services/taxonomy";
import { url } from "@/lib/urls";
import { parseBlock, type BlockPayload } from "@/lib/validation/blocks";

/**
 * Reading-path service (`INFORMATION_ARCHITECTURE.md` §4.1). Every query filters on
 * published status at every level of the hierarchy, so a draft curriculum, chapter or
 * resource cannot be reached by guessing a URL.
 *
 * `url` is re-exported for existing page imports; the definitions live in `lib/urls.ts` so
 * the sitemap and the taxonomy read the same helpers.
 */
export { url } from "@/lib/urls";

const PUBLISHED = "published" as const;

export type CurriculumDetail = {
  slug: string;
  name: string;
  shortName: string;
  description: string | null;
  levels: Array<{ slug: string; name: string; description: string | null; subjectCount: number }>;
};

export async function getCurriculumDetail(slug: string): Promise<CurriculumDetail | null> {
  const db = await getDb();
  const curriculum = await db
    .selectFrom("curricula")
    .select(["id", "slug", "name", "short_name", "description_md"])
    .where("slug", "=", slug)
    .where("status", "=", PUBLISHED)
    .executeTakeFirst();
  if (!curriculum) return null;

  const levels = await db
    .selectFrom("education_levels")
    .select(["slug", "name", "description_md"])
    .where("curriculum_id", "=", curriculum.id)
    .where("status", "=", PUBLISHED)
    .orderBy("position")
    .execute();

  const subjects = await listPublishedSubjects();
  const counts = new Map<string, number>();
  for (const subject of subjects) {
    counts.set(subject.levelSlug, (counts.get(subject.levelSlug) ?? 0) + 1);
  }

  return {
    slug: curriculum.slug,
    name: curriculum.name,
    shortName: curriculum.short_name,
    description: curriculum.description_md,
    levels: levels.map((level) => ({
      slug: level.slug,
      name: level.name,
      description: level.description_md,
      subjectCount: counts.get(level.slug) ?? 0,
    })),
  };
}

export type LevelDetail = {
  curriculum: { slug: string; name: string };
  level: { slug: string; name: string; description: string | null };
  groups: Array<{ slug: string; name: string; subjects: SubjectListItem[] }>;
};

export async function getLevelDetail(
  curriculumSlug: string,
  levelSlug: string,
): Promise<LevelDetail | null> {
  const db = await getDb();
  const level = await db
    .selectFrom("education_levels as l")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      "l.slug as level_slug",
      "l.name as level_name",
      "l.description_md as level_description",
      "c.slug as curriculum_slug",
      "c.name as curriculum_name",
    ])
    .where("c.slug", "=", curriculumSlug)
    .where("l.slug", "=", levelSlug)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .executeTakeFirst();
  if (!level) return null;

  const groupRows = await db
    .selectFrom("subject_groups")
    .select(["slug", "name", "position"])
    .orderBy("position")
    .execute();

  const subjects = (await listPublishedSubjects()).filter(
    (subject) => subject.levelSlug === levelSlug,
  );

  const groups = groupRows
    .map((group) => ({
      slug: group.slug,
      name: group.name,
      subjects: subjects.filter((subject) => subject.groupSlug === group.slug),
    }))
    .filter((group) => group.subjects.length > 0);

  return {
    curriculum: { slug: level.curriculum_slug, name: level.curriculum_name },
    level: {
      slug: level.level_slug,
      name: level.level_name,
      description: level.level_description,
    },
    groups,
  };
}

export type ReadContext = {
  curriculum: { slug: string; name: string };
  level: { slug: string; name: string };
  subject: { slug: string; name: string };
};

const contextSelect = [
  "c.slug as curriculum_slug",
  "c.name as curriculum_name",
  "l.slug as level_slug",
  "l.name as level_name",
  "s.slug as subject_slug",
  "s.name as subject_name",
] as const;

type ContextRow = {
  curriculum_slug: string;
  curriculum_name: string;
  level_slug: string;
  level_name: string;
  subject_slug: string;
  subject_name: string;
};

function toContext(row: ContextRow): ReadContext {
  return {
    curriculum: { slug: row.curriculum_slug, name: row.curriculum_name },
    level: { slug: row.level_slug, name: row.level_name },
    subject: { slug: row.subject_slug, name: row.subject_name },
  };
}

export type ChapterPage = {
  context: ReadContext;
  chapter: { slug: string; title: string; summary: string | null };
  topics: Array<{
    slug: string;
    title: string;
    summary: string | null;
    estimatedMinutes: number | null;
    href: string;
  }>;
};

export async function getChapterPage(
  curriculumSlug: string,
  levelSlug: string,
  subjectSlug: string,
  chapterSlug: string,
): Promise<ChapterPage | null> {
  const db = await getDb();
  const chapter = await db
    .selectFrom("chapters as ch")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([...contextSelect, "ch.id as chapter_id", "ch.slug as chapter_slug", "ch.title as chapter_title", "ch.summary as chapter_summary"])
    .where("c.slug", "=", curriculumSlug)
    .where("l.slug", "=", levelSlug)
    .where("s.slug", "=", subjectSlug)
    .where("ch.slug", "=", chapterSlug)
    .where("ch.status", "=", PUBLISHED)
    .where("s.status", "=", PUBLISHED)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .executeTakeFirst();
  if (!chapter) return null;

  const topics = await db
    .selectFrom("topics")
    .select(["slug", "title", "summary", "estimated_minutes"])
    .where("chapter_id", "=", chapter.chapter_id)
    .where("status", "=", PUBLISHED)
    .orderBy("position")
    .execute();

  const context = toContext(chapter);
  return {
    context,
    chapter: {
      slug: chapter.chapter_slug,
      title: chapter.chapter_title,
      summary: chapter.chapter_summary,
    },
    topics: topics.map((topic) => ({
      slug: topic.slug,
      title: topic.title,
      summary: topic.summary,
      estimatedMinutes: topic.estimated_minutes,
      href: url.topic(
        context.curriculum.slug,
        context.level.slug,
        context.subject.slug,
        chapter.chapter_slug,
        topic.slug,
      ),
    })),
  };
}

export type TopicPage = {
  context: ReadContext;
  chapter: { slug: string; title: string };
  topic: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    objectives: string[];
    estimatedMinutes: number | null;
  };
  resources: Array<{ slug: string; title: string; summary: string | null; readingMinutes: number; href: string }>;
};

export async function getTopicPage(
  curriculumSlug: string,
  levelSlug: string,
  subjectSlug: string,
  chapterSlug: string,
  topicSlug: string,
): Promise<TopicPage | null> {
  const db = await getDb();
  const topic = await db
    .selectFrom("topics as t")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      ...contextSelect,
      "ch.slug as chapter_slug",
      "ch.title as chapter_title",
      "t.id as topic_id",
      "t.slug as topic_slug",
      "t.title as topic_title",
      "t.summary as topic_summary",
      "t.learning_objectives as topic_objectives",
      "t.estimated_minutes as topic_minutes",
    ])
    .where("c.slug", "=", curriculumSlug)
    .where("l.slug", "=", levelSlug)
    .where("s.slug", "=", subjectSlug)
    .where("ch.slug", "=", chapterSlug)
    .where("t.slug", "=", topicSlug)
    .where("t.status", "=", PUBLISHED)
    .where("ch.status", "=", PUBLISHED)
    .where("s.status", "=", PUBLISHED)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .executeTakeFirst();
  if (!topic) return null;

  const resources = await db
    .selectFrom("learning_resources")
    .select(["slug", "title", "summary", "reading_minutes"])
    .where("topic_id", "=", topic.topic_id)
    .where("status", "=", PUBLISHED)
    .orderBy("position")
    .execute();

  const context = toContext(topic);
  let objectives: string[] = [];
  try {
    const parsed: unknown = JSON.parse(topic.topic_objectives);
    if (Array.isArray(parsed)) {
      objectives = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    objectives = [];
  }

  return {
    context,
    chapter: { slug: topic.chapter_slug, title: topic.chapter_title },
    topic: {
      id: topic.topic_id,
      slug: topic.topic_slug,
      title: topic.topic_title,
      summary: topic.topic_summary,
      objectives,
      estimatedMinutes: topic.topic_minutes,
    },
    resources: resources.map((resource) => ({
      slug: resource.slug,
      title: resource.title,
      summary: resource.summary,
      readingMinutes: resource.reading_minutes,
      href: url.resource(
        context.curriculum.slug,
        context.level.slug,
        context.subject.slug,
        topic.chapter_slug,
        topic.topic_slug,
        resource.slug,
      ),
    })),
  };
}

export type ResourcePage = {
  context: ReadContext;
  chapter: { slug: string; title: string };
  topic: { id: string; slug: string; title: string };
  resource: {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    summary: string | null;
    readingMinutes: number;
    difficulty: string;
  };
  blocks: BlockPayload[];
  media: Record<string, { url: string; alt: string }>;
};

export async function getResourcePage(
  curriculumSlug: string,
  levelSlug: string,
  subjectSlug: string,
  chapterSlug: string,
  topicSlug: string,
  resourceSlug: string,
): Promise<ResourcePage | null> {
  const db = await getDb();
  const resource = await db
    .selectFrom("learning_resources as r")
    .innerJoin("topics as t", "t.id", "r.topic_id")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      ...contextSelect,
      "ch.slug as chapter_slug",
      "ch.title as chapter_title",
      "t.id as topic_id",
      "t.slug as topic_slug",
      "t.title as topic_title",
      "r.id as resource_id",
      "r.slug as resource_slug",
      "r.title as resource_title",
      "r.subtitle as resource_subtitle",
      "r.summary as resource_summary",
      "r.reading_minutes as reading_minutes",
      "r.difficulty as difficulty",
    ])
    .where("c.slug", "=", curriculumSlug)
    .where("l.slug", "=", levelSlug)
    .where("s.slug", "=", subjectSlug)
    .where("ch.slug", "=", chapterSlug)
    .where("t.slug", "=", topicSlug)
    .where("r.slug", "=", resourceSlug)
    .where("r.status", "=", PUBLISHED)
    .where("t.status", "=", PUBLISHED)
    .where("ch.status", "=", PUBLISHED)
    .where("s.status", "=", PUBLISHED)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .executeTakeFirst();
  if (!resource) return null;

  const blockRows = await db
    .selectFrom("content_blocks")
    .select(["kind", "payload"])
    .where("resource_id", "=", resource.resource_id)
    .orderBy("position")
    .execute();

  const blocks = blockRows
    .map((row) => parseBlock(row.kind, row.payload))
    .filter((block): block is BlockPayload => block !== null);

  const mediaIds = blocks.flatMap((block) => {
    if (block.kind === "image" || block.kind === "download") return [block.payload.mediaId];
    return [];
  });

  const media: Record<string, { url: string; alt: string }> = {};
  if (mediaIds.length > 0) {
    const assets = await db
      .selectFrom("media_assets")
      .select(["id", "public_url", "alt_text"])
      .where("id", "in", mediaIds)
      .where("status", "=", "ready")
      .execute();
    for (const asset of assets) {
      if (asset.public_url) {
        media[asset.id] = { url: asset.public_url, alt: asset.alt_text };
      }
    }
  }

  return {
    context: toContext(resource),
    chapter: { slug: resource.chapter_slug, title: resource.chapter_title },
    topic: { id: resource.topic_id, slug: resource.topic_slug, title: resource.topic_title },
    resource: {
      id: resource.resource_id,
      slug: resource.resource_slug,
      title: resource.resource_title,
      subtitle: resource.resource_subtitle,
      summary: resource.resource_summary,
      readingMinutes: resource.reading_minutes,
      difficulty: resource.difficulty,
    },
    blocks,
    media,
  };
}
