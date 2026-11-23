/**
 * The state a server action hands back to an auth form. It is a plain type in its own
 * module so the client components can import it without importing the `"use server"`
 * module itself.
 */

export type AuthField =
  | "name"
  | "email"
  | "password"
  | "confirmPassword"
  | "ageAttested"
  | "token";

export type AuthFormValues = {
  name?: string;
  email?: string;
};

export type AuthFormState =
  | { status: "idle" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<AuthField, string>>;
      values: AuthFormValues;
    }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

/**
 * The action's field errors, minus the fields the user has edited since that submit. The
 * action state outlives the edits, so without this a stale "Enter your email address"
 * would stay under an address the user just fixed.
 */
export function actionFieldErrors<Field extends AuthField>(
  state: AuthFormState,
  changed: readonly Field[],
): Partial<Record<Field, string>> {
  if (state.status !== "invalid") return {};

  const errors: Partial<Record<Field, string>> = {};
  const entries = Object.entries(state.fieldErrors) as [Field, string | undefined][];

  for (const [field, message] of entries) {
    if (message && !changed.includes(field)) errors[field] = message;
  }

  return errors;
}

export const initialAuthState: AuthFormState = { status: "idle" };
