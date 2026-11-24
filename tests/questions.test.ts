import { describe, expect, it } from "vitest";

import { evaluateAssessmentGates } from "@/lib/content/assessment-gates";
import {
  evaluateQuestionGates,
  normaliseAnswer,
  questionKeyErrors,
} from "@/lib/content/question-gates";
import {
  answerKeySchema,
  questionCreateSchema,
  questionListQuerySchema,
} from "@/lib/validation/questions";
import { assessmentCreateSchema } from "@/lib/validation/assessments";

/**
 * The Phase 3 gates (`QUESTION_ENGINE.md` §10) and the answer-key contract (`§3`).
 *
 * Every documented gate gets a failing fixture with a field-addressed path, because the
 * studio shows those paths and a missing one becomes a silent refusal. The question_topics
 * invariant is exercised through its pure label/duplicate checks.
 */

const options = [
  { label: "A", contentMd: "Alpha" },
  { label: "B", contentMd: "Beta" },
];

const question = (overrides: Partial<Parameters<typeof evaluateQuestionGates>[0]> = {}) => ({
  type: "multiple_choice" as const,
  stemMd: "Which option is correct here?",
  explanationMd: "Because the definition ties the term to its function, which is the point of the topic.",
  difficulty: "medium",
  pointsX100: 100,
  answerKeyRaw: JSON.stringify({ v: 1, type: "multiple_choice", correct: "A" }),
  options,
  mediaId: null,
  media: null,
  primaryTopic: { id: "topic-1", status: "published" },
  secondaryTopics: [],
  ...overrides,
});

describe("answerKeySchema", () => {
  it("accepts every documented variant and rejects a mismatched one", () => {
    expect(answerKeySchema.safeParse({ v: 1, type: "multiple_choice", correct: "C" }).success).toBe(true);
    expect(
      answerKeySchema.safeParse({ v: 1, type: "multiple_select", correct: ["A", "B"], scoring: "partial" })
        .success,
    ).toBe(true);
    expect(answerKeySchema.safeParse({ v: 1, type: "true_false", correct: false }).success).toBe(true);
    expect(answerKeySchema.safeParse({ v: 1, type: "short_answer", accepted: ["x"] }).success).toBe(true);

    expect(answerKeySchema.safeParse({ v: 1, type: "multiple_choice", correct: "I" }).success).toBe(false);
    expect(answerKeySchema.safeParse({ v: 2, type: "true_false", correct: true }).success).toBe(false);
    expect(answerKeySchema.safeParse({ v: 1, type: "multiple_choice", correct: "A", extra: 1 }).success).toBe(
      false,
    );
  });
});

describe("normaliseAnswer", () => {
  it("ignores case, accents, spacing and trailing punctuation, and is idempotent", () => {
    expect(normaliseAnswer("  Cell   Membrane. ")).toBe("cell membrane");
    expect(normaliseAnswer("Café")).toBe("cafe");
    expect(normaliseAnswer("x = 2?")).toBe("x=2");
    expect(normaliseAnswer(normaliseAnswer("A  B!"))).toBe("a b");
  });
});

describe("questionKeyErrors", () => {
  it("names a correct option that does not exist", () => {
    const errors = questionKeyErrors("multiple_choice", options, {
      v: 1,
      type: "multiple_choice",
      correct: "C",
    });
    expect(errors[0]?.path).toBe("answerKey.correct");
    expect(errors[0]?.code).toBe("correct_option_missing");
  });

  it("rejects a key of another type", () => {
    const errors = questionKeyErrors("multiple_choice", options, {
      v: 1,
      type: "true_false",
      correct: true,
    });
    expect(errors[0]?.code).toBe("answer_key_type_mismatch");
  });

  it("rejects accepted answers that normalise to the same text, and empty ones", () => {
    const duplicate = questionKeyErrors("short_answer", [], {
      v: 1,
      type: "short_answer",
      accepted: ["Cell", "cell."],
    });
    expect(duplicate.map((error) => error.code)).toContain("duplicate_accepted");

    const empty = questionKeyErrors("short_answer", [], {
      v: 1,
      type: "short_answer",
      accepted: ["..."],
    });
    expect(empty.map((error) => error.code)).toContain("empty_accepted");
  });

  it("refuses options on a short-answer question", () => {
    const errors = questionKeyErrors("short_answer", options, {
      v: 1,
      type: "short_answer",
      accepted: ["x"],
    });
    expect(errors.map((error) => error.code)).toContain("options_not_allowed");
  });
});

describe("evaluateQuestionGates", () => {
  it("passes a complete question", () => {
    expect(evaluateQuestionGates(question())).toEqual([]);
  });

  it("blocks a short explanation", () => {
    const blocking = evaluateQuestionGates(question({ explanationMd: "Too short." }));
    expect(blocking.map((detail) => detail.code)).toContain("explanation_too_short");
  });

  it("blocks a choice question with fewer than two options", () => {
    const blocking = evaluateQuestionGates(question({ options: [options[0]!] }));
    expect(blocking.map((detail) => detail.code)).toContain("option_count");
  });

  it("blocks a multiple select with a single correct option", () => {
    const blocking = evaluateQuestionGates(
      question({
        type: "multiple_select",
        answerKeyRaw: JSON.stringify({
          v: 1,
          type: "multiple_select",
          correct: ["A"],
          scoring: "partial",
        }),
      }),
    );
    expect(blocking.map((detail) => detail.code)).toContain("not_enough_correct");
  });

  it("blocks true/false options that are not A=True, B=False", () => {
    const blocking = evaluateQuestionGates(
      question({
        type: "true_false",
        answerKeyRaw: JSON.stringify({ v: 1, type: "true_false", correct: true }),
        options: [
          { label: "A", contentMd: "Yes" },
          { label: "B", contentMd: "No" },
        ],
      }),
    );
    expect(blocking.map((detail) => detail.code)).toContain("true_false_options");
  });

  it("blocks a draft primary topic and an image without alt text", () => {
    const blocking = evaluateQuestionGates(
      question({
        primaryTopic: { id: "topic-1", status: "draft" },
        mediaId: "media-1",
        media: { status: "ready", altText: "  " },
      }),
    );
    const codes = blocking.map((detail) => detail.code);
    expect(codes).toContain("topic_not_publishable");
    expect(codes).toContain("alt_text_required");
  });

  it("blocks a secondary topic equal to the primary one", () => {
    const blocking = evaluateQuestionGates(
      question({ secondaryTopics: [{ id: "topic-1", status: "published" }] }),
    );
    expect(blocking.map((detail) => detail.code)).toContain("secondary_is_primary");
  });
});

describe("evaluateAssessmentGates", () => {
  const item = (overrides: Partial<Parameters<typeof evaluateAssessmentGates>[0]["items"][number]> = {}) => ({
    questionId: "q1",
    status: "published",
    inScope: true,
    pointsOverrideX100: null,
    ...overrides,
  });

  const assessment = (overrides: Partial<Parameters<typeof evaluateAssessmentGates>[0]> = {}) => ({
    mode: "practice" as const,
    durationSeconds: null,
    questionCount: 1,
    items: [item()],
    ...overrides,
  });

  it("passes a published, in-scope practice set", () => {
    expect(evaluateAssessmentGates(assessment())).toEqual([]);
  });

  it("blocks an empty item list and a count that disagrees", () => {
    const empty = evaluateAssessmentGates(assessment({ items: [], questionCount: 0 }));
    expect(empty.map((detail) => detail.code)).toContain("item_count");

    const drift = evaluateAssessmentGates(assessment({ questionCount: 2 }));
    expect(drift.map((detail) => detail.code)).toContain("count_mismatch");
  });

  it("blocks a draft question and an out-of-scope one", () => {
    const blocking = evaluateAssessmentGates(
      assessment({
        items: [item(), item({ questionId: "q2", status: "draft", inScope: false })],
        questionCount: 2,
      }),
    );
    const codes = blocking.map((detail) => detail.code);
    expect(codes).toContain("question_not_published");
    expect(codes).toContain("question_out_of_scope");
    expect(blocking.some((detail) => detail.path === "items.1.questionId")).toBe(true);
  });

  it("enforces the duration rules per mode", () => {
    const practice = evaluateAssessmentGates(assessment({ durationSeconds: 600 }));
    expect(practice.map((detail) => detail.code)).toContain("practice_is_untimed");

    const timed = evaluateAssessmentGates(assessment({ mode: "test", durationSeconds: null }));
    expect(timed.map((detail) => detail.code)).toContain("duration_required");

    const tooShort = evaluateAssessmentGates(assessment({ mode: "mock", durationSeconds: 30 }));
    expect(tooShort.map((detail) => detail.code)).toContain("duration_required");
  });

  it("blocks a duplicate question and an out-of-range override", () => {
    const blocking = evaluateAssessmentGates(
      assessment({
        items: [item(), item({ pointsOverrideX100: 50 })],
        questionCount: 2,
      }),
    );
    const codes = blocking.map((detail) => detail.code);
    expect(codes).toContain("duplicate_question");
    expect(codes).toContain("points_out_of_range");
  });
});

describe("request schemas", () => {
  it("refuses an unknown question field and a bad list filter", () => {
    expect(
      questionCreateSchema.safeParse({
        topicId: "t1",
        type: "multiple_choice",
        stemMd: "A long enough stem.",
        answerKey: { v: 1, type: "multiple_choice", correct: "A" },
        isCorrect: true,
      }).success,
    ).toBe(false);

    expect(questionListQuerySchema.safeParse({ sort: "position" }).success).toBe(false);
    expect(questionListQuerySchema.parse({})).toEqual({});
  });

  it("refuses a practice set with a duration and a timed set without one", () => {
    expect(
      assessmentCreateSchema.safeParse({
        subjectId: "s1",
        title: "Practice",
        mode: "practice",
        durationSeconds: 600,
        items: [],
      }).success,
    ).toBe(false);

    expect(
      assessmentCreateSchema.safeParse({
        subjectId: "s1",
        title: "Test",
        mode: "test",
        items: [],
      }).success,
    ).toBe(false);
  });
});
