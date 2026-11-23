"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";

import { AGE_GATE_VERSION } from "@/lib/auth/age-gate";
import { safeNextPath, withNext } from "@/lib/auth/next";
import { auth } from "@/lib/auth/server";
import {
  emailSchema,
  resetPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/errors";

import type { AuthField, AuthFormState, AuthFormValues } from "./form-state";

/**
 * The auth form actions (`API_CONTRACTS.md` §3, `USER_FLOWS.md` §6), delegating the
 * mechanics to Better Auth (`ADR-017`).
 *
 * Each action validates with the same Zod schema the form uses, so a field message is
 * never written twice, then calls `auth.api.*`. `nextCookies()` in the auth config copies
 * the session cookie out of that response into Next.js, which is what makes sign-in and
 * sign-up actually stick.
 */

const FIELD_NAMES = [
  "name",
  "email",
  "password",
  "confirmPassword",
  "token",
  "ageAttested",
] as const;

const GENERIC_FAILURE = "Something went wrong. Try again in a moment.";
const INVALID_CREDENTIALS = "Email or password is incorrect.";

/**
 * The one code 1.7.27 throws for a registered address: with `requireEmailVerification: false`
 * and auto sign-in on, the library throws instead of returning its generic duplicate body.
 */
const DUPLICATE_ACCOUNT_CODE = "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";

/** Echoes only the values a failed form may safely show again (never the password). */
function echo(values: Record<string, string>): AuthFormValues {
  const echoed: AuthFormValues = {};
  if (values.name) echoed.name = values.name;
  if (values.email) echoed.email = values.email;
  return echoed;
}

function read(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const name of FIELD_NAMES) {
    const entry = formData.get(name);
    values[name] = typeof entry === "string" ? entry : "";
  }

  return values;
}

function invalid(error: ZodError, values: Record<string, string>): AuthFormState {
  return {
    status: "invalid",
    fieldErrors: toFieldErrors<AuthField>(error),
    values: echo(values),
  };
}

function errorCode(error: unknown): string | undefined {
  return error instanceof APIError ? error.body?.code : undefined;
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = read(formData);
  const next = safeNextPath(formData.get("next")?.toString());
  const parsed = signInSchema.safeParse(values);

  if (!parsed.success) return invalid(parsed.error, values);

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    // One message for an unknown address and a wrong password: the form must not become an
    // account-existence oracle (`SEC §4.2`).
    if (errorCode(error) === "INVALID_EMAIL_OR_PASSWORD") {
      return { status: "error", message: INVALID_CREDENTIALS };
    }
    return { status: "error", message: GENERIC_FAILURE };
  }

  redirect(next ?? "/");
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = read(formData);
  const parsed = signUpSchema.safeParse(values);

  if (!parsed.success) return invalid(parsed.error, values);

  const { name, email, password } = parsed.data;
  const next = safeNextPath(formData.get("next")?.toString());

  try {
    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        // The gate version is the attestation marker the auth instance's own hook requires;
        // the hook writes `age_attested_at` with the server's clock, so a direct POST that
        // skipped the form cannot create an account (`SEC §4.2`, `ADR-034`).
        ageGateVersion: AGE_GATE_VERSION,
        // The library carries this into the verification link's `callbackURL`, which
        // `sendVerificationEmail` turns back into the `next` on the verify screen.
        callbackURL: next ?? undefined,
      },
      headers: await headers(),
    });
  } catch (error) {
    // An existing address gets the same screen as a new one, so sign-up cannot be used to
    // discover whether an account exists (`SEC §4.3`). The real owner is not emailed.
    if (errorCode(error) !== DUPLICATE_ACCOUNT_CODE) {
      return { status: "error", message: GENERIC_FAILURE };
    }
  }

  redirect(withNext(`/verify?email=${encodeURIComponent(email)}`, next));
}

export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = read(formData);
  const parsed = resetRequestSchema.safeParse(values);

  if (!parsed.success) return invalid(parsed.error, values);

  const { email } = parsed.data;

  try {
    // `sendResetPassword` builds the link itself, so no `redirectTo` is needed.
    await auth.api.requestPasswordReset({ body: { email }, headers: await headers() });
  } catch {
    // The uniform response is the point (`EMAIL §5`): whether the address exists, or the
    // send failed, the visitor learns the same thing.
  }

  return {
    status: "success",
    message: `If ${email} has an account, a reset link is on its way. It works once and expires in an hour.`,
  };
}

export async function resetPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = read(formData);
  const parsed = resetPasswordSchema.safeParse(values);

  if (!parsed.success) return invalid(parsed.error, values);

  try {
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
  } catch (error) {
    // The auth instance rejects a policy-breaking password before the token is spent, and
    // its message is the field-level one the form would have shown.
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      return { status: "error", message: error.body.message ?? GENERIC_FAILURE };
    }

    return {
      status: "error",
      message: "This reset link has expired or is not valid. Request a new one.",
    };
  }

  return {
    status: "success",
    message: "Your password is updated and every other session was signed out.",
  };
}

export async function resendVerificationAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    return { status: "invalid", fieldErrors: toFieldErrors<AuthField>(parsed.error), values: {} };
  }

  try {
    await auth.api.sendVerificationEmail({
      body: {
        email: parsed.data,
        // A resent link keeps the destination the visitor arrived with, when there is one.
        callbackURL: safeNextPath(formData.get("next")?.toString()) ?? undefined,
      },
      headers: await headers(),
    });
  } catch {
    // Same message whether or not the address is registered, and whether or not the send
    // worked: this screen must not reveal account existence.
  }

  return {
    status: "success",
    message: `If ${parsed.data} is waiting to be verified, a new link is on its way.`,
  };
}
