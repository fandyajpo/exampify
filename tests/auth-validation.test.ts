import { describe, expect, it } from "vitest";

import {
  actionFieldErrors,
  initialAuthState,
  type AuthFormState,
} from "@/lib/auth/form-state";
import { safeNextPath, withNext } from "@/lib/auth/next";
import { passwordPolicyError } from "@/lib/auth/password-policy";
import {
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

const VALID_SIGN_UP = {
  name: "Ayu Prameswari",
  email: "Ayu@Example.com",
  password: "long-enough-password",
  ageAttested: true,
};

describe("auth validation", () => {
  it("lowercases a valid sign-in email", () => {
    const parsed = signInSchema.safeParse({
      email: "  Student@Example.COM ",
      password: "anything",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("student@example.com");
  });

  it("does not apply the sign-up password policy on sign-in", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(true);
  });

  it("accepts a complete sign-up", () => {
    const parsed = signUpSchema.safeParse(VALID_SIGN_UP);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("ayu@example.com");
  });

  it("requires the age attestation", () => {
    const parsed = signUpSchema.safeParse({ ...VALID_SIGN_UP, ageAttested: false });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === "ageAttested")).toBe(true);
    }
  });

  it("rejects a short, common, or email-matching password", () => {
    for (const password of ["short", "password123", "ayu"]) {
      const parsed = signUpSchema.safeParse({ ...VALID_SIGN_UP, password });
      expect(parsed.success, password).toBe(false);
    }
  });

  it("rejects a name that contains a link", () => {
    expect(signUpSchema.safeParse({ ...VALID_SIGN_UP, name: "https://a.b" }).success).toBe(false);
  });

  it("requires both reset passwords to match", () => {
    const valid = resetPasswordSchema.safeParse({
      token: "token",
      password: "long-enough-password",
      confirmPassword: "long-enough-password",
    });
    const mismatch = resetPasswordSchema.safeParse({
      token: "token",
      password: "long-enough-password",
      confirmPassword: "long-enough-passworD",
    });

    expect(valid.success).toBe(true);
    expect(mismatch.success).toBe(false);
  });
});

describe("passwordPolicyError", () => {
  it("accepts a password that meets every rule", () => {
    expect(passwordPolicyError("long-enough-password", "ayu@example.com")).toBeNull();
  });

  it("rejects length, common and email-matching passwords", () => {
    expect(passwordPolicyError("short")).toBe("Use at least 10 characters");
    expect(passwordPolicyError("a".repeat(129))).toBe("Use 128 characters or fewer");
    expect(passwordPolicyError("password123")).toContain("too common");
    expect(passwordPolicyError("ayu.prameswari", "ayu.prameswari@example.com")).toBe(
      "Choose a password that is not your email address",
    );
  });

  it("skips the local-part rule when there is no address to compare with", () => {
    expect(passwordPolicyError("ayu.prameswari")).toBeNull();
  });
});

describe("actionFieldErrors", () => {
  const invalidSubmit: AuthFormState = {
    status: "invalid",
    fieldErrors: { email: "Enter your email address", password: "Enter your password" },
    values: {},
  };

  it("shows the action's errors while the fields are untouched", () => {
    expect(actionFieldErrors(invalidSubmit, [])).toEqual({
      email: "Enter your email address",
      password: "Enter your password",
    });
  });

  it("drops the error for a field edited since the submit", () => {
    expect(actionFieldErrors<"email" | "password">(invalidSubmit, ["email"])).toEqual({
      password: "Enter your password",
    });
  });

  it("has no errors before an invalid submit", () => {
    expect(actionFieldErrors(initialAuthState, [])).toEqual({});
    expect(actionFieldErrors({ status: "success", message: "ok" }, [])).toEqual({});
  });
});

describe("safeNextPath", () => {
  it("keeps an internal path", () => {
    expect(safeNextPath("/cambridge-international/igcse/biology?tab=read")).toBe(
      "/cambridge-international/igcse/biology?tab=read",
    );
  });

  it("drops anything that could leave the origin", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      " dashboard",
      "/",
    ]) {
      expect(safeNextPath(value), value).toBeNull();
    }
  });

  it("drops a return path that is itself an auth screen", () => {
    expect(safeNextPath("/sign-in?next=/dashboard")).toBeNull();
  });

  it("builds links that carry a valid return path only", () => {
    expect(withNext("/sign-up", "/dashboard")).toBe("/sign-up?next=%2Fdashboard");
    expect(withNext("/sign-up", null)).toBe("/sign-up");
    expect(withNext("/verify?email=a%40b.co", "/dashboard")).toBe(
      "/verify?email=a%40b.co&next=%2Fdashboard",
    );
  });
});
