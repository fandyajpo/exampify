/**
 * The state a studio form action hands back, in its own module so a client component can
 * import the type without importing the `"use server"` module.
 */

export type StudioFormField =
  | "name"
  | "shortName"
  | "descriptionMd"
  | "colorToken"
  | "iconKey"
  | "subjectGroupId"
  | "title"
  | "slug"
  | "summary"
  | "position"
  | "subtitle"
  | "difficulty"
  | "learningObjectives"
  | "estimatedMinutes"
  | "type"
  | "stemMd"
  | "mode"
  | "durationSeconds"
  | "topicId"
  | "subjectId";

export type StudioFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: Partial<Record<StudioFormField, string>> }
  | { status: "error"; message: string }
  | { status: "saved"; message: string };

export const initialStudioFormState: StudioFormState = { status: "idle" };
