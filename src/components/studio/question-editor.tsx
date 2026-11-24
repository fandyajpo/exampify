"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/studio/error-message";
import type { GateResult } from "@/lib/validation/resources";
import type {
  AnswerKey,
  OptionLabel,
  QuestionDetailDto,
  QuestionType,
} from "@/lib/validation/questions";
import { OPTION_LABELS, QUESTION_TYPES } from "@/lib/validation/questions";

/**
 * The question editor (`API_CONTRACTS.md` §7.4, `QUESTION_ENGINE.md` §3).
 *
 * Options are presentational and the key is the only correctness payload (ADR-004), so this
 * editor always saves the two together. Switching type resets the answer fields with a note
 * instead of leaving a key that no longer describes the question; the server refuses a type
 * change that arrives without a key.
 *
 * Point values cross the wire as whole points and are stored in hundredths by the service.
 */

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  multiple_select: "Multiple select",
  true_false: "True / false",
  short_answer: "Short answer",
};

type EditorOption = { label: OptionLabel; contentMd: string; feedbackMd: string };

type Notice = { tone: "saved" | "error" | "info"; message: string };

const TRUE_FALSE_OPTIONS: EditorOption[] = [
  { label: "A", contentMd: "True", feedbackMd: "" },
  { label: "B", contentMd: "False", feedbackMd: "" },
];

function defaultOptions(): EditorOption[] {
  return [
    { label: "A", contentMd: "", feedbackMd: "" },
    { label: "B", contentMd: "", feedbackMd: "" },
  ];
}

/** The options and key a type starts with — used on create and whenever the type changes. */
function resetForKey(type: QuestionType, previous: EditorOption[]): { options: EditorOption[]; answerKey: AnswerKey } {
  if (type === "true_false") {
    return { options: TRUE_FALSE_OPTIONS, answerKey: { v: 1, type: "true_false", correct: true } };
  }
  if (type === "short_answer") {
    return { options: [], answerKey: { v: 1, type: "short_answer", accepted: [""] } };
  }

  const options = previous.length >= 2 ? previous : defaultOptions();
  const first = options[0]?.label ?? "A";
  if (type === "multiple_select") {
    return {
      options,
      answerKey: { v: 1, type: "multiple_select", correct: [first], scoring: "all_or_nothing" },
    };
  }
  return { options, answerKey: { v: 1, type: "multiple_choice", correct: first } };
}

export function QuestionEditor({
  question,
  topics,
}: {
  question: QuestionDetailDto;
  topics: readonly { id: string; title: string }[];
}): React.JSX.Element {
  const router = useRouter();
  const [type, setType] = useState<QuestionType>(question.type);
  const [stem, setStem] = useState(question.stemMd);
  const [difficulty, setDifficulty] = useState(question.difficulty);
  const [points, setPoints] = useState(question.points);
  const [explanation, setExplanation] = useState(question.explanationMd);
  const [secondaryTopicIds, setSecondaryTopicIds] = useState<string[]>(question.secondaryTopicIds);
  const [options, setOptions] = useState<EditorOption[]>(
    question.options.map((option) => ({
      label: option.label,
      contentMd: option.contentMd,
      feedbackMd: option.feedbackMd ?? "",
    })),
  );
  const [answerKey, setAnswerKey] = useState<AnswerKey>(question.answerKey);
  const [updatedAt, setUpdatedAt] = useState(question.updatedAt);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [gate, setGate] = useState<GateResult | null>(null);

  function changeType(next: QuestionType): void {
    setType(next);
    const reset = resetForKey(next, options);
    setOptions(reset.options);
    setAnswerKey(reset.answerKey);
    setNotice({ tone: "info", message: "The answer fields were reset for the new type." });
  }

  function changeOption(index: number, patch: Partial<EditorOption>): void {
    setOptions((current) => current.map((option, position) => (position === index ? { ...option, ...patch } : option)));
  }

  function addOption(): void {
    setOptions((current) => {
      if (current.length >= 8) return current;
      const label = OPTION_LABELS[current.length];
      return label ? [...current, { label, contentMd: "", feedbackMd: "" }] : current;
    });
  }

  function removeOption(index: number): void {
    setOptions((current) => {
      if (current.length <= 2) return current;
      const next = current.filter((_, position) => position !== index);
      const relabelled = next.map((option, position) => ({ ...option, label: (OPTION_LABELS[position] ?? option.label) as OptionLabel }));
      if (answerKey.type === "multiple_choice" && !relabelled.some((option) => option.label === answerKey.correct)) {
        setAnswerKey({ v: 1, type: "multiple_choice", correct: relabelled[0]?.label ?? "A" });
      }
      if (answerKey.type === "multiple_select") {
        const allowed = new Set(relabelled.map((option) => option.label));
        const correct = answerKey.correct.filter((label) => allowed.has(label));
        setAnswerKey({
          v: 1,
          type: "multiple_select",
          correct: correct.length > 0 ? correct : [relabelled[0]?.label ?? "A"],
          scoring: answerKey.scoring,
        });
      }
      return relabelled;
    });
  }

  function toggleSecondary(id: string): void {
    setSecondaryTopicIds((current) =>
      current.includes(id) ? current.filter((topicId) => topicId !== id) : [...current, id],
    );
  }

  async function save(): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/studio/questions/${question.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          stemMd: stem,
          difficulty,
          points,
          explanationMd: explanation,
          secondaryTopicIds,
          options: type === "short_answer" ? [] : options.map((option) => ({
            label: option.label,
            contentMd: option.contentMd,
            ...(option.feedbackMd ? { feedbackMd: option.feedbackMd } : {}),
          })),
          answerKey,
          expectedUpdatedAt: updatedAt,
        }),
      });

      if (response.status === 409) {
        setNotice({ tone: "error", message: "Someone else saved this question first. Reload the page to see their version." });
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { data?: QuestionDetailDto; error?: unknown }
        | null;
      if (!response.ok || !body?.data) {
        setNotice({ tone: "error", message: apiErrorMessage(body, "Could not save this question.") });
        return;
      }

      setUpdatedAt(body.data.updatedAt);
      setNotice({ tone: "saved", message: "Question saved." });
      router.refresh();
    } catch {
      setNotice({ tone: "error", message: "Network error. Your changes are still here." });
    } finally {
      setBusy(false);
    }
  }

  async function validate(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/studio/questions/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: question.id }),
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: GateResult; error?: unknown }
        | null;
      if (body?.data) {
        setGate(body.data);
      } else {
        setGate({
          passing: false,
          blocking: [{ path: "", code: "error", message: apiErrorMessage(body, "Could not validate.") }],
          warnings: [],
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const secondaryCandidates = topics.filter((topic) => topic.id !== question.topicId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">Question</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void validate()}>
            Validate
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save question"}
          </Button>
        </div>
      </div>

      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={
            notice.tone === "error"
              ? "text-sm font-medium text-coral-ink"
              : notice.tone === "saved"
                ? "text-sm text-leaf"
                : "text-sm text-ink-2"
          }
        >
          {notice.message}
        </p>
      ) : null}

      {gate ? (
        <div className="rounded-md border border-line bg-paper-raised p-4 text-sm">
          <p className={gate.passing ? "font-medium text-leaf" : "font-medium text-coral-ink"}>
            {gate.passing ? "Every publish gate passes." : `${gate.blocking.length} gate(s) block publishing.`}
          </p>
          {gate.blocking.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-ink-2">
              {gate.blocking.map((detail) => (
                <li key={`${detail.path}-${detail.code}`}>
                  <span className="font-mono text-xs text-ink-3">{detail.path || "question"}</span> — {detail.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Type</span>
          <Select value={type} onChange={(event) => changeType(event.target.value as QuestionType)}>
            {QUESTION_TYPES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {TYPE_LABEL[candidate]}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Difficulty</span>
          <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="very_hard">Very hard</option>
          </Select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Points</span>
          <Input
            type="number"
            min={1}
            max={10}
            value={points}
            onChange={(event) => setPoints(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Question stem (Markdown)</span>
        <Textarea value={stem} rows={4} maxLength={4000} onChange={(event) => setStem(event.target.value)} />
      </label>

      {type !== "short_answer" ? (
        <section aria-labelledby="question-options" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="question-options" className="font-display text-lg font-semibold tracking-[-0.01em]">
              Options
            </h3>
            {type !== "true_false" ? (
              <Button type="button" size="sm" variant="secondary" disabled={options.length >= 8} onClick={addOption}>
                Add option
              </Button>
            ) : null}
          </div>

          <ul className="flex flex-col gap-3">
            {options.map((option, index) => (
              <li key={option.label} className="rounded-sm border border-line bg-paper-raised p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="neutral">{option.label}</Badge>

                  {type === "multiple_choice" ? (
                    <label className="flex items-center gap-2 text-sm text-ink-2">
                      <input
                        type="radio"
                        name="correct-option"
                        checked={answerKey.type === "multiple_choice" && answerKey.correct === option.label}
                        onChange={() => setAnswerKey({ v: 1, type: "multiple_choice", correct: option.label })}
                      />
                      Correct
                    </label>
                  ) : null}

                  {type === "multiple_select" ? (
                    <label className="flex items-center gap-2 text-sm text-ink-2">
                      <input
                        type="checkbox"
                        checked={answerKey.type === "multiple_select" && answerKey.correct.includes(option.label)}
                        onChange={() => {
                          if (answerKey.type !== "multiple_select") return;
                          const chosen = answerKey.correct.includes(option.label)
                            ? answerKey.correct.filter((label) => label !== option.label)
                            : [...answerKey.correct, option.label];
                          setAnswerKey({ ...answerKey, correct: chosen.length > 0 ? chosen : [option.label] });
                        }}
                      />
                      Correct
                    </label>
                  ) : null}

                  {type !== "true_false" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="ml-auto"
                      disabled={options.length <= 2}
                      onClick={() => removeOption(index)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-ink-2">Content (Markdown)</span>
                    <Textarea
                      rows={2}
                      value={option.contentMd}
                      disabled={type === "true_false"}
                      onChange={(event) => changeOption(index, { contentMd: event.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-ink-2">Feedback shown after grading</span>
                    <Textarea
                      rows={2}
                      value={option.feedbackMd}
                      onChange={(event) => changeOption(index, { feedbackMd: event.target.value })}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>

          {type === "multiple_select" ? (
            <label className="flex max-w-64 flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">Scoring</span>
              <Select
                value={answerKey.type === "multiple_select" ? answerKey.scoring : "all_or_nothing"}
                onChange={(event) =>
                  setAnswerKey({
                    v: 1,
                    type: "multiple_select",
                    correct: answerKey.type === "multiple_select" ? answerKey.correct : ["A"],
                    scoring: event.target.value === "partial" ? "partial" : "all_or_nothing",
                  })
                }
              >
                <option value="all_or_nothing">All or nothing</option>
                <option value="partial">Partial credit</option>
              </Select>
            </label>
          ) : null}
        </section>
      ) : (
        <section aria-labelledby="accepted-answers" className="flex flex-col gap-2">
          <h3 id="accepted-answers" className="font-display text-lg font-semibold tracking-[-0.01em]">
            Accepted answers
          </h3>
          <p className="text-sm text-ink-3">
            One per line, up to 20. Matching is normalised: case, spacing, accents and trailing
            punctuation are ignored. Two answers that normalise to the same text are refused.
          </p>
          <Textarea
            rows={4}
            value={answerKey.type === "short_answer" ? answerKey.accepted.join("\n") : ""}
            onChange={(event) =>
              setAnswerKey({
                v: 1,
                type: "short_answer",
                accepted: event.target.value.split("\n"),
              })
            }
          />
        </section>
      )}

      {type === "true_false" ? (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-ink">Correct answer</span>
          <label className="flex items-center gap-2 text-ink-2">
            <input
              type="radio"
              name="true-false"
              checked={answerKey.type === "true_false" && answerKey.correct}
              onChange={() => setAnswerKey({ v: 1, type: "true_false", correct: true })}
            />
            True
          </label>
          <label className="flex items-center gap-2 text-ink-2">
            <input
              type="radio"
              name="true-false"
              checked={answerKey.type === "true_false" && !answerKey.correct}
              onChange={() => setAnswerKey({ v: 1, type: "true_false", correct: false })}
            />
            False
          </label>
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Explanation (Markdown)</span>
        <span className="text-ink-3">At least 60 characters before the question can publish.</span>
        <Textarea value={explanation} rows={4} maxLength={4000} onChange={(event) => setExplanation(event.target.value)} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Also filed under</legend>
        <p className="text-sm text-ink-3">
          Cross-listed questions appear under each topic without duplicate rows (`ADR-003`). The
          primary topic is the one above and cannot be repeated here.
        </p>
        <div className="flex max-h-48 flex-wrap gap-3 overflow-y-auto rounded-sm border border-line p-3">
          {secondaryCandidates.map((topic) => (
            <label key={topic.id} className="flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={secondaryTopicIds.includes(topic.id)}
                onChange={() => toggleSecondary(topic.id)}
              />
              {topic.title}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
