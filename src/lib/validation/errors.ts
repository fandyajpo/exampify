import type { ZodError } from "zod";

/**
 * Flattens a `ZodError` into one message per field. The first issue for a field wins, so
 * a cross-field refinement cannot overwrite the specific message beside the input.
 *
 * The field type is a parameter because callers narrow it to the fields their form owns.
 */
export function toFieldErrors<Field extends string>(
  error: ZodError,
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as Field] = issue.message;
    }
  }

  return errors;
}
