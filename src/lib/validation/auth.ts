import { z } from "zod";

import { passwordPolicyError } from "@/lib/auth/password-policy";

/**
 * Auth form schemas (`TECHNICAL_STANDARDS.md` §6): the client form and the server action
 * validate the same values with the same rules, so no field message is written twice.
 *
 * Policies come from `SECURITY_AND_PERMISSIONS.md` §4.2 and `API_CONTRACTS.md` §3: an email
 * of at most 254 characters, lowercased; a 10–128 character password with no composition
 * rules, rejected when it is common or equals the email local part; a 2–80 character name
 * without links. Sign-in deliberately validates only that a password was typed — the
 * policy belongs to sign-up, and telling someone their password is "too short" on sign-in
 * would leak it.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .max(254, "Use an email address of 254 characters or fewer")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address")
  .transform((value) => value.toLowerCase());

/** The password rules, from the same function the Better Auth hook enforces. */
const newPasswordSchema = z.string().superRefine((value, ctx) => {
  const message = passwordPolicyError(value);
  if (message) ctx.addIssue({ code: "custom", message });
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128, "Use 128 characters or fewer"),
});

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your name")
      .max(80, "Use 80 characters or fewer")
      .refine(
        (value) => !/https?:\/\/|www\./i.test(value),
        "Names cannot contain links",
      ),
    email: emailSchema,
    // Checked below with the address in hand, so the local-part rule applies too.
    password: z.string(),
    // The checkbox posts `"on"`; tests and the client pass a boolean.
    ageAttested: z.preprocess(
      (value) => value === "on" || value === "true" || value === true,
      z.boolean(),
    ),
  })
  .superRefine((value, ctx) => {
    if (!value.ageAttested) {
      ctx.addIssue({
        code: "custom",
        path: ["ageAttested"],
        message: "Confirm you are 16 or older to create an account",
      });
    }
    const passwordMessage = passwordPolicyError(value.password, value.email);
    if (passwordMessage) {
      ctx.addIssue({ code: "custom", path: ["password"], message: passwordMessage });
    }
  });

export const resetRequestSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "This reset link is incomplete"),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Both passwords must match",
      });
    }
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
