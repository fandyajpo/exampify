/**
 * Studio assessment library (`INFORMATION_ARCHITECTURE.md` §4.3, `API_CONTRACTS.md` §7.3):
 * filter, sort and cursor-page the practice sets and tests, then open the composer.
 */
import Link from "next/link";

import { Disclosure } from "@/components/motion/disclosure";
import { AssessmentCreateForm } from "@/components/studio/assessment-create-form";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { formatUtcDateTime } from "@/lib/format/datetime";
import { searchParam, type SearchParams } from "@/lib/search-params";
import { listAssessments } from "@/lib/services/assessments-admin";
import {
  listChaptersAdmin,
  listSubjectsAdmin,
  listTopicsAdmin,
} from "@/lib/services/taxonomy-admin";
import type {
  AssessmentListQuery,
  AssessmentMode,
} from "@/lib/validation/assessments";
import { ASSESSMENT_MODES } from "@/lib/validation/assessments";

const PAGE_SIZE = 25;
const STATUSES = ["draft", "in_review", "published", "archived"] as const;

const MODE_LABEL: Record<AssessmentMode, string> = {
  practice: "Practice",
  test: "Test",
  mock: "Mock exam",
};

function oneOf<T extends string>(
  allowed: readonly T[],
  value: string,
): T | undefined {
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function assessmentsHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/studio/assessments?${query}` : "/studio/assessments";
}

export const metadata = { title: "Assessments" };

export default async function StudioAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const values = {
    q: searchParam(params, "q"),
    mode: searchParam(params, "mode"),
    status: searchParam(params, "status"),
    topicId: searchParam(params, "topicId"),
    subjectId: searchParam(params, "subjectId"),
    sort: searchParam(params, "sort"),
    dir: searchParam(params, "dir"),
    cursor: searchParam(params, "cursor"),
  };

  const mode = oneOf(ASSESSMENT_MODES, values.mode);
  const status = oneOf(STATUSES, values.status);
  const sort =
    oneOf(["updatedAt", "createdAt"] as const, values.sort) ?? "updatedAt";
  const dir = oneOf(["asc", "desc"] as const, values.dir) ?? "desc";

  const query: AssessmentListQuery = {
    limit: PAGE_SIZE,
    sort,
    dir,
    ...(values.q ? { q: values.q } : {}),
    ...(mode ? { mode } : {}),
    ...(status ? { status } : {}),
    ...(values.topicId ? { topicId: values.topicId } : {}),
    ...(values.subjectId ? { subjectId: values.subjectId } : {}),
    ...(values.cursor ? { cursor: values.cursor } : {}),
  };

  const [
    { data: assessments, pagination },
    { data: subjects },
    { data: topics },
    { data: chapters },
  ] = await Promise.all([
    listAssessments(query),
    listSubjectsAdmin({ limit: 50 }),
    listTopicsAdmin({}),
    listChaptersAdmin({}),
  ]);

  const chapterSubject = new Map(
    chapters.map((chapter) => [chapter.id, chapter.subjectId]),
  );
  const topicTitles = new Map(topics.map((topic) => [topic.id, topic.title]));
  const subjectNames = new Map(
    subjects.map((subject) => [subject.id, subject.name]),
  );
  const filtered = Boolean(
    values.q || mode || status || values.topicId || values.subjectId,
  );

  const nextDir = sort === "updatedAt" && dir === "desc" ? "asc" : "desc";

  return (
    <>
      <header className="max-w-[62ch]">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
          Question bank
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em]">
          Assessments
        </h1>
        <p className="mt-3 text-ink-2">
          Practice sets and tests, drafts included. Scope, order and points are
          set in the composer; publication is gated on published, in-scope
          questions.
        </p>
      </header>

      <form
        action="/studio/assessments"
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3"
      >
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-ink-2">Search the title</span>
          <input
            name="q"
            defaultValue={values.q}
            maxLength={120}
            className="h-10 rounded-sm border border-line-strong bg-paper-raised px-3 text-base text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-2">Mode</span>
          <Select name="mode" defaultValue={mode ?? ""} className="h-10 w-auto">
            <option value="">Any mode</option>
            {ASSESSMENT_MODES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {MODE_LABEL[candidate]}
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
            href={assessmentsHref({})}
            className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {assessments.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No assessments here"
          description={
            filtered
              ? "Nothing matches these filters. Clear them to see every assessment."
              : "Create a draft below, then compose it from the question bank."
          }
        />
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {assessments.map((assessment) => (
              <li
                key={assessment.id}
                className="rounded-md border border-line bg-paper-raised p-4 shadow-sm"
              >
                <Link
                  href={`/studio/assessments/${assessment.id}`}
                  className="font-medium text-ink underline-offset-4 hover:underline"
                >
                  {assessment.title}
                </Link>
                <p className="mt-1 text-xs text-ink-3">
                  {assessment.topicId
                    ? (topicTitles.get(assessment.topicId) ??
                      assessment.topicId)
                    : "Course-wide"}{" "}
                  ·{" "}
                  {subjectNames.get(assessment.subjectId) ??
                    assessment.subjectId}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ContentStatusBadge status={assessment.status} />
                  <span className="text-xs text-ink-3">
                    {MODE_LABEL[assessment.mode]}
                    {assessment.durationSeconds === null
                      ? ""
                      : ` · ${assessment.durationSeconds}s`}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-ink-2">
                    {assessment.questionCount}{" "}
                    {assessment.questionCount === 1 ? "question" : "questions"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-3">
                  Updated {formatUtcDateTime(assessment.updatedAt)}
                </p>
              </li>
            ))}
          </ul>

          <div className="table-shell mt-6 hidden md:block">
            <table className="data-table">
              <caption className="sr-only">
                Assessments with mode, question count, status and last edit
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="font-medium">
                    Assessment
                  </th>
                  <th scope="col" className="font-medium">
                    Mode
                  </th>
                  <th scope="col" className="text-right font-medium">
                    Questions
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
                      href={assessmentsHref({
                        ...values,
                        sort: "updatedAt",
                        dir: nextDir,
                        cursor: undefined,
                      })}
                      className="underline-offset-4 hover:text-ink hover:underline"
                    >
                      Updated{" "}
                      {sort === "updatedAt" ? (dir === "asc" ? "↑" : "↓") : ""}
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>
                      <Link
                        href={`/studio/assessments/${assessment.id}`}
                        className="font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {assessment.title}
                      </Link>
                      <p className="text-xs text-ink-3">
                        {assessment.topicId
                          ? (topicTitles.get(assessment.topicId) ??
                            assessment.topicId)
                          : "Course-wide"}{" "}
                        ·{" "}
                        {subjectNames.get(assessment.subjectId) ??
                          assessment.subjectId}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-ink-2">
                      {MODE_LABEL[assessment.mode]}
                      {assessment.durationSeconds === null
                        ? ""
                        : ` · ${assessment.durationSeconds}s`}
                    </td>
                    <td className="text-right tabular-nums text-ink-2">
                      {assessment.questionCount}
                    </td>
                    <td>
                      <ContentStatusBadge status={assessment.status} />
                    </td>
                    <td className="whitespace-nowrap text-ink-2">
                      {formatUtcDateTime(assessment.updatedAt)}
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
              href={assessmentsHref({ ...values, cursor: undefined })}
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              ← First page
            </Link>
          ) : (
            <span />
          )}
          {pagination.nextCursor ? (
            <Link
              href={assessmentsHref({
                ...values,
                cursor: pagination.nextCursor,
              })}
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              Next page →
            </Link>
          ) : null}
        </nav>
      ) : null}

      <Disclosure label="New assessment" className="mt-10">
        <AssessmentCreateForm
          subjects={subjects.map((subject) => ({
            id: subject.id,
            name: subject.name,
          }))}
          topics={topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            subjectId: chapterSubject.get(topic.chapterId) ?? "",
          }))}
        />
      </Disclosure>
    </>
  );
}
