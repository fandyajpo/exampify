"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";

import { requireCapability } from "@/lib/auth/actor";
import { HttpError } from "@/lib/http/errors";
import {
  createResource,
  duplicateResource,
  updateResource,
} from "@/lib/services/resources-admin";
import {
  createChapter,
  createCurriculum,
  createLevel,
  createSubject,
  createTopic,
  updateChapter,
  updateCurriculum,
  updateLevel,
  updateSubject,
  updateTopic,
} from "@/lib/services/taxonomy-admin";
import { transitionEntity } from "@/lib/services/transitions";
import {
  chapterCreateSchema,
  chapterUpdateSchema,
  curriculumCreateSchema,
  curriculumUpdateSchema,
  levelCreateSchema,
  levelUpdateSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
  topicCreateSchema,
  topicUpdateSchema,
} from "@/lib/validation/taxonomy";
import { toFieldErrors } from "@/lib/validation/errors";
import { resourceCreateSchema, resourceUpdateSchema } from "@/lib/validation/resources";
import { TRANSITION_ENTITIES, transitionSchema } from "@/lib/validation/transitions";

import type { StudioFormField, StudioFormState } from "./form-state";
import type { TransitionState } from "./transition-state";

/**
 * The studio write actions (`API_CONTRACTS.md` §7.1), the form-shaped twin of the
 * `/api/v1/studio/**` routes.
 *
 * They go through the same capability guard, the same Zod schemas and the same services as
 * the API, so a form can never write something the route would refuse. `status` is absent
 * by design: publish moves through `transitionAction` below, the form-shaped `§7.5`
 * endpoint, so the publish gates cannot be skipped by editing a form.
 */

const GENERIC_FAILURE = "Something went wrong. Try again in a moment.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optional(formData: FormData, key: string): string | undefined {
  const value = text(formData, key).trim();
  return value === "" ? undefined : value;
}

function optionalNumber(formData: FormData, key: string): number | undefined {
  const value = optional(formData, key);
  return value === undefined ? undefined : Number(value);
}

/** The textarea is one objective per line; blank lines are not objectives. */
function objectives(formData: FormData, key: string): string[] {
  return text(formData, key)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function invalid(error: ZodError): StudioFormState {
  return { status: "invalid", fieldErrors: toFieldErrors<StudioFormField>(error) };
}

/** A service refusal keeps its documented message; anything else stays generic. */
function failed(error: unknown): StudioFormState {
  if (error instanceof HttpError) return { status: "error", message: error.message };
  console.error(
    JSON.stringify({
      level: "error",
      event: "studio_form_failed",
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return { status: "error", message: GENERIC_FAILURE };
}

export async function createChapterAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("content:write");
  const parsed = chapterCreateSchema.safeParse({
    subjectId: text(formData, "subjectId"),
    title: text(formData, "title"),
    slug: optional(formData, "slug"),
    summary: optional(formData, "summary"),
    position: optionalNumber(formData, "position"),
  });
  if (!parsed.success) return invalid(parsed.error);

  let chapterId: string;
  try {
    chapterId = (await createChapter(actor, parsed.data)).id;
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  redirect(`/studio/chapters/${chapterId}`);
}

export async function updateChapterAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("content:write");
  const parsed = chapterUpdateSchema.safeParse({
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    summary: optional(formData, "summary"),
    position: optionalNumber(formData, "position"),
    expectedUpdatedAt: text(formData, "expectedUpdatedAt"),
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateChapter(actor, text(formData, "id"), parsed.data);
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  return { status: "saved", message: "Chapter saved." };
}

export async function createTopicAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("content:write");
  const parsed = topicCreateSchema.safeParse({
    chapterId: text(formData, "chapterId"),
    title: text(formData, "title"),
    slug: optional(formData, "slug"),
    summary: optional(formData, "summary"),
    learningObjectives: objectives(formData, "learningObjectives"),
    estimatedMinutes: optionalNumber(formData, "estimatedMinutes"),
    position: optionalNumber(formData, "position"),
  });
  if (!parsed.success) return invalid(parsed.error);

  let topicId: string;
  try {
    topicId = (await createTopic(actor, parsed.data)).id;
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  redirect(`/studio/topics/${topicId}`);
}

const MOVED_TO: Record<string, string> = {
  draft: "Moved back to draft.",
  in_review: "Submitted for review.",
  published: "Published.",
  archived: "Archived.",
};

/**
 * The `§7.5` transition, as a form action: the twin of `POST /studio/{entity}/{id}/transition`.
 *
 * A gate refusal comes back with its `details`, so the author sees which field blocked the
 * publish instead of a generic failure. `role` is enforced inside the service, not here —
 * the form only offers the buttons the role may press.
 */
export async function transitionAction(
  _previous: TransitionState,
  formData: FormData,
): Promise<TransitionState> {
  const actor = await requireCapability("content:write");
  const entity = TRANSITION_ENTITIES.find((candidate) => candidate === text(formData, "entity"));
  if (!entity) return { status: "error", message: GENERIC_FAILURE, details: [] };

  const parsed = transitionSchema.safeParse({
    to: text(formData, "to"),
    reason: optional(formData, "reason"),
  });
  if (!parsed.success) {
    const fieldErrors = toFieldErrors<"to" | "reason">(parsed.error);
    return {
      status: "error",
      message: "That change needs a little more information.",
      details: Object.entries(fieldErrors).flatMap(([path, message]) =>
        message ? [{ path, message }] : [],
      ),
    };
  }

  try {
    const result = await transitionEntity(entity, text(formData, "id"), actor, parsed.data);
    revalidatePath("/studio", "layout");
    return { status: "saved", message: MOVED_TO[result.status] ?? "Status updated." };
  } catch (error) {
    if (error instanceof HttpError) {
      return { status: "error", message: error.message, details: error.details ?? [] };
    }
    return { status: "error", message: GENERIC_FAILURE, details: [] };
  }
}

export async function updateTopicAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("content:write");
  const parsed = topicUpdateSchema.safeParse({
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    summary: optional(formData, "summary"),
    learningObjectives: objectives(formData, "learningObjectives"),
    estimatedMinutes: optionalNumber(formData, "estimatedMinutes"),
    position: optionalNumber(formData, "position"),
    expectedUpdatedAt: text(formData, "expectedUpdatedAt"),
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateTopic(actor, text(formData, "id"), parsed.data);
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  return { status: "saved", message: "Topic saved." };
}

export async function createCurriculumAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  // The taxonomy is `admin`-only at the route (`taxonomy:write`); the form must not be a
  // wider door than the API it mirrors.
  const actor = await requireCapability("taxonomy:write");
  const parsed = curriculumCreateSchema.safeParse({
    name: text(formData, "name"),
    shortName: text(formData, "shortName"),
    slug: optional(formData, "slug"),
    descriptionMd: optional(formData, "descriptionMd"),
    position: optionalNumber(formData, "position"),
  });
  if (!parsed.success) return invalid(parsed.error);

  let curriculumId: string;
  try {
    curriculumId = (await createCurriculum(actor, parsed.data)).id;
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  redirect(`/studio/curricula/${curriculumId}`);
}

export async function updateCurriculumAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("taxonomy:write");
  const parsed = curriculumUpdateSchema.safeParse({
    name: text(formData, "name"),
    shortName: text(formData, "shortName"),
    // The form always sends the slug it was rendered with; a blank one is a field error,
    // exactly as `PATCH /studio/curricula/{id}` would answer.
    slug: text(formData, "slug"),
    descriptionMd: optional(formData, "descriptionMd"),
    position: optionalNumber(formData, "position"),
    expectedUpdatedAt: text(formData, "expectedUpdatedAt"),
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateCurriculum(actor, text(formData, "id"), parsed.data);
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  return { status: "saved", message: "Curriculum saved." };
}

export async function createLevelAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("taxonomy:write");
  const parsed = levelCreateSchema.safeParse({
    name: text(formData, "name"),
    slug: optional(formData, "slug"),
    descriptionMd: optional(formData, "descriptionMd"),
    position: optionalNumber(formData, "position"),
  });
  if (!parsed.success) return invalid(parsed.error);

  let levelId: string;
  try {
    levelId = (await createLevel(actor, text(formData, "curriculumId"), parsed.data)).id;
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  redirect(`/studio/levels/${levelId}`);
}

export async function updateLevelAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("taxonomy:write");
  const parsed = levelUpdateSchema.safeParse({
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    descriptionMd: optional(formData, "descriptionMd"),
    position: optionalNumber(formData, "position"),
    expectedUpdatedAt: text(formData, "expectedUpdatedAt"),
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateLevel(actor, text(formData, "id"), parsed.data);
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  return { status: "saved", message: "Level saved." };
}

export async function createSubjectAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("taxonomy:write");
  const parsed = subjectCreateSchema.safeParse({
    educationLevelId: text(formData, "educationLevelId"),
    subjectGroupId: text(formData, "subjectGroupId"),
    name: text(formData, "name"),
    slug: optional(formData, "slug"),
    summary: optional(formData, "summary"),
    colorToken: optional(formData, "colorToken"),
    iconKey: optional(formData, "iconKey"),
    position: optionalNumber(formData, "position"),
  });
  if (!parsed.success) return invalid(parsed.error);

  let subjectId: string;
  try {
    subjectId = (await createSubject(actor, parsed.data)).id;
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  redirect(`/studio/subjects/${subjectId}`);
}

export async function createResourceAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("content:write");
  const parsed = resourceCreateSchema.safeParse({
    title: text(formData, "title"),
    slug: optional(formData, "slug"),
    subtitle: optional(formData, "subtitle"),
    summary: optional(formData, "summary"),
    difficulty: optional(formData, "difficulty"),
    position: optionalNumber(formData, "position"),
  });
  if (!parsed.success) return invalid(parsed.error);

  let resourceId: string;
  try {
    resourceId = (await createResource(actor, text(formData, "topicId"), parsed.data)).id;
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  redirect(`/studio/resources/${resourceId}`);
}

export async function updateResourceAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("content:write");
  const parsed = resourceUpdateSchema.safeParse({
    title: text(formData, "title"),
    slug: optional(formData, "slug"),
    subtitle: optional(formData, "subtitle"),
    summary: optional(formData, "summary"),
    difficulty: optional(formData, "difficulty"),
    position: optionalNumber(formData, "position"),
    expectedUpdatedAt: text(formData, "expectedUpdatedAt"),
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateResource(actor, text(formData, "id"), parsed.data);
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  return { status: "saved", message: "Resource saved." };
}

/** Duplicate always acts on the current row, so it needs no form state of its own. */
export async function duplicateResourceAction(formData: FormData): Promise<void> {
  const actor = await requireCapability("content:write");
  const copy = await duplicateResource(actor, text(formData, "id"));
  revalidatePath("/studio", "layout");
  redirect(`/studio/resources/${copy.id}`);
}

export async function updateSubjectAction(
  _previous: StudioFormState,
  formData: FormData,
): Promise<StudioFormState> {
  const actor = await requireCapability("taxonomy:write");
  const parsed = subjectUpdateSchema.safeParse({
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    summary: optional(formData, "summary"),
    colorToken: optional(formData, "colorToken"),
    iconKey: optional(formData, "iconKey"),
    position: optionalNumber(formData, "position"),
    expectedUpdatedAt: text(formData, "expectedUpdatedAt"),
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateSubject(actor, text(formData, "id"), parsed.data);
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/studio", "layout");
  return { status: "saved", message: "Subject saved." };
}
