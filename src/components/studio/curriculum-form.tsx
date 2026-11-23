"use client";

import { useActionState } from "react";

import { FormStatus } from "@/components/studio/form-status";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { createCurriculumAction, updateCurriculumAction } from "@/lib/studio/actions";
import { initialStudioFormState } from "@/lib/studio/form-state";
import type { CurriculumDto } from "@/lib/validation/taxonomy";

type Props = { curriculum?: CurriculumDto };

/**
 * One form for both curriculum writes (`API_CONTRACTS.md` §7.1): no `curriculum` creates a
 * draft at the top of the taxonomy, a `curriculum` edits it with the `expectedUpdatedAt` it
 * was rendered with. Status is not here — it moves through `§7.5`.
 */
export function CurriculumForm({ curriculum }: Props): React.JSX.Element {
  const [state, formAction, pending] = useActionState(
    curriculum ? updateCurriculumAction : createCurriculumAction,
    initialStudioFormState,
  );

  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {curriculum ? (
        <>
          <input type="hidden" name="id" value={curriculum.id} />
          <input type="hidden" name="expectedUpdatedAt" value={curriculum.updatedAt} />
        </>
      ) : null}

      <FormStatus state={state} />

      <FormField id="curriculum-name" label="Name" required error={errors.name ?? null}>
        {(control) => (
          <Input {...control} name="name" defaultValue={curriculum?.name ?? ""} maxLength={80} />
        )}
      </FormField>

      <FormField
        id="curriculum-short-name"
        label="Short name"
        hint="The badge form, up to 20 characters, e.g. IGCSE."
        required
        error={errors.shortName ?? null}
      >
        {(control) => (
          <Input {...control} name="shortName" defaultValue={curriculum?.shortName ?? ""} maxLength={20} />
        )}
      </FormField>

      <FormField
        id="curriculum-slug"
        label="Slug"
        hint={
          curriculum
            ? "Changing it breaks the old URL until a redirect exists."
            : "Leave blank to derive it from the name."
        }
        error={errors.slug ?? null}
      >
        {(control) => <Input {...control} name="slug" defaultValue={curriculum?.slug ?? ""} />}
      </FormField>

      <FormField
        id="curriculum-description"
        label="Description"
        hint="Markdown, up to 4,000 characters."
        error={errors.descriptionMd ?? null}
      >
        {(control) => (
          <Textarea
            {...control}
            name="descriptionMd"
            rows={4}
            defaultValue={curriculum?.descriptionMd ?? ""}
            maxLength={4_000}
          />
        )}
      </FormField>

      <FormField
        id="curriculum-position"
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
            defaultValue={curriculum ? String(curriculum.position) : ""}
          />
        )}
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : curriculum ? "Save curriculum" : "Create curriculum"}
        </Button>
      </div>
    </form>
  );
}
