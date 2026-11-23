"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/input";
import { createResourceAction, updateResourceAction } from "@/lib/studio/actions";
import { initialStudioFormState } from "@/lib/studio/form-state";
import type { ResourceDto } from "@/lib/validation/resources";

type Props = { topicId: string; resource?: undefined } | { resource: ResourceDto; topicId?: undefined };

const DIFFICULTIES = ["easy", "medium", "hard", "very_hard"] as const;

/**
 * One form for both resource writes (`API_CONTRACTS.md` §7.2): `topicId` creates a draft in
 * that topic, a `resource` edits metadata with the `updatedAt` it was rendered with. Blocks
 * are edited in `ResourceEditor`; status moves through the transition endpoint.
 */
export function ResourceForm(props: Props): React.JSX.Element {
  const resource = props.resource;
  const [state, formAction, pending] = useActionState(
    resource ? updateResourceAction : createResourceAction,
    initialStudioFormState,
  );

  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {resource ? (
        <>
          <input type="hidden" name="id" value={resource.id} />
          <input type="hidden" name="expectedUpdatedAt" value={resource.updatedAt} />
        </>
      ) : (
        <input type="hidden" name="topicId" value={props.topicId} />
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

      <FormField
        id="resource-title"
        label="Title"
        hint="A claim, not a label — “Inertia is resistance to change in motion”."
        required
        error={errors.title ?? null}
      >
        {(control) => (
          <Input {...control} name="title" defaultValue={resource?.title ?? ""} maxLength={120} />
        )}
      </FormField>

      <FormField
        id="resource-slug"
        label="Slug"
        hint={
          resource ? "Changing it breaks the old URL until a redirect exists." : "Leave blank to derive it from the title."
        }
        error={errors.slug ?? null}
      >
        {(control) => <Input {...control} name="slug" defaultValue={resource?.slug ?? ""} />}
      </FormField>

      <FormField id="resource-subtitle" label="Subtitle" hint="Up to 160 characters." error={errors.subtitle ?? null}>
        {(control) => (
          <Input {...control} name="subtitle" defaultValue={resource?.subtitle ?? ""} maxLength={160} />
        )}
      </FormField>

      <FormField id="resource-summary" label="Summary" hint="Up to 240 characters; the meta description fallback." error={errors.summary ?? null}>
        {(control) => (
          <Textarea {...control} name="summary" rows={2} defaultValue={resource?.summary ?? ""} maxLength={240} />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="resource-difficulty" label="Difficulty" error={errors.difficulty ?? null}>
          {(control) => (
            <Select {...control} name="difficulty" defaultValue={resource?.difficulty ?? "medium"}>
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty.replace("_", " ")}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          id="resource-position"
          label="Position"
          hint="Reading order. Leave blank to append."
          error={errors.position ?? null}
        >
          {(control) => (
            <Input
              {...control}
              name="position"
              type="number"
              min={0}
              defaultValue={resource ? String(resource.position) : ""}
            />
          )}
        </FormField>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : resource ? "Save resource" : "Create resource"}
        </Button>
      </div>
    </form>
  );
}
