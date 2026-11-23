"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { createChapterAction, updateChapterAction } from "@/lib/studio/actions";
import { initialStudioFormState } from "@/lib/studio/form-state";
import type { ChapterDto } from "@/lib/validation/taxonomy";

type Props = { subjectId: string; chapter?: undefined } | { chapter: ChapterDto; subjectId?: undefined };

/**
 * One form for both chapter writes (`API_CONTRACTS.md` §7.1): `subjectId` creates a draft
 * under that subject, a `chapter` edits it with the `expectedUpdatedAt` it was rendered
 * with. Validation is the server schema's; a refusal comes back per field.
 */
export function ChapterForm(props: Props): React.JSX.Element {
  const chapter = props.chapter;
  const [state, formAction, pending] = useActionState(
    chapter ? updateChapterAction : createChapterAction,
    initialStudioFormState,
  );

  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {chapter ? (
        <>
          <input type="hidden" name="id" value={chapter.id} />
          <input type="hidden" name="expectedUpdatedAt" value={chapter.updatedAt} />
        </>
      ) : (
        <input type="hidden" name="subjectId" value={props.subjectId} />
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

      <FormField id="chapter-title" label="Title" required error={errors.title ?? null}>
        {(control) => (
          <Input {...control} name="title" defaultValue={chapter?.title ?? ""} maxLength={100} />
        )}
      </FormField>

      <FormField
        id="chapter-slug"
        label="Slug"
        hint={
          chapter ? "Changing it breaks the old URL until a redirect exists." : "Leave blank to derive it from the title."
        }
        error={errors.slug ?? null}
      >
        {(control) => <Input {...control} name="slug" defaultValue={chapter?.slug ?? ""} />}
      </FormField>

      <FormField
        id="chapter-summary"
        label="Summary"
        hint="Up to 240 characters, shown on the chapter page."
        error={errors.summary ?? null}
      >
        {(control) => (
          <Textarea {...control} name="summary" rows={3} defaultValue={chapter?.summary ?? ""} maxLength={240} />
        )}
      </FormField>

      <FormField
        id="chapter-position"
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
            defaultValue={chapter ? String(chapter.position) : ""}
          />
        )}
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : chapter ? "Save chapter" : "Create chapter"}
        </Button>
      </div>
    </form>
  );
}
