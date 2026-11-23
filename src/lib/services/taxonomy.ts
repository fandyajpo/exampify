import "server-only";

import { getDb } from "@/lib/db";
import { toSubjectColor, type SubjectColor } from "@/lib/subject-colors";
import { url } from "@/lib/urls";

/**
 * Public taxonomy reads (`INFORMATION_ARCHITECTURE.md` §4, `API_CONTRACTS.md` discovery
 * endpoints). Every query filters on `status = 'published'`, so drafts cannot leak into a
 * public page — the rule is enforced at the read path, not by the caller.
 *
 * Paths are built here because they are canonical IA routes, not presentation choices.
 */

export type SubjectListItem = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  color: SubjectColor;
  iconKey: string;
  groupSlug: string;
  groupName: string;
  levelSlug: string;
  levelName: string;
  href: string;
};

export type SubjectDetail = SubjectListItem & {
  curriculumSlug: string;
  curriculumName: string;
  curriculumShort: string;
  seoTitle: string | null;
  seoDescription: string | null;
  chapters: ChapterSummary[];
};

export type ChapterSummary = {
  slug: string;
  title: string;
  summary: string | null;
  topics: TopicSummary[];
};

export type TopicSummary = {
  slug: string;
  title: string;
  summary: string | null;
  estimatedMinutes: number | null;
};

const BASE_SELECT = [
  "s.id as id",
  "s.slug as slug",
  "s.name as name",
  "s.summary as summary",
  "s.color_token as color_token",
  "s.icon_key as icon_key",
  "s.seo_title as seo_title",
  "s.seo_description as seo_description",
  "g.slug as group_slug",
  "g.name as group_name",
  "l.slug as level_slug",
  "l.name as level_name",
  "c.short_name as curriculum_short",
  "c.name as curriculum_name",
  "c.slug as curriculum_slug",
] as const;

type Row = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  color_token: string;
  icon_key: string;
  seo_title: string | null;
  seo_description: string | null;
  group_slug: string;
  group_name: string;
  level_slug: string;
  level_name: string;
  curriculum_slug: string;
  curriculum_short: string;
  curriculum_name: string;
};

function toListItem(row: Row): SubjectListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    color: toSubjectColor(row.color_token),
    iconKey: row.icon_key,
    groupSlug: row.group_slug,
    groupName: row.group_name,
    levelSlug: row.level_slug,
    levelName: row.level_name,
    href: url.subject(row.curriculum_slug, row.level_slug, row.slug),
  };
}

const PUBLISHED = "published" as const;

/** Every published subject, in catalogue order. One query, three joins. */
export async function listPublishedSubjects(): Promise<SubjectListItem[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("subjects as s")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .innerJoin("subject_groups as g", "g.id", "s.subject_group_id")
    .select(BASE_SELECT)
    .where("s.status", "=", PUBLISHED)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .orderBy("s.position")
    .orderBy("s.name")
    .execute();

  return rows.map(toListItem);
}

/** The homepage's three cards: the first published subjects in catalogue order. */
export async function listPopularSubjects(limit = 3): Promise<SubjectListItem[]> {
  const subjects = await listPublishedSubjects();
  return subjects.slice(0, limit);
}

export type LevelGroup = {
  levelSlug: string;
  levelName: string;
  curriculumSlug: string;
  curriculumName: string;
  subjects: SubjectListItem[];
};

/** Subjects grouped by level for the directory, ordered by level position then subject. */
export async function listSubjectsByLevel(): Promise<LevelGroup[]> {
  const db = await getDb();
  const levels = await db
    .selectFrom("education_levels as l")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      "l.id as id",
      "l.slug as level_slug",
      "l.name as level_name",
      "c.slug as curriculum_slug",
      "c.name as curriculum_name",
    ])
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .orderBy("l.position")
    .execute();

  const subjects = await listPublishedSubjects();
  const byLevel = new Map<string, SubjectListItem[]>();
  for (const subject of subjects) {
    const bucket = byLevel.get(subject.levelSlug);
    if (bucket) bucket.push(subject);
    else byLevel.set(subject.levelSlug, [subject]);
  }

  return levels.map((level) => ({
    levelSlug: level.level_slug,
    levelName: level.level_name,
    curriculumSlug: level.curriculum_slug,
    curriculumName: level.curriculum_name,
    subjects: byLevel.get(level.level_slug) ?? [],
  }));
}

/** One subject with its published chapters and topics, or `null` when nothing matches. */
export async function getSubjectDetail(
  curriculumSlug: string,
  levelSlug: string,
  subjectSlug: string,
): Promise<SubjectDetail | null> {
  const db = await getDb();

  const row = await db
    .selectFrom("subjects as s")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .innerJoin("subject_groups as g", "g.id", "s.subject_group_id")
    .select(BASE_SELECT)
    .where("c.slug", "=", curriculumSlug)
    .where("l.slug", "=", levelSlug)
    .where("s.slug", "=", subjectSlug)
    .where("s.status", "=", PUBLISHED)
    .where("l.status", "=", PUBLISHED)
    .where("c.status", "=", PUBLISHED)
    .executeTakeFirst();

  if (!row) return null;

  const chapterRows = await db
    .selectFrom("chapters")
    .select(["id", "slug", "title", "summary", "position"])
    .where("subject_id", "=", row.id)
    .where("status", "=", PUBLISHED)
    .orderBy("position")
    .execute();

  const chapterIds = chapterRows.map((chapter) => chapter.id);
  const topicRows =
    chapterIds.length > 0
      ? await db
          .selectFrom("topics")
          .select(["chapter_id", "slug", "title", "summary", "estimated_minutes", "position"])
          .where("chapter_id", "in", chapterIds)
          .where("status", "=", PUBLISHED)
          .orderBy("position")
          .execute()
      : [];

  const topicsByChapter = new Map<string, TopicSummary[]>();
  for (const topic of topicRows) {
    const list = topicsByChapter.get(topic.chapter_id) ?? [];
    list.push({
      slug: topic.slug,
      title: topic.title,
      summary: topic.summary,
      estimatedMinutes: topic.estimated_minutes,
    });
    topicsByChapter.set(topic.chapter_id, list);
  }

  return {
    ...toListItem(row),
    curriculumSlug: row.curriculum_slug,
    curriculumName: row.curriculum_name,
    curriculumShort: row.curriculum_short,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    chapters: chapterRows.map((chapter) => ({
      slug: chapter.slug,
      title: chapter.title,
      summary: chapter.summary,
      topics: topicsByChapter.get(chapter.id) ?? [],
    })),
  };
}
