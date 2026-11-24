"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/studio/error-message";
import type {
  AssessmentDetailDto,
  AssessmentMode,
} from "@/lib/validation/assessments";
import type { QuestionDto } from "@/lib/validation/questions";
import type { GateResult } from "@/lib/validation/resources";

/**
 * The assessment composer (`API_CONTRACTS.md` §7.3, `MVP_ROADMAP.md` Phase 3).
 *
 * Items are ordered and replaced wholesale on save — the order is part of the contract and a
 * per-item patch could leave `question_count` behind. Points are edited as whole points and
 * stored in hundredths. The candidate list is the assessment's scope, so an out-of-scope
 * question is never offered (and would be a `422` if it were).
 */

type ComposerItem = {
  questionId: string;
  stemMd: string;
  type: string;
  status: string;
  pointsOverride: string;
};

function toItem(question: QuestionDto): ComposerItem {
  return {
    questionId: question.id,
    stemMd: question.stemMd,
    type: question.type,
    status: question.status,
    pointsOverride: "",
  };
}

export function AssessmentComposer({
  assessment,
  candidates,
}: {
  assessment: AssessmentDetailDto;
  candidates: readonly QuestionDto[];
}): React.JSX.Element {
  const router = useRouter();
  const [title, setTitle] = useState(assessment.title);
  const [description, setDescription] = useState(
    assessment.descriptionMd ?? "",
  );
  const [mode, setMode] = useState<AssessmentMode>(assessment.mode);
  const [duration, setDuration] = useState(
    assessment.durationSeconds === null
      ? ""
      : String(assessment.durationSeconds),
  );
  const [difficulty, setDifficulty] = useState(assessment.difficulty);
  const [items, setItems] = useState<ComposerItem[]>(
    assessment.items.map((item) => ({
      questionId: item.questionId,
      stemMd: item.question.stemMd,
      type: item.question.type,
      status: item.question.status,
      pointsOverride:
        item.pointsOverride === null ? "" : String(item.pointsOverride),
    })),
  );
  const [pick, setPick] = useState("");
  const [updatedAt, setUpdatedAt] = useState(assessment.updatedAt);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "saved" | "error";
    message: string;
  } | null>(null);
  const [gate, setGate] = useState<GateResult | null>(null);

  const used = new Set(items.map((item) => item.questionId));
  const available = candidates.filter((question) => !used.has(question.id));

  function add(): void {
    const question = candidates.find((candidate) => candidate.id === pick);
    if (!question) return;
    setItems((current) => [...current, toItem(question)]);
    setPick("");
  }

  function move(index: number, delta: -1 | 1): void {
    setItems((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function setPoints(index: number, value: string): void {
    setItems((current) =>
      current.map((item, position) =>
        position === index ? { ...item, pointsOverride: value } : item,
      ),
    );
  }

  async function save(): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/v1/studio/assessments/${assessment.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            descriptionMd: description.trim() === "" ? null : description,
            mode,
            difficulty,
            durationSeconds:
              mode === "practice"
                ? null
                : duration === ""
                  ? null
                  : Number(duration),
            items: items.map((item) => ({
              questionId: item.questionId,
              ...(item.pointsOverride === ""
                ? {}
                : { pointsOverride: Number(item.pointsOverride) }),
            })),
            expectedUpdatedAt: updatedAt,
          }),
        },
      );

      if (response.status === 409) {
        setNotice({
          tone: "error",
          message:
            "Someone else saved this assessment first. Reload to see their version.",
        });
        return;
      }

      const body = (await response.json().catch(() => null)) as {
        data?: AssessmentDetailDto;
        error?: unknown;
      } | null;
      if (!response.ok || !body?.data) {
        setNotice({
          tone: "error",
          message: apiErrorMessage(body, "Could not save this assessment."),
        });
        return;
      }

      setUpdatedAt(body.data.updatedAt);
      setNotice({ tone: "saved", message: "Assessment saved." });
      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message: "Network error. Your changes are still here.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function validate(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/v1/studio/assessments/${assessment.id}/validate`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as {
        data?: GateResult;
        error?: unknown;
      } | null;
      if (body?.data) {
        setGate(body.data);
      } else {
        setGate({
          passing: false,
          blocking: [
            {
              path: "",
              code: "error",
              message: apiErrorMessage(body, "Could not validate."),
            },
          ],
          warnings: [],
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">
          Composer
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void validate()}
          >
            Validate
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save assessment"}
          </Button>
        </div>
      </div>

      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={
            notice.tone === "error"
              ? "text-sm font-medium text-coral-ink"
              : "text-sm text-leaf"
          }
        >
          {notice.message}
        </p>
      ) : null}

      {gate ? (
        <div className="rounded-md border border-line bg-paper-raised p-4 text-sm">
          <p
            className={
              gate.passing
                ? "font-medium text-leaf"
                : "font-medium text-coral-ink"
            }
          >
            {gate.passing
              ? "Every publish gate passes."
              : `${gate.blocking.length} gate(s) block publishing.`}
          </p>
          {gate.blocking.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-ink-2">
              {gate.blocking.map((detail) => (
                <li key={`${detail.path}-${detail.code}`}>
                  <span className="font-mono text-xs text-ink-3">
                    {detail.path || "assessment"}
                  </span>{" "}
                  — {detail.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Title</span>
        <Input
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Description (Markdown)</span>
        <Textarea
          value={description}
          rows={3}
          maxLength={4000}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Mode</span>
          <Select
            value={mode}
            onChange={(event) => {
              const next = event.target.value as AssessmentMode;
              setMode(next);
              if (next === "practice") setDuration("");
            }}
          >
            <option value="practice">Practice</option>
            <option value="test">Test</option>
            <option value="mock">Mock exam</option>
          </Select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Duration (seconds)</span>
          <Input
            type="number"
            min={60}
            max={10800}
            value={duration}
            disabled={mode === "practice"}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Difficulty</span>
          <Select
            value={difficulty}
            onChange={(event) =>
              setDifficulty(event.target.value as typeof difficulty)
            }
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="very_hard">Very hard</option>
          </Select>
        </label>
      </div>

      <section
        aria-labelledby="assessment-items"
        className="flex flex-col gap-3 border-t border-line pt-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3
            id="assessment-items"
            className="font-display text-lg font-semibold tracking-[-0.01em]"
          >
            Questions
          </h3>
          <p className="text-sm text-ink-3">
            {items.length} of 60 · {available.length} left in scope
          </p>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-ink-3">
            No questions yet. Add the first one below.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {items.map((item, index) => (
              /* Narrow screens give the title its own row: sharing one line with the
                 badge, points field and buttons squeezed it down to an ellipsis. */
              <li
                key={item.questionId}
                className="flex flex-col gap-3 rounded-sm border border-line bg-paper-raised p-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="pt-0.5 text-sm tabular-nums text-ink-3">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {item.stemMd}
                    </span>
                    <span className="block text-xs text-ink-3">
                      {item.type.replace(/_/g, " ")}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <Badge
                    tone={item.status === "published" ? "published" : "draft"}
                  >
                    {item.status.replace(/_/g, " ")}
                  </Badge>
                  <label className="flex items-center gap-2 text-sm text-ink-2">
                    Points
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={item.pointsOverride}
                      placeholder="default"
                      className="h-9 w-24"
                      onChange={(event) => setPoints(index, event.target.value)}
                    />
                  </label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setItems((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex min-w-64 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Add a question</span>
            <Select
              value={pick}
              onChange={(event) => setPick(event.target.value)}
              disabled={available.length === 0}
            >
              <option value="">
                {available.length === 0
                  ? "Nothing left in this scope"
                  : "Choose a question"}
              </option>
              {available.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.stemMd.slice(0, 80)} (
                  {question.status.replace(/_/g, " ")})
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="button"
            size="sm"
            disabled={!pick || items.length >= 60}
            onClick={add}
          >
            Add
          </Button>
        </div>
      </section>
    </div>
  );
}
