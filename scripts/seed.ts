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
  return upsertWhere(table, row, ["id"]);
}

/** Composite-key rows (`question_topics`, `resource_assessments`) have no `id` to conflict on. */
async function upsertWhere(table: string, row: Row, conflictColumns: string[]): Promise<void> {
  const columns = Object.keys(row);
  const updates = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");

  await client.execute({
    sql:
      `INSERT INTO ${table} (${columns.join(", ")}) ` +
      `VALUES (${columns.map(() => "?").join(", ")}) ` +
      `ON CONFLICT(${conflictColumns.join(", ")}) DO ${updates ? `UPDATE SET ${updates}` : "NOTHING"}`,
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

/**
 * Ten questions per topic across the four types (`MVP_ROADMAP.md` Phase 3): three single
 * choice, three multiple select, two true/false and two short answer. The stems are
 * deliberately generic fixtures — real questions are content-operations work — but every
 * one satisfies the §10.1 publish gates, so the seeded bank can be published, composed and
 * graded without a fix-up pass.
 */
type SeedQuestion = {
  type: "multiple_choice" | "multiple_select" | "true_false" | "short_answer";
  stemMd: string;
  options: { label: string; contentMd: string }[];
  answerKey: Record<string, unknown>;
};

function sampleQuestions(topicTitle: string, objectives: string[]): SeedQuestion[] {
  const idea = objectives[0] ?? topicTitle;
  const secondIdea = objectives[1] ?? idea;

  const choice = (index: number): SeedQuestion => ({
    type: "multiple_choice",
    stemMd: `Which statement about ${topicTitle.toLowerCase()} is correct? (sample ${index + 1})`,
    options: [
      { label: "A", contentMd: `${topicTitle} is unrelated to the syllabus objectives.` },
      { label: "B", contentMd: idea },
      { label: "C", contentMd: `Only exam papers mention ${topicTitle.toLowerCase()}.` },
      { label: "D", contentMd: "None of the above." },
    ],
    answerKey: { v: 1, type: "multiple_choice", correct: "B" },
  });

  const multi = (index: number): SeedQuestion => ({
    type: "multiple_select",
    stemMd: `Which of these belong to ${topicTitle.toLowerCase()}? (sample ${index + 1})`,
    options: [
      { label: "A", contentMd: idea },
      { label: "B", contentMd: secondIdea },
      { label: "C", contentMd: "It has no definitions worth learning." },
      { label: "D", contentMd: "It is only tested in another subject." },
    ],
    answerKey: { v: 1, type: "multiple_select", correct: ["A", "B"], scoring: "partial" },
  });

  const truth = (index: number): SeedQuestion => ({
    type: "true_false",
    stemMd: `True or false: ${idea}. (sample ${index + 1})`,
    options: [
      { label: "A", contentMd: "True" },
      { label: "B", contentMd: "False" },
    ],
    answerKey: { v: 1, type: "true_false", correct: true },
  });

  const short = (index: number): SeedQuestion => ({
    type: "short_answer",
    stemMd: `In one phrase, name the idea this topic is built on. (sample ${index + 1})`,
    options: [],
    answerKey: { v: 1, type: "short_answer", accepted: [topicTitle.toLowerCase()] },
  });

  return [
    choice(0),
    choice(1),
    choice(2),
    multi(3),
    multi(4),
    multi(5),
    truth(6),
    truth(7),
    short(8),
    short(9),
  ];
}

/** The explanation is part of the question row, not the key; this carries it out of the helper. */
function explanationFor(topicTitle: string): string {
  return (
    `This sample question checks one idea from ${topicTitle}. A correct answer restates the ` +
    `link between the term and its function, which is the same relationship the study notes ` +
    `explain in prose.`
  );
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
let questionCount = 0;
let assessmentCount = 0;

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

      const questions = sampleQuestions(topic.title, topic.objectives);
      const questionIds: string[] = [];
      for (const [questionIndex, question] of questions.entries()) {
        const questionId = id(
          "question",
          subject.levelSlug,
          subject.slug,
          chapter.slug,
          topic.slug,
          String(questionIndex),
        );
        questionIds.push(questionId);

        await upsert("questions", {
          id: questionId,
          topic_id: topicId,
          question_type: question.type,
          stem_md: question.stemMd,
          media_id: null,
          difficulty: questionIndex % 3 === 0 ? "easy" : questionIndex % 3 === 1 ? "medium" : "hard",
          explanation_md: explanationFor(topic.title),
          answer_key: JSON.stringify(question.answerKey),
          points_x100: 100,
          status: "published",
          published_at: now,
          version: 1,
          created_by: null,
          updated_by: null,
          created_at: now,
          updated_at: now,
        });
        questionCount += 1;

        for (const [optionIndex, option] of question.options.entries()) {
          await upsert("question_options", {
            id: id(
              "question-option",
              subject.levelSlug,
              subject.slug,
              chapter.slug,
              topic.slug,
              String(questionIndex),
              option.label,
            ),
            question_id: questionId,
            label: option.label,
            content_md: option.contentMd,
            feedback_md: null,
            position: optionIndex,
          });
        }

        await upsertWhere(
          "question_topics",
          { question_id: questionId, topic_id: topicId, is_primary: 1 },
          ["question_id", "topic_id"],
        );
      }

      // One cross-listed question per chapter demonstrates `ADR-003`: the row appears under
      // both topics without duplicating the question. The secondary listing is not the
      // assessment's item, so this only affects topic-level filters.
      const crossListTargets = chapter.topics.filter((candidate) => candidate.slug !== topic.slug);
      const crossListTarget = crossListTargets[0];
      if (crossListTarget) {
        const targetTopicId = id(
          "topic",
          subject.levelSlug,
          subject.slug,
          chapter.slug,
          crossListTarget.slug,
        );
        await upsertWhere(
          "question_topics",
          { question_id: questionIds[0]!, topic_id: targetTopicId, is_primary: 0 },
          ["question_id", "topic_id"],
        );
      }

      const assessmentId = id("assessment", subject.levelSlug, subject.slug, chapter.slug, topic.slug);
      await upsert("assessments", {
        id: assessmentId,
        topic_id: topicId,
        subject_id: subjectId,
        scope_key: topicId,
        slug: "practice-set",
        title: `${topic.title} — practice`,
        description_md: `Ten questions on ${topic.title.toLowerCase()}, in the order the study notes present them.`,
        mode: "practice",
        difficulty: "medium",
        duration_seconds: null,
        question_count: questionIds.length,
        status: "published",
        published_at: now,
        version: 1,
        created_by: null,
        updated_by: null,
        created_at: now,
        updated_at: now,
      });
      assessmentCount += 1;

      for (const [itemIndex, questionId] of questionIds.entries()) {
        await upsert("assessment_items", {
          id: id(
            "assessment-item",
            subject.levelSlug,
            subject.slug,
            chapter.slug,
            topic.slug,
            String(itemIndex),
          ),
          assessment_id: assessmentId,
          question_id: questionId,
          position: itemIndex,
          points_x100_override: null,
        });
      }

      // Linking the set to the topic's resource is what makes the seeded page a lesson; the
      // format badge is derived from this row, never stored (`ADR-024`).
      await upsertWhere(
        "resource_assessments",
        { resource_id: resourceId, assessment_id: assessmentId, placement: "end", position: 0 },
        ["resource_id", "assessment_id"],
      );
    }
  }
}

console.log(
  `seed: ${subjectCount} subjects, ${chapterCount} chapters, ${topicCount} topics, ` +
    `${resourceCount} resources, ${blockCount} blocks, ${questionCount} questions, ` +
    `${assessmentCount} assessments`,
);
