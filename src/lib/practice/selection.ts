import type { Kysely } from "kysely";

import type { Database, Difficulty } from "@/lib/db/schema";
import type { QuestionType } from "@/lib/validation/questions";

/**
 * Question selection (`QUESTION_ENGINE.md` §7).
 *
 * Two layers, on purpose: `pickQuestions()` is pure and holds every rule that can be
 * wrong — dedupe, filters, seeded order, short-pool reporting — while `selectQuestions()`
 * is only the query that produces the pool. The pure half is what the tests exercise, and
 * the attempt route can therefore reuse it against any pool.
 *
 * The pool is scope-bounded (a topic holds tens of published questions), so it is drawn
 * whole and shuffled here rather than sampled with a `random_key` column. The seeded
 * shuffle keeps the order reproducible from `config.seed`, which is what a retry debugs
 * against; `random_key` remains the documented replacement if a scope ever grows large
 * enough for the full draw to cost something.
 */

export type SelectionFilter = {
  questionCount: number;
  difficulty?: Difficulty;
  questionTypes?: readonly QuestionType[];
  order?: "random" | "fixed";
  /** 32-bit integer stored in `assessment_attempts.config` so a retry is reproducible. */
  seed: number;
};

export type PoolQuestion = {
  id: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  pointsX100: number;
  version: number;
};

export type SelectedQuestion = PoolQuestion & { position: number };

export type SelectionResult = {
  /** The items actually chosen; shorter than `requestedCount` when the pool is short. */
  questions: SelectedQuestion[];
  requestedCount: number;
  questionCount: number;
};

const MAX_QUESTIONS = 100;

/** Deterministic PRNG: the same seed must produce the same attempt order on every runtime. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates over a copy, driven by `mulberry32`. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const output = [...items];
  const random = mulberry32(seed);
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const left = output[index];
    const right = output[swap];
    if (left === undefined || right === undefined) continue;
    output[index] = right;
    output[swap] = left;
  }
  return output;
}

export function pickQuestions(pool: readonly PoolQuestion[], filter: SelectionFilter): SelectionResult {
  if (!Number.isInteger(filter.questionCount) || filter.questionCount < 1 || filter.questionCount > MAX_QUESTIONS) {
    throw new RangeError(`questionCount must be an integer between 1 and ${MAX_QUESTIONS}.`);
  }

  // A question cross-listed into two topics of the same scope appears once (§7).
  const unique = new Map<string, PoolQuestion>();
  for (const question of pool) {
    if (!unique.has(question.id)) unique.set(question.id, question);
  }

  const types = filter.questionTypes;
  const candidates = [...unique.values()].filter(
    (question) =>
      (filter.difficulty === undefined || question.difficulty === filter.difficulty) &&
      // An explicit empty list asks for no types and is honoured as such, not widened to all.
      (types === undefined || types.includes(question.questionType)),
  );

  const ordered = filter.order === "fixed" ? candidates : seededShuffle(candidates, filter.seed);
  const chosen = ordered.slice(0, filter.questionCount);

  return {
    questions: chosen.map((question, index) => ({ ...question, position: index + 1 })),
    requestedCount: filter.questionCount,
    questionCount: chosen.length,
  };
}

export type SelectionScope = {
  /** Resolved by the route from `source` (`topic`, `chapter`, `subject`, `assessment`). */
  topicIds: readonly string[];
};

/**
 * One query: published questions whose primary or cross-listed topic is in scope. `DISTINCT`
 * plus the pure dedupe keeps a cross-listed question to one item.
 */
export async function selectQuestions(
  db: Kysely<Database>,
  scope: SelectionScope,
  filter: SelectionFilter,
): Promise<SelectionResult> {
  const topicIds = [...new Set(scope.topicIds)];
  if (topicIds.length === 0 || filter.questionTypes?.length === 0) {
    return { questions: [], requestedCount: filter.questionCount, questionCount: 0 };
  }

  const rows = await db
    .selectFrom("questions as q")
    .innerJoin("question_topics as qt", "qt.question_id", "q.id")
    .select([
      "q.id as id",
      "q.question_type as questionType",
      "q.difficulty as difficulty",
      "q.points_x100 as pointsX100",
      "q.version as version",
    ])
    .distinct()
    .where("q.status", "=", "published")
    .where("qt.topic_id", "in", topicIds)
    .$if(filter.difficulty !== undefined, (builder) =>
      builder.where("q.difficulty", "=", filter.difficulty as Difficulty),
    )
    .$if(filter.questionTypes !== undefined, (builder) =>
      builder.where("q.question_type", "in", [...(filter.questionTypes ?? [])]),
    )
    .orderBy("q.id")
    .execute();

  return pickQuestions(rows, filter);
}
