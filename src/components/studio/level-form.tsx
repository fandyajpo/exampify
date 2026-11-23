"use client";

import { useActionState } from "react";

import { FormStatus } from "@/components/studio/form-status";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { createLevelAction, updateLevelAction } from "@/lib/studio/actions";
import { initialStudioFormState } from "@/lib/studio/form-state";
import type { LevelDto } from "@/lib/validation/taxonomy";

type Props = { curriculumId: string; level?: undefined } | { level: LevelDto; curriculumId?: undefined };

/**
 * One form for both level writes (`API_CONTRACTS.md` §7.1): `curriculumId` creates a draft
 * under that curriculum, a `level` edits it with the `expectedUpdatedAt` it was rendered
 * with. Status is not here — it moves through `§7.5`.
 */
export function LevelForm(props: Props): React.JSX.Element {
  const level = props.level;
  const [state, formAction, pending] = useActionState(
    level ? updateLevelAction : createLevelAction,
    initialStudioFormState,
  );

  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {level ? (
        <>
          <input type="hidden" name="id" value={level.id} />
          <input type="hidden" name="expectedUpdatedAt" value={level.updatedAt} />
        </>
      ) : (
        <input type="hidden" name="curriculumId" value={props.curriculumId} />
      )}

      <FormStatus state={state} />

      <FormField id="level-name" label="Name" required error={errors.name ?? null}>
        {(control) => (
          <Input {...control} name="name" defaultValue={level?.name ?? ""} maxLength={40} />
        )}
      </FormField>

      <FormField
        id="level-slug"
        label="Slug"
        hint={
          level ? "Changing it breaks the old URL until a redirect exists." : "Leave blank to derive it from the name."
        }
        error={errors.slug ?? null}
      >
        {(control) => <Input {...control} name="slug" defaultValue={level?.slug ?? ""} />}
      </FormField>

      <FormField
        id="level-description"
        label="Description"
        hint="Markdown, up to 4,000 characters."
        error={errors.descriptionMd ?? null}
      >
        {(control) => (
          <Textarea
            {...control}
            name="descriptionMd"
            rows={4}
            defaultValue={level?.descriptionMd ?? ""}
            maxLength={4_000}
          />
        )}
      </FormField>

      <FormField
        id="level-position"
        label="Position"
        hint="Lower comes first. Leave blank to append."
        error={errors.position ?? null}
      >
        {(control) => (
          <Input
            {...control}
            name="position"
            type="number"
            min={0}
            defaultValue={level ? String(level.position) : ""}
          />
        )}
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : level ? "Save level" : "Create level"}
        </Button>
      </div>
    </form>
  );
}
