/**
 * Assessment publish gates (`QUESTION_ENGINE.md` §10.2) as a pure evaluation.
 *
 * Gate 7 (`scope_key` unique per slug) is the database's `UNIQUE (scope_key, slug)` and has
 * nothing to evaluate here; every other gate is checked. The loader supplies each item's
 * question status and whether the question sits in the assessment's scope, so this module
 * never queries.
 */

import type { AssessmentMode } from "@/lib/validation/assessments";
import type { GateDetail } from "@/lib/validation/resources";

const MIN_ITEMS = 1;
const MAX_ITEMS = 60;
const MIN_DURATION = 60;
const MAX_DURATION = 10_800;
const MIN_POINTS_X100 = 100;
const MAX_POINTS_X100 = 1_000;

export type AssessmentGateItem = {
  questionId: string;
  /** `null` when the question row is gone, which the FK prevents but the gate reports anyway. */
  status: string | null;
  /** Primary or cross-listed into the assessment's topic, or into its subject. */
  inScope: boolean;
  pointsOverrideX100: number | null;
};

export type AssessmentGateInput = {
  mode: AssessmentMode;
  durationSeconds: number | null;
  questionCount: number;
  items: readonly AssessmentGateItem[];
};

export function evaluateAssessmentGates(input: AssessmentGateInput): GateDetail[] {
  const blocking: GateDetail[] = [];

  if (input.items.length < MIN_ITEMS || input.items.length > MAX_ITEMS) {
    blocking.push({
      path: "items",
      code: "item_count",
      message: `A published assessment needs ${MIN_ITEMS}–${MAX_ITEMS} questions.`,
    });
  }

  const seen = new Set<string>();
  for (const [index, item] of input.items.entries()) {
    if (seen.has(item.questionId)) {
      blocking.push({
        path: `items.${index}.questionId`,
        code: "duplicate_question",
        message: "This question is already in the assessment.",
      });
    }
    seen.add(item.questionId);
  }

  if (input.questionCount !== input.items.length) {
    blocking.push({
      path: "questionCount",
      code: "count_mismatch",
      message: "The stored question count no longer matches the item list. Save the assessment again.",
    });
  }

  for (const [index, item] of input.items.entries()) {
    if (item.status === null) {
      blocking.push({
        path: `items.${index}.questionId`,
        code: "question_missing",
        message: "This question no longer exists.",
      });
      continue;
    }
    if (item.status !== "published") {
      blocking.push({
        path: `items.${index}.questionId`,
        code: "question_not_published",
        message: "Every question in a published assessment must be published first.",
      });
    }
    if (!item.inScope) {
      blocking.push({
        path: `items.${index}.questionId`,
        code: "question_out_of_scope",
        message: "Every question must belong to this assessment's topic or subject.",
      });
    }
    if (
      item.pointsOverrideX100 !== null &&
      (item.pointsOverrideX100 < MIN_POINTS_X100 || item.pointsOverrideX100 > MAX_POINTS_X100)
    ) {
      blocking.push({
        path: `items.${index}.pointsOverride`,
        code: "points_out_of_range",
        message: "A points override runs from 1 to 10.",
      });
    }
  }

  if (input.mode === "practice") {
    if (input.durationSeconds !== null) {
      blocking.push({
        path: "durationSeconds",
        code: "practice_is_untimed",
        message: "A practice set cannot have a duration.",
      });
    }
  } else if (
    input.durationSeconds === null ||
    input.durationSeconds < MIN_DURATION ||
    input.durationSeconds > MAX_DURATION
  ) {
    blocking.push({
      path: "durationSeconds",
      code: "duration_required",
      message: "A timed set needs a duration between 60 and 10 800 seconds.",
    });
  }

  return blocking;
}
