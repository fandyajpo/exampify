import { describe, expect, it } from "vitest";

import { AnswerTypeMismatch, awarded, gradeAttempt, gradeItem, gradeShortAnswer } from "@/lib/practice/grading";
import { studentAnswerSchema } from "@/lib/validation/attempts";
import type { AnswerKey, OptionLabel } from "@/lib/validation/questions";

/**
 * Grading (`QUESTION_ENGINE.md` §5, §6).
 *
 * Each documented rule gets a case: the partial-credit formula, the "select everything"
 * strategy that must not beat the correct subset, partial credit separating `isCorrect`
 * from `points`, short-answer normalisation and the keyword rule, and the totals that a
 * submit writes. The property the score relies on — the total equals the sum of item awards
 * computed independently — is asserted directly in the attempt case.
 */

const mc = (correct: OptionLabel = "A"): AnswerKey => ({ v: 1, type: "multiple_choice", correct });

const multi = (correct: OptionLabel[], scoring: "all_or_nothing" | "partial"): AnswerKey => ({
  v: 1,
  type: "multiple_select",
  correct,
  scoring,
});

const short = (
  accepted: string[],
  keywords?: string[],
): Extract<AnswerKey, { type: "short_answer" }> => ({
  v: 1,
  type: "short_answer",
  accepted,
  ...(keywords ? { keywords: { all: keywords } } : {}),
});

describe("awarded", () => {
  it("rounds at the leaf, clamps to 0…max, and guards a zero correct count", () => {
    expect(awarded(2, 0, 3, 300)).toBe(200);
    expect(awarded(1, 0, 3, 300)).toBe(100);
    expect(awarded(0, 2, 3, 300)).toBe(0);
    expect(awarded(3, 0, 3, 300)).toBe(300);
    expect(awarded(1, 1, 3, 100)).toBe(0);
    expect(awarded(1, 0, 0, 100)).toBe(0);
  });
});

describe("gradeItem", () => {
  it("leaves an unanswered item null rather than wrong", () => {
    const result = gradeItem({ id: "q1", answerKey: mc("A") }, null, 100);
    expect(result).toEqual({ isCorrect: null, points: 0, feedback: { state: "unanswered" } });
  });

  it("scores a single choice exactly", () => {
    expect(gradeItem({ id: "q1", answerKey: mc("A") }, { v: 1, type: "multiple_choice", option: "A" }, 150))
      .toMatchObject({ isCorrect: true, points: 150 });
    expect(gradeItem({ id: "q1", answerKey: mc("A") }, { v: 1, type: "multiple_choice", option: "B" }, 150))
      .toMatchObject({ isCorrect: false, points: 0 });
    expect(gradeItem({ id: "q1", answerKey: mc("A") }, { v: 1, type: "multiple_choice", option: null }, 150))
      .toMatchObject({ isCorrect: false, points: 0 });
  });

  it("scores true/false and treats a cleared answer as wrong", () => {
    const key: AnswerKey = { v: 1, type: "true_false", correct: false };
    expect(gradeItem({ id: "q1", answerKey: key }, { v: 1, type: "true_false", value: false }, 100))
      .toMatchObject({ isCorrect: true, points: 100 });
    expect(gradeItem({ id: "q1", answerKey: key }, { v: 1, type: "true_false", value: null }, 100))
      .toMatchObject({ isCorrect: false, points: 0 });
  });

  it("gives an all-or-nothing multiple select nothing for a partial pick", () => {
    const key = multi(["A", "C"], "all_or_nothing");
    const exact = gradeItem({ id: "q1", answerKey: key }, { v: 1, type: "multiple_select", options: ["C", "A"] }, 200);
    expect(exact).toMatchObject({ isCorrect: true, points: 200, feedback: { hits: 2, misses: 0, correctCount: 2 } });

    const partial = gradeItem({ id: "q1", answerKey: key }, { v: 1, type: "multiple_select", options: ["A"] }, 200);
    expect(partial).toMatchObject({ isCorrect: false, points: 0 });
  });

  it("separates points from isCorrect on a partially scored multiple select", () => {
    const key = multi(["A", "B", "C"], "partial");
    const twoOfThree = gradeItem(
      { id: "q1", answerKey: key },
      { v: 1, type: "multiple_select", options: ["A", "B"] },
      300,
    );
    expect(twoOfThree.isCorrect).toBe(false);
    expect(twoOfThree.points).toBe(200);
    expect(twoOfThree.feedback).toMatchObject({ partial: true, hits: 2, misses: 0, correctCount: 3 });
  });

  it("never lets selecting everything beat selecting the correct subset", () => {
    const key = multi(["A", "B", "C"], "partial");
    const everything = gradeItem(
      { id: "q1", answerKey: key },
      { v: 1, type: "multiple_select", options: ["A", "B", "C", "D", "E"] },
      300,
    );
    const exact = gradeItem(
      { id: "q1", answerKey: key },
      { v: 1, type: "multiple_select", options: ["A", "B", "C"] },
      300,
    );
    expect(everything.isCorrect).toBe(false);
    expect(everything.feedback).toMatchObject({ hits: 3, misses: 2, correctCount: 3 });
    expect(everything.points).toBe(100);
    expect(everything.points).toBeLessThan(exact.points);
  });

  it("refuses an answer of another type instead of guessing", () => {
    expect(() =>
      gradeItem({ id: "q7", answerKey: mc("A") }, { v: 1, type: "true_false", value: true }, 100),
    ).toThrow(AnswerTypeMismatch);
  });
});

describe("gradeShortAnswer", () => {
  const key = short(["cell membrane", "plasma membrane"]);

  it("matches after normalisation and gives full points or none", () => {
    expect(gradeShortAnswer(key, "  Cell   Membrane. ", 100)).toBe(100);
    expect(gradeShortAnswer(key, "Cell wall", 100)).toBe(0);
    expect(gradeShortAnswer(key, "   ", 100)).toBe(0);
    expect(gradeShortAnswer(key, "...", 100)).toBe(0);
  });

  it("accepts every required keyword as a whole token", () => {
    const withKeywords = short(["mitochondria"], ["mitochondria", "atp"]);
    expect(gradeShortAnswer(withKeywords, "The mitochondria produces ATP.", 100)).toBe(100);
    expect(gradeShortAnswer(withKeywords, "The powerhouse of the cell", 100)).toBe(0);
    // "atp" inside a longer word is not the token.
    expect(gradeShortAnswer(withKeywords, "mitochondria make atpase", 100)).toBe(0);
  });
});

describe("gradeAttempt", () => {
  it("sums the item awards and computes the percentage from hundredths", () => {
    const grade = gradeAttempt([
      {
        questionId: "q1",
        pointsMax: 100,
        answer: { v: 1, type: "multiple_choice", option: "A" },
        question: { id: "q1", answerKey: mc("A") },
      },
      {
        questionId: "q2",
        pointsMax: 200,
        answer: { v: 1, type: "multiple_select", options: ["A"] },
        question: { id: "q2", answerKey: multi(["A", "B"], "partial") },
      },
      { questionId: "q3", pointsMax: 100, answer: null, question: { id: "q3", answerKey: mc("C") } },
    ]);

    // q2: one hit of two, so round(200 * 1 / 2) = 100.
    expect(grade.items.map((item) => item.points)).toEqual([100, 100, 0]);
    expect(grade.scoreX100).toBe(200);
    expect(grade.maxScoreX100).toBe(400);
    expect(grade.scorePercentX100).toBe(5000);
    expect(grade.answeredCount).toBe(2);
    expect(grade.correctCount).toBe(1);
    expect(grade.items.reduce((sum, item) => sum + item.points, 0)).toBe(grade.scoreX100);
  });

  it("rounds the percentage once, from the hundredths score", () => {
    const grade = gradeAttempt([
      {
        questionId: "q1",
        pointsMax: 100,
        answer: { v: 1, type: "multiple_choice", option: "A" },
        question: { id: "q1", answerKey: mc("A") },
      },
      { questionId: "q2", pointsMax: 200, answer: null, question: { id: "q2", answerKey: mc("B") } },
    ]);
    expect(grade.maxScoreX100).toBe(300);
    expect(grade.scorePercentX100).toBe(3333);
  });

  it("reports null, not zero, when nothing could be graded", () => {
    const grade = gradeAttempt([
      { questionId: "q1", pointsMax: 100, answer: null, question: null },
    ]);
    expect(grade.maxScoreX100).toBe(0);
    expect(grade.scorePercentX100).toBeNull();
    expect(grade.items[0]).toMatchObject({ isCorrect: null, points: 0, feedback: { state: "unavailable" } });
    expect(grade.correctCount).toBe(0);
  });
});

describe("studentAnswerSchema", () => {
  it("accepts the four shapes and refuses a scoring hint", () => {
    expect(studentAnswerSchema.safeParse({ v: 1, type: "multiple_choice", option: null }).success).toBe(true);
    expect(studentAnswerSchema.safeParse({ v: 1, type: "multiple_select", options: ["A", "B"] }).success).toBe(true);
    expect(studentAnswerSchema.safeParse({ v: 1, type: "true_false", value: true }).success).toBe(true);
    expect(studentAnswerSchema.safeParse({ v: 1, type: "short_answer", text: "x" }).success).toBe(true);

    expect(
      studentAnswerSchema.safeParse({ v: 1, type: "multiple_choice", option: "A", isCorrect: true }).success,
    ).toBe(false);
    expect(studentAnswerSchema.safeParse({ v: 1, type: "multiple_select", options: ["I"] }).success).toBe(false);
    expect(
      studentAnswerSchema.safeParse({ v: 1, type: "short_answer", text: "x".repeat(501) }).success,
    ).toBe(false);
  });
});
