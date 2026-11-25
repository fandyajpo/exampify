import { describe, expect, it } from "vitest";

import { pickQuestions, seededShuffle, type PoolQuestion } from "@/lib/practice/selection";

/**
 * Selection (`QUESTION_ENGINE.md` §7): dedupe, filters, seeded order, short pools.
 *
 * The query half (`selectQuestions`) needs a database and is exercised indirectly through
 * these rules; everything that can be wrong with an attempt's item list lives here.
 */

const question = (overrides: Partial<PoolQuestion> & { id: string }): PoolQuestion => ({
  questionType: "multiple_choice",
  difficulty: "medium",
  pointsX100: 100,
  version: 1,
  ...overrides,
});

const pool = (count: number): PoolQuestion[] =>
  Array.from({ length: count }, (_, index) => question({ id: `q${index + 1}` }));

describe("pickQuestions", () => {
  it("keeps one item per question when a question is cross-listed", () => {
    const result = pickQuestions([question({ id: "q1" }), question({ id: "q1" }), question({ id: "q2" })], {
      questionCount: 10,
      seed: 1,
    });
    expect(result.questions.map((item) => item.id).sort()).toEqual(["q1", "q2"]);
    expect(result.questionCount).toBe(2);
    expect(result.requestedCount).toBe(10);
  });

  it("applies the difficulty and type filters without widening an empty type list", () => {
    const mixed = [
      question({ id: "easy", difficulty: "easy" }),
      question({ id: "hard", difficulty: "hard" }),
      question({ id: "tf", questionType: "true_false" }),
    ];

    const hardOnly = pickQuestions(mixed, { questionCount: 10, difficulty: "hard", seed: 2 });
    expect(hardOnly.questions.map((item) => item.id)).toEqual(["hard"]);

    const choiceOnly = pickQuestions(mixed, {
      questionCount: 10,
      questionTypes: ["multiple_choice"],
      seed: 2,
    });
    expect(choiceOnly.questions.map((item) => item.id).sort()).toEqual(["easy", "hard"]);

    const noTypes = pickQuestions(mixed, { questionCount: 10, questionTypes: [], seed: 2 });
    expect(noTypes.questionCount).toBe(0);
  });

  it("returns a short pool as-is and reports both counts", () => {
    const result = pickQuestions(pool(3), { questionCount: 10, seed: 3 });
    expect(result.questionCount).toBe(3);
    expect(result.requestedCount).toBe(10);
    expect(result.questions.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it("numbers positions from one in the chosen order", () => {
    const result = pickQuestions(pool(5), { questionCount: 3, order: "fixed", seed: 4 });
    expect(result.questions).toEqual([
      { ...question({ id: "q1" }), position: 1 },
      { ...question({ id: "q2" }), position: 2 },
      { ...question({ id: "q3" }), position: 3 },
    ]);
  });

  it("reproduces the same order from the same seed and covers the whole pool", () => {
    const candidates = pool(20);
    const first = pickQuestions(candidates, { questionCount: 20, seed: 42 });
    const second = pickQuestions(candidates, { questionCount: 20, seed: 42 });
    expect(first.questions.map((item) => item.id)).toEqual(second.questions.map((item) => item.id));
    expect(new Set(first.questions.map((item) => item.id)).size).toBe(20);
  });

  it("refuses a count outside 1…100 instead of returning a silent empty attempt", () => {
    expect(() => pickQuestions(pool(1), { questionCount: 0, seed: 1 })).toThrow(RangeError);
    expect(() => pickQuestions(pool(1), { questionCount: 101, seed: 1 })).toThrow(RangeError);
    expect(() => pickQuestions(pool(1), { questionCount: 1.5, seed: 1 })).toThrow(RangeError);
  });
});

describe("seededShuffle", () => {
  it("is deterministic, pure and order-changing for different seeds", () => {
    const items = pool(20).map((item) => item.id);
    expect(seededShuffle(items, 7)).toEqual(seededShuffle(items, 7));
    expect(items).toEqual(pool(20).map((item) => item.id));
    expect(seededShuffle(items, 7)).not.toEqual(seededShuffle(items, 8));
    expect([...seededShuffle(items, 7)].sort()).toEqual([...items].sort());
  });
});
