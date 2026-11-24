"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormField, Select, Textarea } from "@/components/ui/input";
import { createQuestionAction } from "@/lib/studio/actions";
import { initialStudioFormState } from "@/lib/studio/form-state";
import { QUESTION_TYPES } from "@/lib/validation/questions";

/**
 * The question bank's create form (`API_CONTRACTS.md` §7.4). It collects the three fields a
 * draft cannot exist without — primary topic, type and stem — and the editor takes over from
 * there; the answer key, options and cross-listings are the editor's job.
 */

const TYPE_LABEL: Record<(typeof QUESTION_TYPES)[number], string> = {
  multiple_choice: "Multiple choice",
  multiple_select: "Multiple select",
  true_false: "True / false",
  short_answer: "Short answer",
};

export function QuestionCreateForm({
  topics,
}: {
  topics: readonly { id: string; title: string }[];
}): React.JSX.Element {
  const [state, formAction, pending] = useActionState(createQuestionAction, initialStudioFormState);
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" ? (
        <p role="alert" className="rounded-sm border border-coral/40 bg-blush/30 px-3 py-2 text-sm text-coral-ink">
          {state.message}
        </p>
      ) : null}

      <FormField id="question-topic" label="Primary topic" required error={errors.topicId ?? null}>
        {(control) => (
          <Select {...control} name="topicId" defaultValue="">
            <option value="" disabled>
              Choose a topic
            </option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField id="question-type" label="Type" required error={errors.type ?? null}>
        {(control) => (
          <Select {...control} name="type" defaultValue="multiple_choice">
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField
        id="question-stem"
        label="Question"
        required
        hint="The stem, in Markdown. At least 10 characters; the editor offers a starter for each type."
        error={errors.stemMd ?? null}
      >
        {(control) => <Textarea {...control} name="stemMd" rows={3} maxLength={4000} />}
      </FormField>

      <FormField id="question-difficulty" label="Difficulty" error={errors.difficulty ?? null}>
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
