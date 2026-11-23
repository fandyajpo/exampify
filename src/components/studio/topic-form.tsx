"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { createTopicAction, updateTopicAction } from "@/lib/studio/actions";
import { initialStudioFormState } from "@/lib/studio/form-state";
import type { TopicDto } from "@/lib/validation/taxonomy";

type Props = { chapterId: string; topic?: undefined } | { topic: TopicDto; chapterId?: undefined };

/** One form for both topic writes (§7.1); objectives are one per line. */
export function TopicForm(props: Props): React.JSX.Element {
  const topic = props.topic;
  const [state, formAction, pending] = useActionState(
    topic ? updateTopicAction : createTopicAction,
    initialStudioFormState,
  );

  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {topic ? (
        <>
          <input type="hidden" name="id" value={topic.id} />
          <input type="hidden" name="expectedUpdatedAt" value={topic.updatedAt} />
        </>
      ) : (
        <input type="hidden" name="chapterId" value={props.chapterId} />
      )}

      {state.status === "error" ? (
        <p role="alert" className="rounded-sm border border-coral/40 bg-blush/30 px-3 py-2 text-sm text-coral-ink">
          {state.message}
        </p>
      ) : null}
      {state.status === "saved" ? (
        <p role="status" className="rounded-sm border border-leaf/30 bg-mint/25 px-3 py-2 text-sm text-leaf">
          {state.message}
        </p>
      ) : null}

      <FormField id="topic-title" label="Title" required error={errors.title ?? null}>
        {(control) => (
          <Input {...control} name="title" defaultValue={topic?.title ?? ""} maxLength={100} />
        )}
      </FormField>

      <FormField
        id="topic-slug"
        label="Slug"
        hint={topic ? "Changing it breaks the old URL until a redirect exists." : "Leave blank to derive it from the title."}
        error={errors.slug ?? null}
      >
        {(control) => <Input {...control} name="slug" defaultValue={topic?.slug ?? ""} />}
      </FormField>

      <FormField
        id="topic-summary"
        label="Summary"
        hint="Up to 320 characters. Required before the topic can publish."
        error={errors.summary ?? null}
      >
        {(control) => (
          <Textarea {...control} name="summary" rows={3} defaultValue={topic?.summary ?? ""} maxLength={320} />
        )}
      </FormField>

      <FormField
        id="topic-objectives"
        label="Learning objectives"
        required
        hint="One per line. Between 1 and 12, each 8–160 characters."
        error={errors.learningObjectives ?? null}
      >
        {(control) => (
          <Textarea
            {...control}
            name="learningObjectives"
            rows={4}
            defaultValue={topic?.learningObjectives.join("\n") ?? ""}
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="topic-minutes"
          label="Estimated minutes"
          hint="5–240, or blank to compute later."
          error={errors.estimatedMinutes ?? null}
        >
          {(control) => (
            <Input
              {...control}
              name="estimatedMinutes"
              type="number"
              min={5}
              max={240}
              defaultValue={topic?.estimatedMinutes ? String(topic.estimatedMinutes) : ""}
            />
          )}
        </FormField>

        <FormField id="topic-position" label="Position" hint="Lower comes first." error={errors.position ?? null}>
          {(control) => (
            <Input
              {...control}
              name="position"
              type="number"
              min={0}
              defaultValue={topic ? String(topic.position) : ""}
            />
          )}
        </FormField>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : topic ? "Save topic" : "Create topic"}
        </Button>
      </div>
    </form>
  );
}
