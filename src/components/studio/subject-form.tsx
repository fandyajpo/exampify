"use client";

import { useActionState } from "react";

import { FormStatus } from "@/components/studio/form-status";
import { Button } from "@/components/ui/button";
import { SUBJECT_ICONS } from "@/components/ui/icons";
import { FormField, Input, Select, Textarea } from "@/components/ui/input";
import { SUBJECT_COLORS, toSubjectColor } from "@/lib/subject-colors";
import { createSubjectAction, updateSubjectAction } from "@/lib/studio/actions";
import { initialStudioFormState } from "@/lib/studio/form-state";
import type { SubjectDto } from "@/lib/validation/taxonomy";

type SubjectGroup = { id: string; name: string };

type Props =
  | { levelId: string; groups: readonly SubjectGroup[]; subject?: undefined }
  | { subject: SubjectDto; levelId?: undefined; groups?: undefined };

const ICON_KEYS = Object.keys(SUBJECT_ICONS);

/**
 * One form for both subject writes (`API_CONTRACTS.md` §7.1). A new subject is filed under
 * the level whose page hosts the form and needs its group; an existing subject keeps its
 * level and group — moving it is a separate operation the API does not offer yet. Status
 * moves through `§7.5`, never through this form.
 */
export function SubjectForm(props: Props): React.JSX.Element {
  const subject = props.subject;
  const [state, formAction, pending] = useActionState(
    subject ? updateSubjectAction : createSubjectAction,
    initialStudioFormState,
  );

  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {subject ? (
        <>
          <input type="hidden" name="id" value={subject.id} />
          <input type="hidden" name="expectedUpdatedAt" value={subject.updatedAt} />
        </>
      ) : (
        <>
          <input type="hidden" name="educationLevelId" value={props.levelId} />
          <FormField id="subject-group" label="Subject group" required error={errors.subjectGroupId ?? null}>
            {(control) => (
              <Select {...control} name="subjectGroupId" defaultValue="">
                <option value="" disabled>
                  Choose a group
                </option>
                {props.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </>
      )}

      <FormStatus state={state} />

      <FormField id="subject-name" label="Name" required error={errors.name ?? null}>
        {(control) => (
          <Input {...control} name="name" defaultValue={subject?.name ?? ""} maxLength={60} />
        )}
      </FormField>

      <FormField
        id="subject-slug"
        label="Slug"
        hint={
          subject
            ? "Changing it breaks the old URL until a redirect exists."
            : "Leave blank to derive it from the name. Must be unique in the level."
        }
        error={errors.slug ?? null}
      >
        {(control) => <Input {...control} name="slug" defaultValue={subject?.slug ?? ""} />}
      </FormField>

      <FormField
        id="subject-summary"
        label="Summary"
        hint="Up to 320 characters, shown on the subject card."
        error={errors.summary ?? null}
      >
        {(control) => (
          <Textarea {...control} name="summary" rows={3} defaultValue={subject?.summary ?? ""} maxLength={320} />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="subject-color"
          label="Colour token"
          hint="The subject's identity colour."
          error={errors.colorToken ?? null}
        >
          {(control) => (
            <Select
              {...control}
              name="colorToken"
              defaultValue={subject ? toSubjectColor(subject.colorToken) : "cobalt"}
            >
              {SUBJECT_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField id="subject-icon" label="Icon" hint="The glyph on the subject card." error={errors.iconKey ?? null}>
          {(control) => (
            <Select {...control} name="iconKey" defaultValue={subject?.iconKey ?? "book-open"}>
              {ICON_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <FormField
        id="subject-position"
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
            defaultValue={subject ? String(subject.position) : ""}
          />
        )}
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : subject ? "Save subject" : "Create subject"}
        </Button>
      </div>
    </form>
  );
}
