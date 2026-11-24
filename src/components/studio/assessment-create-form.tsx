"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/input";
import { createAssessmentAction } from "@/lib/studio/actions";
import { initialStudioFormState } from "@/lib/studio/form-state";

/**
 * The composer's create form (`API_CONTRACTS.md` §7.3): scope, title and mode. The shell is
 * created empty and the composer fills the items, because ordering questions before a title
 * exists is backwards; the publish gate is what requires 1–60.
 */

export function AssessmentCreateForm({
  subjects,
  topics,
}: {
  subjects: readonly { id: string; name: string }[];
  topics: readonly { id: string; title: string; subjectId: string }[];
}): React.JSX.Element {
  const [state, formAction, pending] = useActionState(createAssessmentAction, initialStudioFormState);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [mode, setMode] = useState("practice");
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  const scopedTopics = topics.filter((topic) => topic.subjectId === subjectId);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" ? (
        <p role="alert" className="rounded-sm border border-coral/40 bg-blush/30 px-3 py-2 text-sm text-coral-ink">
          {state.message}
        </p>
      ) : null}

      <FormField id="assessment-title" label="Title" required error={errors.title ?? null}>
        {(control) => <Input {...control} name="title" maxLength={120} />}
      </FormField>

      <FormField id="assessment-subject" label="Subject" required error={errors.subjectId ?? null}>
        {(control) => (
          <Select
            {...control}
            name="subjectId"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField
        id="assessment-topic"
        label="Topic"
        hint="Leave as course-wide for a practice test that draws on the whole subject."
        error={errors.topicId ?? null}
      >
        {(control) => (
          <Select {...control} name="topicId" defaultValue="">
            <option value="">Course-wide (the whole subject)</option>
            {scopedTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="assessment-mode" label="Mode" required error={errors.mode ?? null}>
          {(control) => (
            <Select {...control} name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="practice">Practice (untimed, reveals per answer)</option>
              <option value="test">Test (timed, reveals on submit)</option>
              <option value="mock">Mock exam (timed)</option>
            </Select>
          )}
        </FormField>

        <FormField
          id="assessment-duration"
          label="Duration (seconds)"
          hint={mode === "practice" ? "A practice set is untimed." : "60–10 800 seconds."}
          error={errors.durationSeconds ?? null}
        >
          {(control) => (
            <Input
              {...control}
              name="durationSeconds"
              type="number"
              min={60}
              max={10800}
              disabled={mode === "practice"}
            />
          )}
        </FormField>
      </div>

      <FormField id="assessment-difficulty" label="Difficulty" error={errors.difficulty ?? null}>
        {(control) => (
          <Select {...control} name="difficulty" defaultValue="medium">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="very_hard">Very hard</option>
          </Select>
        )}
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
