/**
 * Question publish gates (`QUESTION_ENGINE.md` §10.1) and the authoring checks the write
 * path shares with them.
 *
 * Pure: the caller loads the row, its options, its topics and any image, and this module
 * answers with field-addressed details. The `§7.4 validate` dry run and the publish
 * transition call the same function, so the studio can never report "passing" for a question
 * the publish would refuse.
 */

import type { OptionLabel, QuestionType } from "@/lib/validation/questions";
import { answerKeySchema, OPTION_LABELS } from "@/lib/validation/questions";
import type { AnswerKey } from "@/lib/validation/questions";
import type { GateDetail } from "@/lib/validation/resources";

const MIN_STEM = 10;
const MAX_STEM = 4_000;
const MIN_EXPLANATION = 60;
const MIN_POINTS_X100 = 100;
const MAX_POINTS_X100 = 1_000;
const PUBLISHABLE_TOPIC_STATUSES = new Set(["published", "in_review"]);
const DIFFICULTIES = new Set(["easy", "medium", "hard", "very_hard"]);

/**
 * Short-answer normalisation (`QUESTION_ENGINE.md` §5): deterministic, locale-independent
 * and applied identically here (authoring) and by the grader (Phase 4). It deliberately does
 * not stem, expand synonyms or convert units.
 */
export function normaliseAnswer(input: string): string {
  let value = input.normalize("NFKC").trim().replace(/\s+/g, " ");
  value = value.toLowerCase();
  value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  value = value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ");
  value = value.replace(/[.!?]+$/, "").replace(/^['"]+|['"]+$/g, "");
  value = value.replace(/\s*([=+\-/<>^])\s*/g, "$1");
  return value.replace(/\s+/g, " ").trim();
}

/** Option labels must be unique; the database's unique index is not a validation message. */
export function optionLabelErrors(options: readonly { label: string }[]): GateDetail[] {
  const errors: GateDetail[] = [];
  const seen = new Set<string>();

  for (const [index, option] of options.entries()) {
    if (!(OPTION_LABELS as readonly string[]).includes(option.label)) {
      errors.push({
        path: `options.${index}.label`,
        code: "invalid_label",
        message: "Option labels run from A to H.",
      });
      continue;
    }
    if (seen.has(option.label)) {
      errors.push({
        path: `options.${index}.label`,
        code: "duplicate_label",
        message: `Two options use the label ${option.label}.`,
      });
    }
    seen.add(option.label);
  }

  return errors;
}

/**
 * The answer key must agree with the options it refers to (`§10.1` items 5–9 minus the
 * counts, which only a publish needs). Used on write so a saved key cannot point at an option
 * that does not exist, and again by the publish gate.
 */
export function questionKeyErrors(
  type: QuestionType,
  options: readonly { label: string }[],
  key: AnswerKey | null,
): GateDetail[] {
  if (!key) {
    return [
      {
        path: "answerKey",
        code: "invalid_answer_key",
        message: "Choose the correct answer before publishing.",
      },
    ];
  }

  if (key.type !== type) {
    return [
      {
        path: "answerKey.type",
        code: "answer_key_type_mismatch",
        message: "The answer key does not match the question type.",
      },
    ];
  }

  const labels = new Set(options.map((option) => option.label));
  const errors: GateDetail[] = [];

  switch (key.type) {
    case "multiple_choice": {
      if (!labels.has(key.correct)) {
        errors.push({
          path: "answerKey.correct",
          code: "correct_option_missing",
          message: "The correct option is not one of this question's options.",
        });
      }
      break;
    }
    case "multiple_select": {
      const unique = new Set(key.correct);
      if (unique.size !== key.correct.length) {
        errors.push({
          path: "answerKey.correct",
          code: "duplicate_correct",
          message: "List each correct option once.",
        });
      }
      for (const [index, label] of key.correct.entries()) {
        if (!labels.has(label)) {
          errors.push({
            path: `answerKey.correct.${index}`,
            code: "correct_option_missing",
            message: `Option ${label} is not one of this question's options.`,
          });
        }
      }
      break;
    }
    case "true_false": {
      // The service fixes the options to A=True and B=False, so there is nothing to compare.
      break;
    }
    case "short_answer": {
      if (options.length > 0) {
        errors.push({
          path: "options",
          code: "options_not_allowed",
          message: "A short-answer question has no options.",
        });
      }
      const seen = new Map<string, string>();
      for (const [index, accepted] of key.accepted.entries()) {
        const normalised = normaliseAnswer(accepted);
        if (normalised === "") {
          errors.push({
            path: `answerKey.accepted.${index}`,
            code: "empty_accepted",
            message: "An accepted answer cannot be empty or only punctuation.",
          });
          continue;
        }
        if (seen.has(normalised)) {
          errors.push({
            path: `answerKey.accepted.${index}`,
            code: "duplicate_accepted",
            message: `“${accepted}” duplicates another accepted answer once normalised.`,
          });
          continue;
        }
        seen.set(normalised, accepted);
      }
      break;
    }
    default: {
      const exhaustive: never = key;
      throw new Error(`Unhandled answer key: ${JSON.stringify(exhaustive)}`);
    }
  }

  return errors;
}

export type QuestionGateOption = { label: string; contentMd: string };

export type QuestionGateInput = {
  type: QuestionType;
  stemMd: string;
  explanationMd: string;
  difficulty: string;
  pointsX100: number;
  /** `questions.answer_key` as stored: JSON text, parsed here so a corrupt row fails closed. */
  answerKeyRaw: string;
  options: readonly QuestionGateOption[];
  mediaId: string | null;
  media: { status: string; altText: string } | null;
  primaryTopic: { id: string; status: string } | null;
  secondaryTopics: readonly { id: string; status: string }[];
};

function parseKey(raw: string): AnswerKey | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = answerKeySchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Every §10.1 gate. The caller turns a non-empty list into `422 PUBLISH_GATE_FAILED`. */
export function evaluateQuestionGates(input: QuestionGateInput): GateDetail[] {
  const blocking: GateDetail[] = [];

  const stem = input.stemMd.trim();
  if (stem.length < MIN_STEM || stem.length > MAX_STEM) {
    blocking.push({
      path: "stemMd",
      code: "stem_length",
      message: `The question stem needs ${MIN_STEM}–${MAX_STEM} characters.`,
    });
  }

  if (input.explanationMd.trim().length < MIN_EXPLANATION) {
    blocking.push({
      path: "explanationMd",
      code: "explanation_too_short",
      message: "Write at least 60 characters of explanation — students read it in review.",
    });
  }

  if (!DIFFICULTIES.has(input.difficulty)) {
    blocking.push({ path: "difficulty", code: "invalid_difficulty", message: "Choose a difficulty." });
  }

  if (input.pointsX100 < MIN_POINTS_X100 || input.pointsX100 > MAX_POINTS_X100) {
    blocking.push({
      path: "points",
      code: "points_out_of_range",
      message: "Points run from 1 to 10.",
    });
  }

  const key = parseKey(input.answerKeyRaw);
  const keyErrors = questionKeyErrors(input.type, input.options, key);
  for (const error of keyErrors) blocking.push(error);

  if (input.type === "multiple_choice" || input.type === "multiple_select") {
    if (input.options.length < 2 || input.options.length > 8) {
      blocking.push({
        path: "options",
        code: "option_count",
        message: "A choice question needs 2–8 options.",
      });
    }
  }

  if (input.type === "multiple_select" && key?.type === "multiple_select" && new Set(key.correct).size < 2) {
    blocking.push({
      path: "answerKey.correct",
      code: "not_enough_correct",
      message: "A multiple-select question needs at least two correct options.",
    });
  }

  if (input.type === "true_false") {
    const labels = input.options.map((option) => option.label).join("");
    const contents = input.options.map((option) => option.contentMd.trim().toLowerCase()).join("|");
    if (labels !== "AB" || contents !== "true|false") {
      blocking.push({
        path: "options",
        code: "true_false_options",
        message: "A true/false question has exactly two options: A is True and B is False.",
      });
    }
  }

  if (!input.primaryTopic) {
    blocking.push({ path: "topicId", code: "topic_missing", message: "The primary topic no longer exists." });
  } else if (!PUBLISHABLE_TOPIC_STATUSES.has(input.primaryTopic.status)) {
    blocking.push({
      path: "topicId",
      code: "topic_not_publishable",
      message: "Submit or publish the topic before publishing its questions.",
    });
  }

  const seen = new Set<string>();
  for (const [index, topic] of input.secondaryTopics.entries()) {
    if (topic.id === input.primaryTopic?.id) {
      blocking.push({
        path: `secondaryTopicIds.${index}`,
        code: "secondary_is_primary",
        message: "The primary topic cannot also be a secondary one.",
      });
      continue;
    }
    if (seen.has(topic.id)) {
      blocking.push({
        path: `secondaryTopicIds.${index}`,
        code: "duplicate_secondary",
        message: "The same secondary topic is listed twice.",
      });
    }
    seen.add(topic.id);
  }

  if (input.mediaId) {
    if (!input.media || input.media.status !== "ready") {
      blocking.push({
        path: "mediaId",
        code: "media_not_ready",
        message: "This question's image has no ready upload.",
      });
    } else if (!input.media.altText.trim()) {
      blocking.push({
        path: "mediaId",
        code: "alt_text_required",
        message: "Every image needs alt text before this question can publish.",
      });
    }
  }

  return blocking;
}

/** Labels are part of the wire contract; this keeps the editor's default in one place. */
export const FIRST_OPTION_LABELS: readonly OptionLabel[] = OPTION_LABELS.slice(0, 4);
