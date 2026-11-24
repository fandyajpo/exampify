/**
 * Studio question library (`INFORMATION_ARCHITECTURE.md` §4.3, `API_CONTRACTS.md` §7.4,
 * `FR-CMS-13`): search, status/type/difficulty filters, sortable updated column and keyset
 * pagination, all carried in the URL so a filtered view is a link.
 *
 * The table is a server component; it never selects `answerKey`. The editor is the only
 * screen that reads the key, and only for staff.
 */
import Link from "next/link";

import { Disclosure } from "@/components/motion/disclosure";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { QuestionCreateForm } from "@/components/studio/question-create-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { formatUtcDateTime } from "@/lib/format/datetime";
import { searchParam, type SearchParams } from "@/lib/search-params";
import { listQuestions } from "@/lib/services/questions-admin";
import { listTopicsAdmin } from "@/lib/services/taxonomy-admin";
import {
  QUESTION_TYPES,
  type QuestionListQuery,
  type QuestionType,
} from "@/lib/validation/questions";
import type { ContentStatus } from "@/lib/validation/taxonomy";

const PAGE_SIZE = 25;

const DIFFICULTIES = ["easy", "medium", "hard", "very_hard"] as const;
const STATUSES = ["draft", "in_review", "published", "archived"] as const;

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  multiple_select: "Multiple select",
  true_false: "True / false",
  short_answer: "Short answer",
};

const DIFFICULTY_TONE = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  very_hard: "very-hard",
} as const;

function oneOf<T extends string>(
  allowed: readonly T[],
  value: string,
): T | undefined {
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function questionsHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/studio/questions?${query}` : "/studio/questions";
}

export const metadata = { title: "Questions" };

export default async function StudioQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const values = {
    q: searchParam(params, "q"),
    type: searchParam(params, "type"),
    difficulty: searchParam(params, "difficulty"),
    status: searchParam(params, "status"),
    topicId: searchParam(params, "topicId"),
    subjectId: searchParam(params, "subjectId"),
    sort: searchParam(params, "sort"),
    dir: searchParam(params, "dir"),
    cursor: searchParam(params, "cursor"),
  };

  const type = oneOf(QUESTION_TYPES, values.type);
  const difficulty = oneOf(DIFFICULTIES, values.difficulty);
  const status = oneOf(STATUSES, values.status);
  const sort =
    oneOf(["updatedAt", "createdAt"] as const, values.sort) ?? "updatedAt";
  const dir = oneOf(["asc", "desc"] as const, values.dir) ?? "desc";

  const query: QuestionListQuery = {
    limit: PAGE_SIZE,
    sort,
    dir,
    ...(values.q ? { q: values.q } : {}),
    ...(type ? { type } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(status ? { status } : {}),
    ...(values.topicId ? { topicId: values.topicId } : {}),
    ...(values.subjectId ? { subjectId: values.subjectId } : {}),
    ...(values.cursor ? { cursor: values.cursor } : {}),
  };

  const [{ data: questions, pagination }, { data: topics }] = await Promise.all(
    [listQuestions(query), listTopicsAdmin({})],
  );
  const topicTitles = new Map(topics.map((topic) => [topic.id, topic.title]));
  const filtered = Boolean(
    values.q ||
    type ||
    difficulty ||
    status ||
    values.topicId ||
    values.subjectId,
  );

  const nextDir = sort === "updatedAt" && dir === "desc" ? "asc" : "desc";
  const sortHref = questionsHref({
    ...values,
    sort: "updatedAt",
    dir: nextDir,
  });

  return (
    <>
      <header className="max-w-[62ch]">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
          Question bank
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em]">
          Questions
        </h1>
        <p className="mt-3 text-ink-2">
          Every question, drafts included. The library never shows an answer
          key; open a question to edit it.
        </p>
        {values.topicId && topicTitles.has(values.topicId) ? (
          <p className="mt-2 text-sm text-ink-3">
            Filtered to {topicTitles.get(values.topicId)}.
          </p>
        ) : null}
      </header>

      <form
        action="/studio/questions"
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3"
      >
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-ink-2">Search the stem</span>
          <input
            name="q"
            defaultValue={values.q}
            maxLength={120}
            className="h-10 rounded-sm border border-line-strong bg-paper-raised px-3 text-base text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-2">Type</span>
          <Select name="type" defaultValue={type ?? ""} className="h-10 w-auto">
            <option value="">Any type</option>
            {QUESTION_TYPES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {TYPE_LABEL[candidate]}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-2">Difficulty</span>
          <Select
            name="difficulty"
            defaultValue={difficulty ?? ""}
            className="h-10 w-auto"
          >
            <option value="">Any</option>
            {DIFFICULTIES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-2">Status</span>
          <Select
            name="status"
            defaultValue={status ?? ""}
            className="h-10 w-auto"
          >
            <option value="">Any</option>
            {STATUSES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </label>

        {values.topicId ? (
          <input type="hidden" name="topicId" value={values.topicId} />
        ) : null}
        {values.subjectId ? (
          <input type="hidden" name="subjectId" value={values.subjectId} />
        ) : null}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />

        <Button type="submit" size="sm" className="h-10">
          Filter
        </Button>
        {filtered ? (
          <Link
            href={questionsHref({})}
            className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {questions.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No questions here"
          description={
            filtered
              ? "Nothing matches these filters. Clear them to see the whole bank."
              : "The bank is empty. Create the first draft below, then fill in its options and explanation."
          }
        />
      ) : (
        <>
          {/*
           * Below `md` the table becomes a card list (DESIGN_SYSTEM.md §9.9): the stem, both
           * badges, points and the last edit stay visible, so nothing important is lost to a
           * horizontal scroll on a phone.
           */}
          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {questions.map((question) => (
              <li
                key={question.id}
                className="rounded-md border border-line bg-paper-raised p-4 shadow-sm"
              >
                <Link
                  href={`/studio/questions/${question.id}`}
                  className="font-medium text-ink underline-offset-4 hover:underline"
                >
                  {question.stemMd.length > 120
                    ? `${question.stemMd.slice(0, 120)}…`
                    : question.stemMd}
                </Link>
                <p className="mt-1 text-xs text-ink-3">
                  {topicTitles.get(question.topicId) ?? question.topicId}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={DIFFICULTY_TONE[question.difficulty]}>
                    {question.difficulty.replace(/_/g, " ")}
                  </Badge>
                  <ContentStatusBadge
                    status={question.status as ContentStatus}
                  />
                  <span className="text-xs text-ink-3">
                    {TYPE_LABEL[question.type]}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-ink-2">
                    {question.points} {question.points === 1 ? "pt" : "pts"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-3">
                  Updated {formatUtcDateTime(question.updatedAt)}
                </p>
              </li>
            ))}
          </ul>

          <div className="table-shell mt-6 hidden md:block">
            <table className="data-table">
              <caption className="sr-only">
                Questions with type, difficulty, status and last edit
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="font-medium">
                    Question
                  </th>
                  {/* Type is the least load-bearing column, and the card list shows it; dropping
                    it on tablet is what keeps all six fields readable without scrolling. */}
                  <th scope="col" className="hidden font-medium xl:table-cell">
                    Type
                  </th>
                  <th scope="col" className="font-medium">
                    Difficulty
                  </th>
                  <th scope="col" className="text-right font-medium">
                    Points
                  </th>
                  <th scope="col" className="font-medium">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="font-medium"
                    aria-sort={
                      sort === "updatedAt"
                        ? dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <Link
                      href={sortHref}
                      className="underline-offset-4 hover:text-ink hover:underline"
                    >
                      Updated{" "}
                      {sort === "updatedAt" ? (dir === "asc" ? "↑" : "↓") : ""}
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question) => (
                  <tr key={question.id}>
                    <td className="max-w-[42ch]">
                      <Link
                        href={`/studio/questions/${question.id}`}
                        className="font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {question.stemMd.length > 110
                          ? `${question.stemMd.slice(0, 110)}…`
                          : question.stemMd}
                      </Link>
                      <p className="text-xs text-ink-3">
                        {topicTitles.get(question.topicId) ?? question.topicId}
                      </p>
                    </td>
                    <td className="hidden whitespace-nowrap text-ink-2 xl:table-cell">
                      {TYPE_LABEL[question.type]}
                    </td>
                    <td>
                      <Badge tone={DIFFICULTY_TONE[question.difficulty]}>
                        {question.difficulty.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums text-ink-2">
                      {question.points}
                    </td>
                    <td>
                      <ContentStatusBadge
                        status={question.status as ContentStatus}
                      />
                    </td>
                    <td className="whitespace-nowrap text-ink-2">
                      {formatUtcDateTime(question.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {values.cursor || pagination.nextCursor ? (
        <nav
          aria-label="Pagination"
          className="mt-6 flex items-center justify-between gap-4 text-sm"
        >
          {values.cursor ? (
            <Link
              href={questionsHref({ ...values, cursor: undefined })}
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              ← First page
            </Link>
          ) : (
            <span />
          )}
          {pagination.nextCursor ? (
            <Link
              href={questionsHref({ ...values, cursor: pagination.nextCursor })}
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              Next page →
            </Link>
          ) : null}
        </nav>
      ) : null}

      <Disclosure label="New question" className="mt-10">
        <QuestionCreateForm
          topics={topics.map((topic) => ({ id: topic.id, title: topic.title }))}
        />
      </Disclosure>
    </>
  );
}
