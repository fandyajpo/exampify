import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { getAuthDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";

import { AGE_GATE_VERSION } from "./age-gate";
import { queueAuthEmail } from "./email";
import { safeNextPath } from "./next";
import { passwordPolicyError } from "./password-policy";

/**
 * The Better Auth instance (`ADR-017`, `SECURITY_AND_PERMISSIONS.md` §4).
 *
 * Sessions are rows in the same libSQL database as the content, reached through the
 * project's own Kysely `LibsqlDialect` so there is exactly one client and one set of
 * connection pragmas. The library owns the `user`, `session`, `account` and `verification`
 * tables; application columns (`role`, `status`, the age-attestation record) are declared
 * as additional fields so the library's CLI keeps checking them.
 *
 * `nextCookies()` must stay the last plugin: it copies a `Set-Cookie` header from an
 * `auth.api.*` response into the Next.js cookie store, which is the only way a server
 * action can sign someone in.
 *
 * The age attestation and the password policy live in the `hooks.before` block rather than
 * only in the server actions: `/api/auth/*` is a public HTTP surface, and a direct POST
 * must obey the same rules as the form (`SEC §4.2`, `ADR-034`).
 */

const SIGN_UP_PATH = "/sign-up/email";
const RESET_PASSWORD_PATH = "/reset-password";

/** The single error shape for a password that breaks the policy (`SEC §4.2`). */
function rejectPassword(message: string): never {
  throw new APIError("BAD_REQUEST", { message, code: "INVALID_PASSWORD" });
}

export const auth = betterAuth({
  appName: "Exampify",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.BETTER_AUTH_URL],

  database: getAuthDatabase(),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Sign-in before verification is allowed; practice is what waits for the verified
    // address (`SEC §4.3`). The verify screen is reached from the sign-up confirmation.
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      const url = new URL("/reset-password", env.BETTER_AUTH_URL);
      url.searchParams.set("token", token);

      // Not awaited so the response time does not reveal whether the address exists.
      void queueAuthEmail({
        to: user.email,
        template: "reset_password",
        url: url.toString(),
        token,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // The link is opened by a server component, which cannot set a session cookie;
    // verifying an address is not signing in (`USER_FLOWS.md` §6).
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, token, url: verificationUrl }) => {
      const url = new URL("/verify", env.BETTER_AUTH_URL);
      url.searchParams.set("token", token);

      // Sign-up and resend pass the sanitized `next` as the request's `callbackURL`, which
      // the library encodes into this URL; it returns the visitor to where they started
      // (`USER_FLOWS.md` §6).
      const next = safeNextPath(new URL(verificationUrl).searchParams.get("callbackURL"));
      if (next) url.searchParams.set("next", next);

      void queueAuthEmail({
        to: user.email,
        template: "verify_email",
        url: url.toString(),
        token,
      });
    },
  },

  session: {
    // 30 days absolute, with the rolling cookie refreshed at most once a day (`SEC §4.1`).
    // The 14-day idle expiry in that section is not implemented yet: it needs a check on
    // every authenticated request, which no caller does today.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "student", input: false },
      status: { type: "string", required: false, defaultValue: "active", input: false },
      ageAttestedAt: {
        type: "number",
        required: false,
        input: true,
        fieldName: "age_attested_at",
      },
      ageGateVersion: {
        type: "string",
        required: false,
        input: true,
        fieldName: "age_gate_version",
      },
      lastSeenAt: {
        type: "number",
        required: false,
        input: false,
        fieldName: "last_seen_at",
      },
      deletedAt: {
        type: "number",
        required: false,
        input: false,
        fieldName: "deleted_at",
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const body = ctx.body as Record<string, unknown> | undefined;
      if (!body) return;

      if (ctx.path === SIGN_UP_PATH) {
        // The form posts the gate version it showed beside the ticked checkbox; a request
        // without it never saw that checkbox, so it cannot create an account. The time of
        // the attestation is stamped here, so the record is the server's, not the client's.
        if (body.ageGateVersion !== AGE_GATE_VERSION) {
          throw new APIError("BAD_REQUEST", {
            message: "Confirm you are 16 or older to create an account",
            code: "AGE_ATTESTATION_REQUIRED",
          });
        }

        body.ageAttestedAt = Date.now();
        body.ageGateVersion = AGE_GATE_VERSION;
      }

      // Every endpoint that sets a password sends `newPassword`; sign-up sends `password`.
      // Keying on the field rather than on a list of paths also covers `/set-password`.
      const password = ctx.path === SIGN_UP_PATH ? body.password : body.newPassword;
      if (typeof password !== "string") return;

      // A reset body carries only the token, so the address is looked up through it; the
      // identifier is Better Auth's own (`reset-password:<token>`, value = user id). The
      // change/set-password endpoints have no address to compare with.
      let email = String(body.email ?? "");
      if (ctx.path === RESET_PASSWORD_PATH) {
        const token = String(body.token ?? "");
        const record = token
          ? await ctx.context.internalAdapter.findVerificationValue(`reset-password:${token}`)
          : null;
        const user = record ? await ctx.context.internalAdapter.findUserById(record.value) : null;
        email = user?.email ?? "";
      }

      const message = passwordPolicyError(password, email);
      if (message) rejectPassword(message);
    }),
  },

  // In-process limiter: enough to blunt a single-instance burst locally and on one
  // serverless instance, not a replacement for the Upstash counters in `SEC §4.2`.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
      "/request-password-reset": { window: 60 * 60, max: 3 },
      "/send-verification-email": { window: 60 * 60, max: 3 },
    },
  },

  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
