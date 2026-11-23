/**
 * Idempotent Phase 1 seed: `bun run db:seed` after `bun run db:migrate`.
 *
 * Every row gets a deterministic id derived from its slug path, so re-running updates the
 * same rows instead of duplicating them. This is fixture data for development and preview;
 * real content is authored in the studio (Phase 2).
 */
import { createClient, type Config } from "@libsql/client";

import { SEED_CURRICULUM, SEED_GROUPS, SEED_LEVELS, SEED_SUBJECTS } from "../src/lib/db/seed-data";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  throw new Error("TURSO_DATABASE_URL is required (see .env.example).");
}

const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient((authToken ? { url, authToken } : { url }) as Config);

type Row = Record<string, string | number | null>;

async function upsert(table: string, row: Row): Promise<void> {
  const columns = Object.keys(row);
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");

  await client.execute({
    sql:
      `INSERT INTO ${table} (${columns.join(", ")}) ` +
      `VALUES (${columns.map(() => "?").join(", ")}) ` +
      `ON CONFLICT(id) DO UPDATE SET ${updates}`,
    args: columns.map((column) => row[column] ?? null),
  });
}

const now = Date.now();
const id = (...parts: string[]) => `seed-${parts.join("-")}`;

type SeedBlock = { kind: string; payload: Record<string, unknown> };

/** One readable Markdown block per resource, so every page has content to render. */
function baseBlocks(topicTitle: string, summary: string, objectives: string[]): SeedBlock[] {
  const list = objectives.map((objective) => `- ${objective}`).join("\n");
  return [
    {
      kind: "rich_text",
      payload: {
        v: 1,
        markdown:
          `## ${topicTitle}\n\n` +
          `${summary} This page is **study material**: it is complete on its own, and you do ` +
          `not have to answer a question to finish it.\n\n` +
          `By the end of this page you should be able to:\n\n${list}\n\n` +
          `Read the definitions first, then the worked example. The practice set for this ` +
          `topic arrives with the question bank.`,
      },
    },
  ];
}

/** A resource that exercises every block type the renderer supports. */
function showcaseBlocks(topicTitle: string): SeedBlock[] {
  return [
    { kind: "heading", payload: { v: 1, level: 2, text: "A worked example", anchor: "worked-example" } },
    {
      kind: "rich_text",
      payload: {
        v: 1,
        markdown:
          `Mitochondria are the site of aerobic respiration. Their inner membrane is folded ` +
          `into cristae, which increases the surface area available for the reactions that ` +
          `produce ATP.\n\n` +
          `| Structure | Function |\n| --- | --- |\n| Cristae | Increase surface area |\n| Matrix | Contains enzymes and DNA |\n\n` +
          `> A cell that needs a lot of energy, such as a muscle fibre, has many mitochondria.`,
      },
    },
    {
      kind: "callout",
      payload: {
        v: 1,
        tone: "examtip",
        markdown:
          "Describe the **structure** before the function. Marks are usually awarded for the link, not the label.",
      },
    },
    {
      kind: "formula",
      payload: { v: 1, latex: "\\text{rate} = \\frac{\\Delta \\text{product}}{\\Delta t}", displayMode: true },
    },
    {
      kind: "table",
      payload: {
        v: 1,
        caption: "Organelles and their functions",
        header: ["Organelle", "Function"],
        rows: [
          ["Nucleus", "Stores genetic material"],
          ["Mitochondrion", "Aerobic respiration"],
          ["Ribosome", "Protein synthesis"],
        ],
      },
    },
    {
      kind: "video",
      payload: {
        v: 1,
        provider: "youtube",
        providerId: "aqz-KE-bpKQ",
        title: `Video placeholder for ${topicTitle}`,
        durationSeconds: 635,
      },
    },
  ];
}

await client.execute("PRAGMA foreign_keys = ON");

const curriculumId = id("curriculum", SEED_CURRICULUM.slug);
await upsert("curricula", {
  id: curriculumId,
  slug: SEED_CURRICULUM.slug,
  name: SEED_CURRICULUM.name,
  short_name: SEED_CURRICULUM.shortName,
  description_md: SEED_CURRICULUM.descriptionMd,
  status: "published",
  position: 0,
  created_at: now,
  updated_at: now,
});

const levelIds = new Map<string, string>();
for (const [index, level] of SEED_LEVELS.entries()) {
  const levelId = id("level", level.slug);
  levelIds.set(level.slug, levelId);
  await upsert("education_levels", {
    id: levelId,
    curriculum_id: curriculumId,
    slug: level.slug,
    name: level.name,
    description_md: level.descriptionMd,
    position: index,
    status: "published",
    created_at: now,
    updated_at: now,
  });
}

const groupIds = new Map<string, string>();
for (const [index, group] of SEED_GROUPS.entries()) {
  const groupId = id("group", group.slug);
  groupIds.set(group.slug, groupId);
  await upsert("subject_groups", {
    id: groupId,
    slug: group.slug,
    name: group.name,
    description: `${group.name} subjects across the catalogue.`,
    icon_key: group.iconKey,
    color_token: group.color,
    position: index,
  });
}

let subjectCount = 0;
let chapterCount = 0;
let topicCount = 0;
let resourceCount = 0;
let blockCount = 0;

for (const [index, subject] of SEED_SUBJECTS.entries()) {
  const subjectId = id("subject", subject.levelSlug, subject.slug);
  const levelId = levelIds.get(subject.levelSlug);
  const groupId = groupIds.get(subject.groupSlug);
  if (!levelId || !groupId) {
    throw new Error(`Seed subject ${subject.slug} references an unknown level or group.`);
  }

  await upsert("subjects", {
    id: subjectId,
    education_level_id: levelId,
    subject_group_id: groupId,
    slug: subject.slug,
    name: subject.name,
    summary: subject.summary,
    color_token: subject.color,
    icon_key: subject.icon,
    hero_media_id: null,
    status: "published",
    published_at: now,
    position: index,
    seo_title: `${subject.name} — study notes, lessons & practice`,
    seo_description: subject.summary,
    created_by: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
  });
  subjectCount += 1;

  for (const [chapterIndex, chapter] of subject.chapters.entries()) {
    const chapterId = id("chapter", subject.levelSlug, subject.slug, chapter.slug);
    await upsert("chapters", {
      id: chapterId,
      subject_id: subjectId,
      slug: chapter.slug,
      title: chapter.title,
      summary: chapter.summary,
      position: chapterIndex,
      status: "published",
      published_at: now,
      created_by: null,
      updated_by: null,
      created_at: now,
      updated_at: now,
    });
    chapterCount += 1;

    for (const [topicIndex, topic] of chapter.topics.entries()) {
      const topicId = id("topic", subject.levelSlug, subject.slug, chapter.slug, topic.slug);
      await upsert("topics", {
        id: topicId,
        chapter_id: chapterId,
        slug: topic.slug,
        title: topic.title,
        summary: topic.summary,
        learning_objectives: JSON.stringify(topic.objectives),
        estimated_minutes: topic.minutes,
        position: topicIndex,
        status: "published",
        published_at: now,
        created_by: null,
        updated_by: null,
        created_at: now,
        updated_at: now,
      });
      topicCount += 1;

      const resourceId = id("resource", subject.levelSlug, subject.slug, chapter.slug, topic.slug);
      await upsert("learning_resources", {
        id: resourceId,
        topic_id: topicId,
        slug: "study-notes",
        title: `${topic.title} — study notes`,
        subtitle: null,
        summary: topic.summary,
        reading_minutes: 8,
        difficulty: "medium",
        position: 0,
        status: "published",
        published_at: now,
        version: 1,
        created_by: null,
        updated_by: null,
        created_at: now,
        updated_at: now,
      });
      resourceCount += 1;

      const isShowcase =
        subject.slug === "biology" &&
        chapter.slug === "cells-and-transport" &&
        topic.slug === "cell-structure";
      const blocks = isShowcase
        ? showcaseBlocks(topic.title)
        : baseBlocks(topic.title, topic.summary, topic.objectives);

      for (const [blockIndex, block] of blocks.entries()) {
        await upsert("content_blocks", {
          id: id("block", subject.levelSlug, subject.slug, chapter.slug, topic.slug, String(blockIndex)),
          resource_id: resourceId,
          kind: block.kind,
          position: blockIndex,
          payload: JSON.stringify(block.payload),
          created_at: now,
          updated_at: now,
        });
      }
      blockCount += blocks.length;
    }
  }
}

console.log(
  `seed: ${subjectCount} subjects, ${chapterCount} chapters, ${topicCount} topics, ${resourceCount} resources, ${blockCount} blocks`,
);
