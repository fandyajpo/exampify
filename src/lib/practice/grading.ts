import { normaliseAnswer } from "@/lib/content/question-gates";
import type { StudentAnswer } from "@/lib/validation/attempts";
import type { AnswerKey, OptionLabel } from "@/lib/validation/questions";

/**
 * Grading, as pure functions (`QUESTION_ENGINE.md` §5, §6).
 *
 * Nothing here reads the database or the clock: the submit transaction loads the snapshot,
 * calls these, and writes the output. That is what makes the score testable against an
 * independently computed sum, and what keeps a partial-credit rule from drifting between
 * the studio preview, the practice reveal and the final review.
 *
 * Points are integers in hundredths throughout (§4). One rounding happens at the leaf, in
 * `awarded()`, and never on a total.
 *
 * `isCorrect` and `points` are deliberately separate answers: a partially-scored multiple
 * select can earn points while `isCorrect` is false. Accuracy reads `isCorrect`; scores read
 * `points` (§6.1).
 */

export class AnswerTypeMismatch extends Error {
  constructor(public readonly questionId: string) {
    super(`The answer does not match the question type for ${questionId}.`);
    this.name = "AnswerTypeMismatch";
  }
}

/** The minimum a graded item needs: identity plus the key. `pointsMax` travels separately
 * because an attempt snapshots it in `attempt_items.points_x100_max` (§4). */
export type GradableQuestion = {
  id: string;
  answerKey: AnswerKey;
};

export type ItemFeedback = {
  state: "unanswered" | "unavailable" | "graded";
  /** `multiple_select` only: correct picks, wrong picks and how many were correct. */
  hits?: number;
  misses?: number;
  correctCount?: number;
  partial?: boolean;
  /** `short_answer` only: what the student's text became after normalisation (§5). */
  normalised?: string;
};

export type ItemResult = {
  isCorrect: boolean | null;
  points: number;
  feedback: ItemFeedback;
};

/**
 * Partial credit for a multiple select: each wrong pick cancels one right one, so choosing
 * every option can never beat choosing only the known-correct ones (§6.1).
 */
export function awarded(hits: number, misses: number, correctCount: number, pointsMax: number): number {
  if (correctCount <= 0) return 0;
  const raw = Math.round((pointsMax * (hits - misses)) / correctCount);
  return Math.min(pointsMax, Math.max(0, raw));
}

/** Whole-token match, so "cat" does not satisfy a required "catalyst" (§5). */
function containsWholeKeyword(haystack: string, keyword: string): boolean {
  if (keyword === "") return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/**
 * Short-answer credit: full points or none (§6). A match is either an accepted answer after
 * normalisation, or — when the key lists keywords — every required keyword present as a
 * whole token. The stored key has no `keywordsOnly` flag, so the keyword rule is an
 * alternative to the accepted list, not an extra requirement.
 */
export function gradeShortAnswer(
  key: Extract<AnswerKey, { type: "short_answer" }>,
  text: string,
  pointsMax: number,
): number {
  const normalised = normaliseAnswer(text);
  if (normalised === "") return 0;
  if (key.accepted.some((accepted) => normaliseAnswer(accepted) === normalised)) return pointsMax;

  const required = key.keywords?.all;
  if (required && required.length > 0) {
    const every = required.every((keyword) => containsWholeKeyword(normalised, normaliseAnswer(keyword)));
    if (every) return pointsMax;
  }
  return 0;
}

function answerAs<T extends StudentAnswer["type"]>(
  answer: StudentAnswer,
  type: T,
  questionId: string,
): Extract<StudentAnswer, { type: T }> {
  if (answer.type !== type) throw new AnswerTypeMismatch(questionId);
  return answer as Extract<StudentAnswer, { type: T }>;
}

/** Grade one item against its key (§6.1). `null` means unanswered, not wrong. */
export function gradeItem(
  question: GradableQuestion,
  answer: StudentAnswer | null,
  pointsMax: number,
): ItemResult {
  if (answer === null) return { isCorrect: null, points: 0, feedback: { state: "unanswered" } };

  const key = question.answerKey;
  if (answer.type !== key.type) throw new AnswerTypeMismatch(question.id);

  switch (key.type) {
    case "multiple_choice": {
      const choice = answerAs(answer, "multiple_choice", question.id);
      const correct = choice.option !== null && choice.option === key.correct;
      return { isCorrect: correct, points: correct ? pointsMax : 0, feedback: { state: "graded" } };
    }
    case "true_false": {
      const choice = answerAs(answer, "true_false", question.id);
      const correct = choice.value !== null && choice.value === key.correct;
      return { isCorrect: correct, points: correct ? pointsMax : 0, feedback: { state: "graded" } };
    }
    case "multiple_select": {
      const choice = answerAs(answer, "multiple_select", question.id);
      const correctLabels = new Set<OptionLabel>(key.correct);
      const chosen = new Set<OptionLabel>(choice.options);
      const hits = [...chosen].filter((label) => correctLabels.has(label)).length;
      const misses = [...chosen].filter((label) => !correctLabels.has(label)).length;
      const isCorrect = hits === correctLabels.size && misses === 0;
      const detail = { hits, misses, correctCount: correctLabels.size };

      if (key.scoring === "all_or_nothing") {
        return {
          isCorrect,
          points: isCorrect ? pointsMax : 0,
          feedback: { state: "graded", ...detail },
        };
      }
      return {
        isCorrect,
        points: awarded(hits, misses, correctLabels.size, pointsMax),
        feedback: { state: "graded", ...detail, partial: true },
      };
    }
    case "short_answer": {
      const written = answerAs(answer, "short_answer", question.id);
      const points = gradeShortAnswer(key, written.text, pointsMax);
      return {
        isCorrect: pointsMax > 0 && points === pointsMax,
        points,
        feedback: { state: "graded", normalised: normaliseAnswer(written.text) },
      };
    }
    default: {
      const exhaustive: never = key;
      throw new Error(`Unhandled answer key: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export type AttemptItemInput = {
  questionId: string;
  /** The snapshot taken at selection (`attempt_items.points_x100_max`). */
  pointsMax: number;
  answer: StudentAnswer | null;
  /**
   * `null` when the stored key no longer parses. §3 fails closed: the item is skipped and
   * reported as unavailable, never marked wrong, and it leaves the denominator alone.
   */
  question: GradableQuestion | null;
};

export type GradedAttemptItem = {
  questionId: string;
  isCorrect: boolean | null;
  points: number;
  feedback: ItemFeedback;
};

export type AttemptGrade = {
  items: GradedAttemptItem[];
  answeredCount: number;
  correctCount: number;
  scoreX100: number;
  maxScoreX100: number;
  /** `null` when nothing could be graded — not `0` (§6.2, §11). */
  scorePercentX100: number | null;
};

/** Grade a whole attempt in one pass (§6.2). The caller writes the totals, not the ratio. */
export function gradeAttempt(items: readonly AttemptItemInput[]): AttemptGrade {
  const graded: GradedAttemptItem[] = [];
  let answeredCount = 0;
  let correctCount = 0;
  let scoreX100 = 0;
  let maxScoreX100 = 0;

  for (const item of items) {
    const result =
      item.question === null
        ? { isCorrect: null, points: 0, feedback: { state: "unavailable" as const } }
        : gradeItem(item.question, item.answer, item.pointsMax);

    graded.push({ questionId: item.questionId, ...result });

    // An unavailable question contributes nothing to either side of the ratio.
    if (item.question !== null) maxScoreX100 += item.pointsMax;
    if (item.answer !== null) answeredCount += 1;
    if (result.isCorrect === true) correctCount += 1;
    scoreX100 += result.points;
  }

  return {
    items: graded,
    answeredCount,
    correctCount,
    scoreX100,
    maxScoreX100,
    scorePercentX100: maxScoreX100 === 0 ? null : Math.round((scoreX100 * 10_000) / maxScoreX100),
  };
}
