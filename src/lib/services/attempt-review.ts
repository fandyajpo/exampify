import "server-only";

import type { Kysely, Transaction } from "kysely";

import type { Database } from "@/lib/db/schema";
import { markdownTextToHtml } from "@/lib/markdown";
import { url } from "@/lib/urls";
import {
  studentAnswerSchema,
  type CorrectAnswerView,
  type ReviewItem,
  type StudentQuestion,
} from "@/lib/validation/attempts";
import { answerKeySchema, type AnswerKey, type QuestionType } from "@/lib/validation/questions";

/**
 * The review projection (`API_CONTRACTS.md` §5.4).
 *
 * An attempt is graded against the snapshot in `attempt_items`, but the text a student reads
 * afterwards is the current question: `contentUpdated` says the two disagree, and the
 * submitted score is never rewritten to match an edit. The stem, options and explanation are
 * rendered here rather than stored, so the review stays one query plus one options query.
 *
 * Nothing in this module decides a score; it reads `points_x100_awarded` and `is_correct`
 * that `gradeAttempt` already wrote.
 */

type Db = Kysely<Database>;
type Trx = Transaction<Database>;
type Executor = Db | Trx;

/** Options are presentational; their feedback is the only part the review shows. */
export function parseAnswerKey(raw: string): AnswerKey | null {
  try {
    const parsed = answerKeySchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseStudentAnswer(raw: string | null): ReviewItem["studentAnswer"] {
  if (raw === null) return null;
  try {
    const parsed = studentAnswerSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Ready assets with a public URL and both dimensions. `§5.4` types `media` with numbers, so
 * a half-described asset is reported as absent rather than as a misleading `0`.
 */
export async function loadMediaMap(
  db: Executor,
  mediaIds: string[],
): Promise<Map<string, NonNullable<StudentQuestion["media"]>>> {
  const media = new Map<string, NonNullable<StudentQuestion["media"]>>();
  if (mediaIds.length === 0) return media;

  const assets = await db
    .selectFrom("media_assets")
    .select(["id", "public_url", "alt_text", "width", "height"])
    .where("id", "in", mediaIds)
    .where("status", "=", "ready")
    .execute();

  for (const asset of assets) {
    if (asset.public_url === null || asset.width === null || asset.height === null) continue;
    media.set(asset.id, {
      url: asset.public_url,
      alt: asset.alt_text,
      width: asset.width,
      height: asset.height,
    });
  }
  return media;
}

/** The key as the review shows it: no scoring rule, and `null` when it no longer parses. */
export function toCorrectAnswerView(key: AnswerKey | null): CorrectAnswerView | null {
  if (key === null) return null;
  switch (key.type) {
    case "multiple_choice":
      return { type: "multiple_choice", labels: [key.correct] };
    case "multiple_select":
      return { type: "multiple_select", labels: key.correct };
    case "true_false":
      return { type: "true_false", value: key.correct };
    case "short_answer":
      return { type: "short_answer", accepted: key.accepted };
    default: {
      const exhaustive: never = key;
      throw new Error(`Unhandled answer key: ${JSON.stringify(exhaustive)}`);
    }
  }
}

const POINTS = (x100: number): number => x100 / 100;

export async function loadAttemptReview(db: Executor, attemptId: string): Promise<ReviewItem[]> {
  const rows = await db
    .selectFrom("attempt_items as ai")
    .innerJoin("questions as q", "q.id", "ai.question_id")
    .innerJoin("topics as t", "t.id", "q.topic_id")
    .innerJoin("chapters as ch", "ch.id", "t.chapter_id")
    .innerJoin("subjects as s", "s.id", "ch.subject_id")
    .innerJoin("education_levels as l", "l.id", "s.education_level_id")
    .innerJoin("curricula as c", "c.id", "l.curriculum_id")
    .select([
      "ai.question_id as questionId",
      "ai.position as position",
      "ai.points_x100_max as pointsX100Max",
      "ai.points_x100_awarded as pointsX100Awarded",
      "ai.is_correct as isCorrect",
      "ai.selected_answer as selectedAnswer",
      "ai.question_version as questionVersion",
      "q.question_type as questionType",
      "q.difficulty as difficulty",
      "q.stem_md as stemMd",
      "q.explanation_md as explanationMd",
      "q.answer_key as answerKey",
      "q.media_id as mediaId",
      "q.version as version",
      "t.id as topicId",
      "t.title as topicTitle",
      "t.slug as topicSlug",
      "ch.slug as chapterSlug",
      "s.slug as subjectSlug",
      "l.slug as levelSlug",
      "c.slug as curriculumSlug",
    ])
    .where("ai.attempt_id", "=", attemptId)
    .orderBy("ai.position")
    .execute();

  if (rows.length === 0) return [];

  const options = await db
    .selectFrom("question_options")
    .select(["question_id as questionId", "label", "feedback_md as feedbackMd"])
    .where(
      "question_id",
      "in",
      rows.map((row) => row.questionId),
    )
    .orderBy("position")
    .execute();

  const feedbackByQuestion = new Map<string, ReviewItem["optionFeedback"]>();
  for (const option of options) {
    const list = feedbackByQuestion.get(option.questionId) ?? [];
    list.push({
      label: option.label,
      feedbackHtml:
        option.feedbackMd === null || option.feedbackMd.trim() === ""
          ? null
          : markdownTextToHtml(option.feedbackMd),
    });
    feedbackByQuestion.set(option.questionId, list);
  }

  const media = await loadMediaMap(
    db,
    rows.flatMap((row) => (row.mediaId === null ? [] : [row.mediaId])),
  );

  return rows.map((row) => ({
    questionId: row.questionId,
    position: row.position,
    type: row.questionType as QuestionType,
    difficulty: row.difficulty,
    stemHtml: markdownTextToHtml(row.stemMd),
    media: row.mediaId === null ? null : (media.get(row.mediaId) ?? null),
    pointsMax: POINTS(row.pointsX100Max),
    pointsAwarded: POINTS(row.pointsX100Awarded ?? 0),
    isCorrect: row.isCorrect === null ? null : row.isCorrect === 1,
    studentAnswer: parseStudentAnswer(row.selectedAnswer),
    correctAnswer: toCorrectAnswerView(parseAnswerKey(row.answerKey)),
    explanationHtml: markdownTextToHtml(row.explanationMd),
    optionFeedback: feedbackByQuestion.get(row.questionId) ?? [],
    contentUpdated: row.version !== row.questionVersion,
    topic: {
      id: row.topicId,
      title: row.topicTitle,
      href: url.topic(
        row.curriculumSlug,
        row.levelSlug,
        row.subjectSlug,
        row.chapterSlug,
        row.topicSlug,
      ),
    },
  }));
}
